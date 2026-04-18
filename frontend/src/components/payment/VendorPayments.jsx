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
} from "../layout/WorkspacePageLayout";
import { toast } from "sonner";
import { LoadingState } from "../ui/loading-state";
import { cn } from "@/lib/utils";
import { Banknote, Hash } from "lucide-react";

/** App theme: --color-primary, --color-border, --color-secondary (accent) */
const shellClass =
  "rounded-2xl border border-[var(--color-border)] bg-gradient-to-b from-primary/[0.07] via-white to-sky-50/30 px-4 py-6 shadow-sm ring-1 ring-sky-200/40 sm:px-6";

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
      <Badge
        variant={map[status] || "statusMuted"}
        className="whitespace-nowrap"
      >
        {status}
      </Badge>
    );
  };

  const cardAccent = (status) => {
    if (status === "Completed") {
      return "border-emerald-200/80 ring-emerald-100/40";
    }
    if (status === "Pending") {
      return "border-amber-200/80 ring-amber-100/40";
    }
    return "border-[var(--color-border)] ring-sky-200/35";
  };

  return (
    <WorkspacePageLayout className={shellClass}>
      <WorkspacePageHeader
        title="My tender payments"
        className="border-[var(--color-border)]"
        titleClassName="text-accent"
      />

      {!loading ? (
        <div className="mb-6 space-y-3">
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
            className="w-full max-w-xl flex-wrap border-[var(--color-border)] bg-primary/[0.05] shadow-inner sm:flex-nowrap"
          />
          {payments.length > 0 && filteredPayments.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--color-border)] bg-primary/[0.04] px-4 py-8 text-center text-sm font-medium text-slate-700">
              No payments match this filter. Try{" "}
              <button
                type="button"
                className="font-semibold text-accent underline-offset-2 hover:underline"
                onClick={() => setStatusFilter("all")}
              >
                All
              </button>
              .
            </p>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <LoadingState variant="table" label="Loading payments…" />
      ) : payments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-primary/[0.04] px-6 py-14 text-center">
          <Banknote className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-3 text-base font-medium text-accent">
            No tender payments yet
          </p>
          <p className="mt-1 text-sm text-slate-600">
            They appear when procurement records a payment for an awarded tender.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {filteredPayments.map((p) => (
            <li key={p._id}>
              <article
                className={cn(
                  "flex h-full flex-col rounded-2xl border bg-white/95 p-5 shadow-sm transition hover:shadow-md",
                  cardAccent(p.status),
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                      <Hash className="h-3.5 w-3.5" />
                      Payment ref
                    </p>
                    <p
                      className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-900"
                      title={p.paymentNumber}
                    >
                      {p.paymentNumber}
                    </p>
                  </div>
                  {statusBadge(p.status)}
                </div>
                <div className="mt-4 min-w-0">
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Tender
                  </p>
                  <p className="mt-1 line-clamp-3 text-sm font-medium leading-snug text-slate-800">
                    {p.tender?.title || p.tenderReference || "—"}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-sky-100/90 pt-4">
                  <div>
                    <p className="text-xs text-slate-500">Vendor reg #</p>
                    <p className="font-mono text-xs text-slate-700">
                      {p.vendorRegistrationNumber || "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Amount (NPR)</p>
                    <p className="text-xl font-bold tabular-nums text-accent">
                      {Number(p.amount || 0).toLocaleString("en-NP")}
                    </p>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </WorkspacePageLayout>
  );
}
