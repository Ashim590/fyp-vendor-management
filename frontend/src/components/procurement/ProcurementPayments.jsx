import React, { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { getAllInvoices } from "@/redux/invoiceSlice";
import { PAYMENT_API_END_POINT } from "@/utils/constant";
import { getAuthHeaderFromStorage } from "@/utils/authHeader";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  WorkspacePageLayout,
  WorkspacePageHeader,
  WorkspaceToolbar,
  WORKSPACE_SELECT_CLASS,
} from "../layout/WorkspacePageLayout";
import { EsewaPaymentForm } from "@/components/payment/EsewaPaymentForm";
import { toast } from "sonner";
import { Loader2, ExternalLink } from "lucide-react";

export default function ProcurementPayments() {
  const dispatch = useDispatch();
  const { user } = useSelector((store) => store.auth);
  const isStaff = user?.role === "staff";
  const [searchParams, setSearchParams] = useSearchParams();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [checkout, setCheckout] = useState(null);

  const formatDate = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: 80,
        ...(statusFilter === "all" ? {} : { status: statusFilter }),
      };
      const { data } = await axios.get(`${PAYMENT_API_END_POINT}`, {
        withCredentials: true,
        headers: getAuthHeaderFromStorage(),
        params,
      });
      setPayments(data.payments || []);
    } catch {
      toast.error("Could not load tender payments.");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const ps = searchParams.get("paymentStatus");
    if (ps === "completed") {
      toast.success("Payment verified. Status updated.");
      load();
      searchParams.delete("paymentStatus");
      searchParams.delete("paymentId");
      searchParams.delete("transactionUuid");
      setSearchParams(searchParams, { replace: true });
    } else if (ps === "failed" || ps === "cancelled") {
      toast.error(
        ps === "cancelled"
          ? "Payment was cancelled or not completed."
          : "Payment could not be verified.",
      );
      load();
      searchParams.delete("paymentStatus");
      searchParams.delete("paymentId");
      searchParams.delete("transactionUuid");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, load, dispatch]);

  const startEsewa = async (paymentId) => {
    try {
      const { data } = await axios.post(
        `${PAYMENT_API_END_POINT}/${paymentId}/esewa/initiate`,
        {},
        {
          withCredentials: true,
          headers: getAuthHeaderFromStorage(),
        },
      );
      if (!data?.success || !data.checkoutUrl || !data.payload) {
        throw new Error(data?.message || "Could not start eSewa");
      }
      setCheckout({ checkoutUrl: data.checkoutUrl, payload: data.payload });
    } catch (e) {
      toast.error(
        e?.response?.data?.message ||
          e?.message ||
          "Could not open eSewa checkout.",
      );
    }
  };

  const statusBadge = (status) => {
    const map = {
      Pending: "statusWarning",
      Completed: "statusSuccess",
      Failed: "statusDanger",
    };
    return (
      <Badge
        variant={map[status] || "statusMuted"}
        className="whitespace-nowrap"
      >
        {status}
      </Badge>
    );
  };

  return (
    <WorkspacePageLayout>
      <WorkspacePageHeader
        title="Payments"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/tenders">Tenders</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/invoices">Invoices</Link>
            </Button>
          </div>
        }
      />

      {checkout && (
        <EsewaPaymentForm
          checkoutUrl={checkout.checkoutUrl}
          payload={checkout.payload}
          onCancel={() => setCheckout(null)}
        />
      )}

      <WorkspaceToolbar>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={WORKSPACE_SELECT_CLASS}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="Pending">Pending</option>
          <option value="Completed">Completed</option>
          <option value="Failed">Failed</option>
        </select>
      </WorkspaceToolbar>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3 text-center w-12">S/N</th>
              <th className="px-2 py-3">Payment #</th>
              <th className="px-4 py-3">Vendor Reg #</th>
              <th className="px-4 py-3">Tender</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Amount (NPR)</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center text-slate-500"
                >
                  <Loader2 className="inline h-5 w-5 animate-spin text-teal-600" />
                </td>
              </tr>
            ) : payments.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-slate-600"
                >
                  <p>No tender payments yet.</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Accept a quotation on a tender — a payment row is created
                    automatically. You can also add one manually from tender
                    detail if needed.
                  </p>
                  <Button className="mt-4" asChild>
                    <Link to="/tenders">Go to tenders</Link>
                  </Button>
                </td>
              </tr>
            ) : (
              payments.map((p, index) => (
                <tr key={p._id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-center text-xs text-slate-500">
                    {index + 1}
                  </td>
                  <td className="px-2 py-3 font-mono text-xs">
                    {p.paymentNumber}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">
                    {p.vendorRegistrationNumber || "—"}
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <span className="line-clamp-2">
                      {p.tender?.title || p.tenderReference || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.vendor?.name || p.vendorName || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {formatDate(p.paymentDate || p.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {Number(p.amount || 0).toLocaleString("en-NP")}
                  </td>
                  <td className="px-4 py-3">{statusBadge(p.status)}</td>
                  <td className="px-4 py-3 text-right align-middle">
                    <div className="inline-flex items-center justify-end gap-2">
                      <div className="flex min-w-[168px] justify-end">
                        {isStaff && p.status === "Pending" ? (
                          <Button
                            type="button"
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => startEsewa(p._id)}
                          >
                            Open eSewa checkout
                          </Button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                      <div className="flex min-w-[92px] justify-end">
                        {p.tender?._id ? (
                          <Link
                            to={`/tenders/${p.tender._id}`}
                            className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:underline"
                          >
                            Open tender
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </WorkspacePageLayout>
  );
}
