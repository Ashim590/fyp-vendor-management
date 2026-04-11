import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { toast } from "sonner";
import { LoadingState } from "../ui/loading-state";
import { cn } from "@/lib/utils";

export default function VendorPayments() {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(
    /** @type {"all" | "pending" | "completed"} */ ("all"),
  );

  const paymentFilterCounts = useMemo(() => {
    const pending = payments.filter((p) => p.status === "Pending").length;
    const completed = payments.filter((p) => p.status === "Completed").length;
    return { all: payments.length, pending, completed };
  }, [payments]);

  const filteredPayments = useMemo(() => {
    if (statusFilter === "pending") {
      return payments.filter((p) => p.status === "Pending");
    }
    if (statusFilter === "completed") {
      return payments.filter((p) => p.status === "Completed");
    }
    return payments;
  }, [payments, statusFilter]);

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
            ]}
            className="w-full max-w-xl flex-wrap sm:flex-nowrap"
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
        className={cn(WORKSPACE_DATA_TABLE_CLASS, "table-fixed")}
      >
        <colgroup>
          <col className="w-[14%]" />
          <col className="w-[16%]" />
          <col className="w-[34%]" />
          <col className="w-[16%]" />
          <col className="w-[20%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-left">Reference</TableHead>
            <TableHead className="text-left">Vendor Reg #</TableHead>
            <TableHead className="text-left">Tender</TableHead>
            <TableHead className="text-right">Amount (NPR)</TableHead>
            <TableHead className="text-left">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={5} className="p-0">
                <LoadingState variant="table" />
              </TableCell>
            </TableRow>
          ) : payments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-slate-500">
                No tender payments yet. They appear when procurement records a payment
                for an awarded tender.
              </TableCell>
            </TableRow>
          ) : (
            filteredPayments.map((p) => (
              <TableRow key={p._id}>
                <TableCell
                  className="min-w-0 truncate font-mono text-xs tabular-nums text-slate-900"
                  title={p.paymentNumber}
                >
                  {p.paymentNumber}
                </TableCell>
                <TableCell className="min-w-0 break-all font-mono text-xs">
                  {p.vendorRegistrationNumber || "—"}
                </TableCell>
                <TableCell className="min-w-0">
                  <span className="line-clamp-2 break-words leading-snug">
                    {p.tender?.title || p.tenderReference || "—"}
                  </span>
                </TableCell>
                <TableCell className="min-w-0 text-right tabular-nums font-medium text-slate-900">
                  {Number(p.amount || 0).toLocaleString("en-NP")}
                </TableCell>
                <TableCell className="min-w-0">{statusBadge(p.status)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </WorkspacePageLayout>
  );
}
