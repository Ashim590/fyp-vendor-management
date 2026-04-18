import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { getAllInvoices } from "@/redux/invoiceSlice";
import { INVOICE_API_END_POINT } from "@/utils/constant";
import { getAuthHeaderFromStorage } from "@/utils/authHeader";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
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
import { Search, Eye, Receipt, FileText, Wallet } from "lucide-react";
import { downloadInvoicePdf } from "@/utils/invoicePdf";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  WorkspacePageLayout,
  WorkspacePageHeader,
  WorkspaceToolbar,
  WORKSPACE_SELECT_CLASS,
  WORKSPACE_DATA_TABLE_CLASS,
} from "../layout/WorkspacePageLayout";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { cn } from "@/lib/utils";

/** Matches app theme: --color-primary (teal), --color-border, canvas wash */
const shellClass =
  "rounded-2xl border border-[var(--color-border)] bg-gradient-to-b from-primary/[0.07] via-white to-sky-50/30 px-4 py-6 shadow-sm ring-1 ring-sky-200/40 sm:px-6";

export default function VendorInvoices() {
  const dispatch = useDispatch();
  const location = useLocation();
  const { invoices, loading, error } = useSelector((store) => store.invoice);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    dispatch(getAllInvoices({ limit: 40 }));
  }, [dispatch, location.pathname]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const filteredInvoices = safeInvoices.filter((invoice) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      invoice.invoiceNumber?.toLowerCase().includes(q) ||
      invoice.purchaseOrderNumber?.toLowerCase().includes(q) ||
      invoice.purchaseOrder?.orderNumber?.toLowerCase?.().includes(q) ||
      invoice.tender?.referenceNumber?.toLowerCase?.().includes(q) ||
      invoice.tender?.title?.toLowerCase?.().includes(q);
    const matchesStatus =
      statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = useMemo(() => {
    const list = safeInvoices;
    const paid = list.filter((i) => i.status === "paid").length;
    const open = list.filter((i) =>
      ["draft", "pending", "approved", "sent"].includes(i.status),
    ).length;
    const overdue = list.filter((i) => i.status === "overdue").length;
    return { total: list.length, paid, open, overdue };
  }, [safeInvoices]);

  const poOrTenderRef = (inv) => {
    if (inv.purchaseOrder?.orderNumber) return inv.purchaseOrder.orderNumber;
    if (inv.tenderPayment || inv.tender) {
      return (
        inv.tender?.referenceNumber ||
        inv.tender?.title ||
        inv.purchaseOrderNumber ||
        "Tender payment"
      );
    }
    return inv.purchaseOrderNumber || "—";
  };

  const downloadInvoicePdfSafe = async (invoice) => {
    if (!invoice?._id) return;
    try {
      let inv = invoice;
      if (!Array.isArray(inv.items) || inv.items.length === 0) {
        const { data } = await axios.get(
          `${INVOICE_API_END_POINT}/${invoice._id}`,
          {
            withCredentials: true,
            headers: getAuthHeaderFromStorage(),
          },
        );
        inv = data?.invoice ?? inv;
      }
      downloadInvoicePdf(inv);
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, "Could not prepare PDF (load invoice first)."),
      );
    }
  };

  const openInvoiceDetail = async (invoiceId) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailInvoice(null);
    try {
      const { data } = await axios.get(
        `${INVOICE_API_END_POINT}/${invoiceId}`,
        {
          withCredentials: true,
          headers: getAuthHeaderFromStorage(),
        },
      );
      if (data?.invoice) setDetailInvoice(data.invoice);
      else toast.error("Could not load invoice details.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not load invoice."));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { label: "Draft", variant: "statusMuted" },
      pending: { label: "Pending", variant: "statusWarning" },
      approved: { label: "Approved", variant: "statusInfo" },
      sent: { label: "Sent", variant: "statusInfo" },
      paid: { label: "Paid", variant: "statusSuccess" },
      overdue: { label: "Overdue", variant: "statusDanger" },
      cancelled: { label: "Cancelled", variant: "statusNeutral" },
    };
    const config = statusConfig[status] || statusConfig.draft;
    return (
      <Badge variant={config.variant} className="whitespace-nowrap">
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-NP", {
      style: "currency",
      currency: "NPR",
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const statCard = (label, value, icon, tone) => (
    <div
      className={cn(
        "flex min-w-0 flex-1 gap-3 rounded-xl border p-4 shadow-sm",
        tone,
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/90 ring-1 ring-[var(--color-border)]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          {label}
        </p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-accent">
          {loading ? "…" : value}
        </p>
      </div>
    </div>
  );

  return (
    <WorkspacePageLayout className={shellClass}>
      <WorkspacePageHeader
        title="My invoices"
        className="border-[var(--color-border)]"
        titleClassName="text-accent"
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCard(
          "Total",
          stats.total,
          <FileText className="h-5 w-5 text-primary" />,
          "border-[var(--color-border)] bg-gradient-to-br from-primary/10 to-white",
        )}
        {statCard(
          "Open / in progress",
          stats.open,
          <Wallet className="h-5 w-5 text-amber-600" />,
          "border-amber-200/60 bg-amber-50/50",
        )}
        {statCard(
          "Paid",
          stats.paid,
          <Receipt className="h-5 w-5 text-emerald-600" />,
          "border-emerald-200/60 bg-emerald-50/50",
        )}
        {statCard(
          "Overdue",
          stats.overdue,
          <FileText className="h-5 w-5 text-rose-600" />,
          "border-rose-200/60 bg-rose-50/50",
        )}
      </div>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailInvoice(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice details</DialogTitle>
            <DialogDescription>
              {detailInvoice?.invoiceNumber ||
                (detailLoading ? "Loading…" : "")}
            </DialogDescription>
          </DialogHeader>
          {detailLoading && (
            <LoadingState variant="compact" label="Loading invoice…" />
          )}
          {!detailLoading && detailInvoice && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Your business
                  </p>
                  <p className="text-slate-900">{detailInvoice.vendorName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Status
                  </p>
                  <p className="text-slate-900">{detailInvoice.status}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Reference
                  </p>
                  <p className="text-slate-900">
                    {detailInvoice.purchaseOrder?.orderNumber ||
                      detailInvoice.tender?.referenceNumber ||
                      detailInvoice.tender?.title ||
                      detailInvoice.purchaseOrderNumber ||
                      "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Total
                  </p>
                  <p className="text-slate-900">
                    {formatCurrency(detailInvoice.totalAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Issue date
                  </p>
                  <p className="text-slate-900">
                    {formatDate(detailInvoice.issueDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Due date
                  </p>
                  <p className="text-slate-900">
                    {formatDate(detailInvoice.dueDate)}
                  </p>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-slate-500">
                  Line items
                </p>
                <Table className={cn(WORKSPACE_DATA_TABLE_CLASS, "table-fixed")}>
                  <colgroup>
                    <col className="w-[46%]" />
                    <col className="w-[14%]" />
                    <col className="w-[20%]" />
                    <col className="w-[20%]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-left">Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detailInvoice.items || []).map((it, i) => (
                      <TableRow key={i}>
                        <TableCell className="min-w-0">
                          <span className="font-medium break-words">
                            {it.itemName}
                          </span>
                          {it.description ? (
                            <span className="mt-1 block break-words text-xs text-slate-600">
                              {it.description}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="min-w-0 text-right tabular-nums">
                          {it.quantity}
                        </TableCell>
                        <TableCell className="min-w-0 text-right tabular-nums">
                          {formatCurrency(it.unitPrice)}
                        </TableCell>
                        <TableCell className="min-w-0 text-right tabular-nums font-medium">
                          {formatCurrency(it.totalPrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter className="gap-2 sm:justify-start">
                <Button
                  type="button"
                  className="bg-primary text-white hover:bg-[var(--color-primary-hover)]"
                  onClick={() => downloadInvoicePdf(detailInvoice)}
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <WorkspaceToolbar className="border-[var(--color-border)] bg-white/95 ring-1 ring-sky-200/50">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/70" />
          <Input
            placeholder="Search by invoice number or reference…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 border-[var(--color-border)] pl-10 shadow-sm focus-visible:ring-primary/25"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={WORKSPACE_SELECT_CLASS}
        >
          <option value="all">All status</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </WorkspaceToolbar>

      {loading ? (
        <LoadingState variant="table" label="Loading invoices…" />
      ) : filteredInvoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-primary/[0.04] px-6 py-14 text-center">
          <FileText className="mx-auto h-10 w-10 text-primary/80" />
          <p className="mt-3 text-base font-medium text-accent">
            No invoices match your filters
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Try clearing the search or setting status to “All”.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {filteredInvoices.map((invoice) => {
            const refFull = poOrTenderRef(invoice);
            const itemCount =
              invoice.itemsCount ?? invoice.items?.length ?? 0;
            return (
              <li key={invoice._id}>
                <article
                  className={cn(
                    "flex h-full flex-col rounded-2xl border border-[var(--color-border)] bg-white/95 p-5 shadow-sm ring-1 ring-sky-200/35 transition hover:border-primary/35 hover:shadow-md",
                    invoice.status === "overdue" &&
                      "border-rose-200/80 ring-rose-100/50",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold tabular-nums text-accent">
                        {invoice.invoiceNumber}
                      </p>
                      <p
                        className="mt-1 line-clamp-2 text-sm text-slate-700"
                        title={refFull}
                      >
                        {refFull}
                      </p>
                    </div>
                    {getStatusBadge(invoice.status)}
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-sky-100/90 pt-4">
                    <div>
                      <p className="text-xs text-slate-500">
                        {itemCount} line item{itemCount === 1 ? "" : "s"} · Issued{" "}
                        {formatDate(invoice.issueDate)}
                        {formatDate(invoice.issueDate) !==
                        formatDate(invoice.dueDate) ? (
                          <span className="text-slate-500">
                            {" "}
                            · Due {formatDate(invoice.dueDate)}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                        {formatCurrency(invoice.totalAmount)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        className="border-[var(--color-border)] text-accent hover:bg-primary/[0.06]"
                        onClick={() => openInvoiceDetail(invoice._id)}
                      >
                        <Eye className="mr-1.5 h-4 w-4" />
                        Details
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        className="bg-primary text-white hover:bg-[var(--color-primary-hover)]"
                        onClick={() => downloadInvoicePdfSafe(invoice)}
                      >
                        <Receipt className="mr-1.5 h-4 w-4" />
                        PDF
                      </Button>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </WorkspacePageLayout>
  );
}
