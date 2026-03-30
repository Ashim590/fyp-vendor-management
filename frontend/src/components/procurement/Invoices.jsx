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
import { Search, Eye, FileText, Receipt } from "lucide-react";
import { downloadInvoicePdf } from "@/utils/invoicePdf";
import {
  WorkspacePageLayout,
  WorkspacePageHeader,
  WorkspaceToolbar,
  WORKSPACE_SELECT_CLASS,
} from "../layout/WorkspacePageLayout";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";

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

  const isStaff = user?.role === "admin" || user?.role === "staff";
  const isVendor = user?.role === "vendor";

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

  const openInvoiceDetail = async (invoiceId) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailInvoice(null);
    try {
      const { data } = await axios.get(`${INVOICE_API_END_POINT}/${invoiceId}`, {
        withCredentials: true,
        headers: getAuthHeaderFromStorage(),
      });
      if (data?.invoice) setDetailInvoice(data.invoice);
      else toast.error("Could not load invoice details.");
    } catch (err) {
      toast.error(
        err?.response?.data?.message || err?.message || "Could not load invoice.",
      );
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
      toast.success("eSewa payment record created. The vendor can pay from this screen.");
      dispatch(getAllInvoices({ limit: 40 }));
    } catch (err) {
      toast.error(
        err?.response?.data?.message || err?.message || "Could not create payment.",
      );
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
        toast.error("Procurement has not opened an eSewa payment for this invoice yet.");
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
      setInvoiceCheckout({ checkoutUrl: data.checkoutUrl, payload: data.payload });
    } catch (err) {
      toast.error(
        err?.response?.data?.message || err?.message || "Could not start eSewa.",
      );
    } finally {
      setInvoicePayBusy((s) => ({ ...s, [invoiceId]: null }));
    }
  };

  return (
    <WorkspacePageLayout>
      <WorkspacePageHeader
        title="Invoice management"
        description="Invoices from purchase orders and automatic receipts after tender eSewa payment."
      />

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
              {detailInvoice?.invoiceNumber || (detailLoading ? "Loading…" : "")}
            </DialogDescription>
          </DialogHeader>
          {detailLoading && (
            <p className="text-sm text-slate-600">Loading invoice…</p>
          )}
          {!detailLoading && detailInvoice && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Vendor</p>
                  <p className="text-slate-900">{detailInvoice.vendorName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Status</p>
                  <p className="text-slate-900">{detailInvoice.status}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Reference</p>
                  <p className="text-slate-900">
                    {detailInvoice.purchaseOrder?.orderNumber ||
                      detailInvoice.tender?.referenceNumber ||
                      detailInvoice.tender?.title ||
                      detailInvoice.purchaseOrderNumber ||
                      "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Total</p>
                  <p className="text-slate-900">{formatCurrency(detailInvoice.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Issue date</p>
                  <p className="text-slate-900">{formatDate(detailInvoice.issueDate)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Due date</p>
                  <p className="text-slate-900">{formatDate(detailInvoice.dueDate)}</p>
                </div>
              </div>
              {!!(detailInvoice.tenderPayment || detailInvoice.tender) && (
                <p className="rounded-md bg-sky-50 px-3 py-2 text-sky-900">
                  This invoice was generated after a completed tender (award) eSewa payment.
                </p>
              )}
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-slate-500">Line items</p>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detailInvoice.items || []).map((it, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <span className="font-medium">{it.itemName}</span>
                          {it.description ? (
                            <span className="mt-1 block text-xs text-slate-600">{it.description}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">{it.quantity}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(it.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right">
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

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Invoice #</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>PO / tender</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Issue Date</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center">
                Loading...
              </TableCell>
            </TableRow>
          ) : filteredInvoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="bg-slate-50/80 px-6 py-10">
                <div className="mx-auto max-w-2xl space-y-3 text-center text-sm text-slate-600">
                  <p className="text-base font-medium text-slate-900">
                    No invoices match your filters (or none exist yet)
                  </p>
                  <p className="text-left leading-relaxed">
                    Rows are stored when the server <strong>verifies</strong> a payment: tender fee
                    callbacks create a paid invoice; PO invoices are created by staff first, then marked
                    paid after eSewa. Opening the payment link in the browser (GET) does not create an
                    invoice—only a completed callback with status <code className="rounded bg-slate-200 px-1 text-xs">COMPLETE</code> does.
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
                            if (Array.isArray(data?.errors) && data.errors.length > 0) {
                              toast.warning(`${data.errors.length} row(s) reported errors — check server logs.`);
                            }
                            dispatch(getAllInvoices({ limit: 40 }));
                          } catch (e) {
                            toast.error(
                              e?.response?.data?.message ||
                                e?.message ||
                                "Could not run backfill.",
                            );
                          } finally {
                            setReconcileBusy(false);
                          }
                        }}
                      >
                        {reconcileBusy ? "Running…" : "Backfill invoices from completed payments"}
                      </Button>
                    </div>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            filteredInvoices.map((invoice) => (
              <TableRow key={invoice._id}>
                <TableCell className="font-medium">
                  {invoice.invoiceNumber}
                </TableCell>
                <TableCell>{invoice.vendorName}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span>{poOrTenderRef(invoice)}</span>
                    {invoice.tenderPayment || invoice.tender ? (
                      <Badge variant="statusInfo" className="w-fit text-[10px]">
                        Tender
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <FileText className="h-4 w-4 text-gray-400" />
                    {invoice.items?.length || 0} items
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  {formatCurrency(invoice.totalAmount)}
                </TableCell>
                <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      title="View details"
                      onClick={() => openInvoiceDetail(invoice._id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      title="Download invoice PDF"
                      onClick={() => downloadInvoicePdf(invoice)}
                    >
                      <Receipt className="h-4 w-4" />
                    </Button>
                    {isStaff && invoice.status === "approved" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        disabled={!!invoicePayBusy[invoice._id]}
                        onClick={() => createInvoicePayment(invoice._id)}
                      >
                        {invoicePayBusy[invoice._id] === "create"
                          ? "…"
                          : "eSewa payment"}
                      </Button>
                    )}
                    {isVendor && invoice.status === "approved" && (
                      <Button
                        size="sm"
                        type="button"
                        className="bg-teal-600 hover:bg-teal-700"
                        disabled={!!invoicePayBusy[invoice._id]}
                        onClick={() => payInvoiceWithEsewa(invoice._id)}
                      >
                        {invoicePayBusy[invoice._id] === "pay"
                          ? "…"
                          : "Pay with eSewa"}
                      </Button>
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
};

export default Invoices;
