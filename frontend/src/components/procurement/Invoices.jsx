import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { getAllInvoices } from "@/redux/invoiceSlice";
import {
  INVOICE_API_END_POINT,
  INVOICE_PAYMENT_API_END_POINT,
} from "@/utils/constant";
import { getAuthHeaderFromStorage } from "@/utils/authHeader";
import { EsewaPaymentForm } from "@/components/payment/EsewaPaymentForm";
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
import { SESSION_ROLE } from "@/constants/userRoles";
import { Search, Eye, Receipt } from "lucide-react";
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

const Invoices = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const { user } = useSelector((store) => store.auth);
  const { invoices, loading, error } = useSelector((store) => store.invoice);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [invoiceCheckout, setInvoiceCheckout] = useState(null);
  const [invoicePayBusy, setInvoicePayBusy] = useState({});
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reconcileBusy, setReconcileBusy] = useState(false);

  const isStaff = user?.role === SESSION_ROLE.PROCUREMENT_OFFICER;

  useEffect(() => {
    dispatch(getAllInvoices({ limit: 40 }));
  }, [dispatch, location.pathname]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const filteredInvoices = safeInvoices.filter((invoice) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      invoice.invoiceNumber?.toLowerCase().includes(q) ||
      invoice.vendorName?.toLowerCase().includes(q) ||
      invoice.purchaseOrderNumber?.toLowerCase().includes(q) ||
      invoice.purchaseOrder?.orderNumber?.toLowerCase?.().includes(q) ||
      invoice.tender?.referenceNumber?.toLowerCase?.().includes(q) ||
      invoice.tender?.title?.toLowerCase?.().includes(q);
    const matchesStatus =
      statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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

  const createInvoicePayment = async (invoiceId) => {
    setInvoicePayBusy((s) => ({ ...s, [invoiceId]: "create" }));
    try {
      await axios.post(
        `${INVOICE_PAYMENT_API_END_POINT}/create`,
        { invoiceId },
        { withCredentials: true, headers: getAuthHeaderFromStorage() },
      );
      toast.success("Payment record created.");
      dispatch(getAllInvoices({ limit: 40 }));
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not create payment."));
    } finally {
      setInvoicePayBusy((s) => ({ ...s, [invoiceId]: null }));
    }
  };

  const payInvoiceWithEsewa = async (invoiceId) => {
    setInvoicePayBusy((s) => ({ ...s, [invoiceId]: "pay" }));
    try {
      const { data: wrap } = await axios.get(
        `${INVOICE_PAYMENT_API_END_POINT}/by-invoice/${invoiceId}`,
        { withCredentials: true, headers: getAuthHeaderFromStorage() },
      );
      const invPay = wrap?.payment;
      if (!invPay?._id) {
        toast.error(
          "Procurement has not opened an eSewa payment for this invoice yet.",
        );
        return;
      }
      if (invPay.status !== "PENDING") {
        toast.info("This invoice payment is no longer pending.");
        return;
      }
      const { data } = await axios.post(
        `${INVOICE_PAYMENT_API_END_POINT}/${invPay._id}/esewa/initiate`,
        {},
        { withCredentials: true, headers: getAuthHeaderFromStorage() },
      );
      if (!data?.success || !data.checkoutUrl || !data.payload) {
        throw new Error(data?.message || "Could not start eSewa");
      }
      setInvoiceCheckout({
        checkoutUrl: data.checkoutUrl,
        payload: data.payload,
      });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not start eSewa."));
    } finally {
      setInvoicePayBusy((s) => ({ ...s, [invoiceId]: null }));
    }
  };

  return (
    <WorkspacePageLayout>
      <WorkspacePageHeader title="Invoice management" />

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
                    Vendor
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
                          <span className="font-medium break-words">{it.itemName}</span>
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
                  className="bg-teal-600 hover:bg-teal-700"
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

      {invoiceCheckout && (
        <EsewaPaymentForm
          checkoutUrl={invoiceCheckout.checkoutUrl}
          payload={invoiceCheckout.payload}
          onCancel={() => setInvoiceCheckout(null)}
        />
      )}

      <WorkspaceToolbar>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by invoice number or vendor…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 border-slate-200/90 pl-10 shadow-sm"
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

      <Table
        className={cn(WORKSPACE_DATA_TABLE_CLASS, "table-fixed")}
      >
        <colgroup>
          <col className="w-[3%]" />
          <col className="w-[11%]" />
          <col className="w-[20%]" />
          <col className="w-[18%]" />
          <col className="w-[6%]" />
          <col className="w-[10%]" />
          <col className="w-[14%]" />
          <col className="w-[8%]" />
          <col className="w-[10%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-center">#</TableHead>
            <TableHead className="text-left">Invoice</TableHead>
            <TableHead className="text-left">Vendor</TableHead>
            <TableHead className="text-left">Reference</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-left">Issued / due</TableHead>
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
          ) : filteredInvoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="bg-slate-50/80 px-6 py-10">
                <div className="mx-auto max-w-2xl space-y-3 text-center text-sm text-slate-600">
                  <p className="text-base font-medium text-slate-900">
                    No invoices match your filters.
                  </p>
                  {isStaff && (
                    <div className="flex flex-col items-center gap-2 pt-2 sm:flex-row sm:justify-center">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={reconcileBusy}
                        onClick={async () => {
                          setReconcileBusy(true);
                          try {
                            const { data } = await axios.post(
                              `${INVOICE_API_END_POINT}/reconcile-from-payments`,
                              {},
                              {
                                withCredentials: true,
                                headers: getAuthHeaderFromStorage(),
                              },
                            );
                            const t = data?.tenderInvoicesCreated ?? 0;
                            const s = data?.invoiceRowsEnsured ?? 0;
                            toast.success(
                              `Backfill done: ${t} tender invoice(s) created, ${s} supplier payment(s) applied.`,
                            );
                            if (
                              Array.isArray(data?.errors) &&
                              data.errors.length > 0
                            ) {
                              toast.warning(
                                `${data.errors.length} row(s) reported errors — check server logs.`,
                              );
                            }
                            dispatch(getAllInvoices({ limit: 40 }));
                          } catch (e) {
                            toast.error(
                              getApiErrorMessage(e, "Could not run backfill."),
                            );
                          } finally {
                            setReconcileBusy(false);
                          }
                        }}
                      >
                        {reconcileBusy
                          ? "Running…"
                          : "Backfill invoices from completed payments"}
                      </Button>
                    </div>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            filteredInvoices.map((invoice, index) => {
              const refFull = poOrTenderRef(invoice);
              const itemCount =
                invoice.itemsCount ?? invoice.items?.length ?? 0;
              return (
                <TableRow key={invoice._id} className="align-middle">
                  <TableCell className="min-w-0 text-center text-xs text-slate-500">
                    {index + 1}
                  </TableCell>
                  <TableCell className="min-w-0 truncate font-medium tabular-nums text-slate-900">
                    {invoice.invoiceNumber}
                  </TableCell>
                  <TableCell className="min-w-0 truncate text-slate-800">
                    <span title={invoice.vendorName}>{invoice.vendorName}</span>
                  </TableCell>
                  <TableCell className="min-w-0">
                    <p className="truncate text-slate-800" title={refFull}>
                      {refFull}
                    </p>
                  </TableCell>
                  <TableCell
                    className="min-w-0 text-right tabular-nums text-slate-600"
                    title={`${itemCount} line item(s)`}
                  >
                    {itemCount}
                  </TableCell>
                  <TableCell className="min-w-0 text-right font-medium tabular-nums whitespace-nowrap">
                    {formatCurrency(invoice.totalAmount)}
                  </TableCell>
                  <TableCell className="min-w-0 text-xs leading-snug text-slate-700 whitespace-nowrap">
                    <div>{formatDate(invoice.issueDate)}</div>
                    {formatDate(invoice.issueDate) !==
                    formatDate(invoice.dueDate) ? (
                      <div className="text-slate-500">
                        Due {formatDate(invoice.dueDate)}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="min-w-0">{getStatusBadge(invoice.status)}</TableCell>
                  <TableCell className="min-w-0">
                    <div className="flex flex-nowrap items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        type="button"
                        title="View details"
                        onClick={() => openInvoiceDetail(invoice._id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        type="button"
                        title="Download PDF"
                        onClick={() => downloadInvoicePdfSafe(invoice)}
                      >
                        <Receipt className="h-4 w-4" />
                      </Button>
                      {isStaff && invoice.status === "approved" && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            type="button"
                            className="h-8 shrink-0 px-2 text-xs"
                            disabled={!!invoicePayBusy[invoice._id]}
                            onClick={() => createInvoicePayment(invoice._id)}
                          >
                            {invoicePayBusy[invoice._id] === "create"
                              ? "…"
                              : "Create pay"}
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            type="button"
                            className="h-8 shrink-0 bg-teal-600 px-2 text-xs hover:bg-teal-700"
                            disabled={!!invoicePayBusy[invoice._id]}
                            onClick={() => payInvoiceWithEsewa(invoice._id)}
                          >
                            {invoicePayBusy[invoice._id] === "pay"
                              ? "…"
                              : "eSewa"}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </WorkspacePageLayout>
  );
};

export default Invoices;
