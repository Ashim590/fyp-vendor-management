import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { PAYMENT_API_END_POINT } from "@/utils/constant";
import { getAuthHeaderFromStorage } from "@/utils/authHeader";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  WorkspacePageLayout,
  WorkspacePageHeader,
  WorkspaceSegmentedControl,
  WORKSPACE_DATA_TABLE_CLASS,
} from "../layout/WorkspacePageLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { EsewaPaymentForm } from "@/components/payment/EsewaPaymentForm";
import { toast } from "sonner";
import { SESSION_ROLE } from "@/constants/userRoles";
import { ExternalLink } from "lucide-react";
import { LoadingState } from "../ui/loading-state";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/utils/apiError";

export default function ProcurementPayments() {
  const { user } = useSelector((store) => store.auth);
  const isStaff = user?.role === SESSION_ROLE.PROCUREMENT_OFFICER;
  const [searchParams, setSearchParams] = useSearchParams();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(
    /** @type {"all" | "pending" | "completed" | "failed"} */ ("all"),
  );
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
      const { data } = await axios.get(`${PAYMENT_API_END_POINT}`, {
        withCredentials: true,
        headers: getAuthHeaderFromStorage(),
        params: { limit: 200 },
      });
      setPayments(data.payments || []);
    } catch {
      toast.error("Could not load tender payments.");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const paymentFilterCounts = useMemo(() => {
    const pending = payments.filter((p) => p.status === "Pending").length;
    const completed = payments.filter((p) => p.status === "Completed").length;
    const failed = payments.filter((p) => p.status === "Failed").length;
    return { all: payments.length, pending, completed, failed };
  }, [payments]);

  const filteredPayments = useMemo(() => {
    if (statusFilter === "pending") {
      return payments.filter((p) => p.status === "Pending");
    }
    if (statusFilter === "completed") {
      return payments.filter((p) => p.status === "Completed");
    }
    if (statusFilter === "failed") {
      return payments.filter((p) => p.status === "Failed");
    }
    return payments;
  }, [payments, statusFilter]);

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
  }, [searchParams, setSearchParams, load]);

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
        getApiErrorMessage(e, "Could not open eSewa checkout."),
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

      {!loading ? (
        <div className="mb-4 space-y-3">
          <WorkspaceSegmentedControl
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: `All (${paymentFilterCounts.all})` },
              {
                value: "pending",
                label: `Pending (${paymentFilterCounts.pending})`,
              },
              {
                value: "completed",
                label: `Completed (${paymentFilterCounts.completed})`,
              },
              {
                value: "failed",
                label: `Failed (${paymentFilterCounts.failed})`,
              },
            ]}
            className="w-full max-w-3xl flex-wrap sm:flex-nowrap"
          />
          {payments.length > 0 && filteredPayments.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm font-medium text-slate-600">
              No payments match this filter. Try{" "}
              <button
                type="button"
                className="font-semibold text-teal-800 underline-offset-2 hover:underline"
                onClick={() => setStatusFilter("all")}
              >
                All
              </button>
              .
            </p>
          ) : null}
        </div>
      ) : null}

      <Table
        className={cn(
          WORKSPACE_DATA_TABLE_CLASS,
          "table-fixed",
        )}
      >
        <colgroup>
          <col className="w-[3%]" />
          <col className="w-[10%]" />
          <col className="w-[9%]" />
          <col className="w-[21%]" />
          <col className="w-[17%]" />
          <col className="w-[10%]" />
          <col className="w-[9%]" />
          <col className="w-[8%]" />
          <col className="w-[13%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-center">S/N</TableHead>
            <TableHead className="text-left">Payment #</TableHead>
            <TableHead className="text-left">Vendor Reg #</TableHead>
            <TableHead className="text-left">Tender</TableHead>
            <TableHead className="text-left">Vendor</TableHead>
            <TableHead className="text-left">Date</TableHead>
            <TableHead className="text-right">Amount (NPR)</TableHead>
            <TableHead className="text-left">Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={9} className="p-0">
                <LoadingState variant="table" />
              </TableCell>
            </TableRow>
          ) : payments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="py-10 text-center text-slate-600">
                <p>No tender payments yet.</p>
                <p className="mt-2 text-sm text-slate-500">
                  Accept a quotation on a tender — a payment row is created
                  automatically. You can also add one manually from tender
                  detail if needed.
                </p>
                <Button className="mt-4" asChild>
                  <Link to="/tenders">Go to tenders</Link>
                </Button>
              </TableCell>
            </TableRow>
          ) : (
            filteredPayments.map((p, index) => (
              <TableRow key={p._id}>
                <TableCell className="min-w-0 text-center text-xs text-slate-500">
                  {index + 1}
                </TableCell>
                <TableCell
                  className="min-w-0 truncate font-semibold tabular-nums tracking-tight text-slate-900 [text-decoration-line:none]"
                  title={p.paymentNumber}
                >
                  {p.paymentNumber}
                </TableCell>
                <TableCell className="min-w-0 break-all font-mono text-xs text-slate-700">
                  {p.vendorRegistrationNumber || "—"}
                </TableCell>
                <TableCell className="min-w-0">
                  <span className="line-clamp-2 break-words leading-snug">
                    {p.tender?.title || p.tenderReference || "—"}
                  </span>
                </TableCell>
                <TableCell className="min-w-0 text-slate-800">
                  <span className="line-clamp-2 break-words leading-snug">
                    {p.vendor?.name || p.vendorName || "—"}
                  </span>
                </TableCell>
                <TableCell className="min-w-0 whitespace-nowrap text-slate-700">
                  {formatDate(p.paymentDate || p.createdAt)}
                </TableCell>
                <TableCell className="min-w-0 text-right tabular-nums font-medium text-slate-900">
                  {Number(p.amount || 0).toLocaleString("en-NP")}
                </TableCell>
                <TableCell className="min-w-0">{statusBadge(p.status)}</TableCell>
                <TableCell className="min-w-0 text-right align-middle">
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {isStaff && p.status === "Pending" ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 shrink-0 bg-emerald-600 px-2.5 text-xs hover:bg-emerald-700"
                        title="Open eSewa checkout"
                        onClick={() => startEsewa(p._id)}
                      >
                        eSewa
                      </Button>
                    ) : null}
                    {p.tender?._id ? (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        asChild
                      >
                        <Link
                          to={`/tenders/${p.tender._id}`}
                          title="Open tender"
                        >
                          <ExternalLink className="h-4 w-4" />
                          <span className="sr-only">Open tender</span>
                        </Link>
                      </Button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </WorkspacePageLayout>
  );
}
