import React, { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import axios from "axios";
import { getAllInvoices } from "@/redux/invoiceSlice";
import { useSearchParams } from "react-router-dom";
import { PAYMENT_API_END_POINT } from "@/utils/constant";
import { getAuthHeaderFromStorage } from "@/utils/authHeader";
import { Badge } from "../ui/badge";
import {
  WorkspacePageLayout,
  WorkspacePageHeader,
} from "../layout/WorkspacePageLayout";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function VendorPayments() {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${PAYMENT_API_END_POINT}/my`, {
        withCredentials: true,
        headers: getAuthHeaderFromStorage(),
      });
      setPayments(data.payments || []);
    } catch {
      toast.error("Could not load payments.");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const ps = searchParams.get("paymentStatus");
    if (ps === "completed") {
      toast.success("Payment status updated.");
      load();
      dispatch(getAllInvoices({ limit: 100 }));
      searchParams.delete("paymentStatus");
      searchParams.delete("paymentId");
      searchParams.delete("transactionUuid");
      setSearchParams(searchParams, { replace: true });
    } else if (ps === "failed" || ps === "cancelled") {
      toast.error(
        ps === "cancelled"
          ? "Payment was cancelled or not completed."
          : "Payment could not be verified. Contact procurement if you have questions.",
      );
      searchParams.delete("paymentStatus");
      searchParams.delete("paymentId");
      searchParams.delete("transactionUuid");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, load, dispatch]);

  const statusBadge = (status) => {
    const map = {
      Pending: "statusWarning",
      Completed: "statusSuccess",
      Failed: "statusDanger",
    };
    return (
      <Badge variant={map[status] || "statusMuted"} className="whitespace-nowrap">
        {status}
      </Badge>
    );
  };

  return (
    <WorkspacePageLayout>
      <WorkspacePageHeader title="My tender payments" />

      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p className="font-medium text-slate-900">View-only</p>
        <p className="mt-1 text-slate-600">
          Payment is handled by procurement only. This page shows reference, amount, and
          status — there is no pay or checkout action for vendor accounts.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Vendor Reg #</th>
              <th className="px-4 py-3">Tender</th>
              <th className="px-4 py-3 text-right">Amount (NPR)</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                  <Loader2 className="inline h-5 w-5 animate-spin text-teal-600" />
                </td>
              </tr>
            ) : payments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  No tender payments yet. They appear when procurement records a payment
                  for an awarded tender.
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p._id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono text-xs">{p.paymentNumber}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {p.vendorRegistrationNumber || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {p.tender?.title || p.tenderReference || "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {Number(p.amount || 0).toLocaleString("en-NP")}
                  </td>
                  <td className="px-4 py-3">{statusBadge(p.status)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </WorkspacePageLayout>
  );
}
