import React, { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  getAllDeliveries,
  getMyDeliveries,
  getDeliveryById,
  receiveDelivery,
  inspectDelivery,
  updateDeliveryStatus,
  recordDeliveryDelay,
  addDeliveryComment,
} from "@/redux/deliverySlice";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { toast } from "sonner";
import {
  Search,
  Eye,
  Truck,
  CheckCircle,
  Package,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { jsPDF } from "jspdf";
import {
  WorkspacePageLayout,
  WorkspacePageHeader,
  WorkspaceToolbar,
  WORKSPACE_SELECT_CLASS,
} from "../layout/WorkspacePageLayout";

const STATUS_LABELS = {
  pending: "Pending",
  shipped: "Shipped",
  in_transit: "In transit",
  delivered: "Delivered",
  received: "Received & verified",
  inspected: "Inspected",
  rejected: "Rejected",
};

function nextVendorStatus(status) {
  if (status === "pending") return "shipped";
  if (status === "shipped") return "in_transit";
  if (status === "in_transit") return "delivered";
  return null;
}

function nextVendorLabel(status) {
  const m = {
    pending: "Mark shipped",
    shipped: "Mark in transit",
    in_transit: "Mark delivered",
  };
  return m[status] || null;
}

const Deliveries = () => {
  const dispatch = useDispatch();
  const { deliveries, loading, error } = useSelector((store) => store.delivery);
  const { user } = useSelector((store) => store.auth);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detail, setDetail] = useState(null);
  const [delayOpen, setDelayOpen] = useState(false);
  const [delayTarget, setDelayTarget] = useState(null);
  const [delayReason, setDelayReason] = useState("");
  const [inspectNotes, setInspectNotes] = useState("");
  const [commentNote, setCommentNote] = useState("");

  const isStaff = user?.role === "admin" || user?.role === "staff";
  const isVendor = user?.role === "vendor";

  const loadDeliveries = () =>
    isVendor
      ? dispatch(getMyDeliveries({ limit: 50 }))
      : dispatch(getAllDeliveries({ limit: 50 }));

  useEffect(() => {
    loadDeliveries();
  }, [dispatch, isVendor]);

  useEffect(() => {
    if (error) {
      // Stable id dedupes React Strict Mode double-mount (one toast, not two).
      toast.error(error, { id: "deliveries-list-error" });
    }
  }, [error]);

  const refresh = () => loadDeliveries();

  const formatDateTime = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("en-NP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDownloadDeliveryReceiptPdf = (delivery) => {
    if (!delivery) return;
    const doc = new jsPDF();
    const receiptDate =
      delivery?.receivedData?.receivedDate || delivery?.actualDate || new Date();
    const details = [
      ["Receipt Date", formatDateTime(receiptDate)],
      ["Delivery Number", delivery.deliveryNumber || "N/A"],
      ["Order Reference", delivery.orderReference || delivery.purchaseOrderNumber || "N/A"],
      ["Vendor", delivery.vendorName || "N/A"],
      ["Status", STATUS_LABELS[delivery.status] || delivery.status || "N/A"],
      ["Received By", delivery?.receivedData?.receivedBy || "Procurement"],
      ["Notes", delivery?.receivedData?.notes || "N/A"],
    ];

    doc.setFontSize(16);
    doc.text("Paropakar VendorNet", 14, 18);
    doc.setFontSize(12);
    doc.text("Delivery Receipt", 14, 26);
    doc.setLineWidth(0.5);
    doc.line(14, 30, 196, 30);

    let y = 40;
    doc.setFontSize(11);
    details.forEach(([label, value]) => {
      doc.setFont(undefined, "bold");
      doc.text(`${label}:`, 14, y);
      doc.setFont(undefined, "normal");
      const wrapped = doc.splitTextToSize(String(value), 125);
      doc.text(wrapped, 70, y);
      y += Math.max(8, wrapped.length * 6);
    });

    doc.setFontSize(10);
    doc.text("This is a system-generated delivery receipt.", 14, 285);
    doc.save(`${delivery.deliveryNumber || `DEL-${delivery._id}`}-receipt.pdf`);
  };

  const handleReceive = async (deliveryId) => {
    try {
      const result = await dispatch(
        receiveDelivery({
          deliveryId,
          receivedData: {
            receivedDate: new Date(),
            receivedBy: user?.fullname || user?.name || "Procurement officer",
          },
        })
      ).unwrap();
      toast.success("Receipt confirmed");
      if (result?.delivery) {
        handleDownloadDeliveryReceiptPdf(result.delivery);
      }
      refresh();
      setDetail(null);
    } catch (err) {
      toast.error(err || "Failed to confirm receipt");
    }
  };

  const handleInspect = async (deliveryId) => {
    const notes = inspectNotes.trim() || prompt("Inspection notes:") || "";
    if (!notes) return;
    try {
      await dispatch(
        inspectDelivery({
          deliveryId,
          inspectionData: { status: "inspected", notes },
        })
      ).unwrap();
      toast.success("Inspection recorded");
      setInspectNotes("");
      refresh();
      setDetail(null);
    } catch (err) {
      toast.error(err || "Failed to inspect");
    }
  };

  const handleAdvanceStatus = async (deliveryId, status) => {
    try {
      await dispatch(updateDeliveryStatus({ deliveryId, status })).unwrap();
      toast.success("Status updated");
      const result = await loadDeliveries().unwrap();
      if (detail && String(detail._id) === String(deliveryId)) {
        const u = result?.deliveries?.find((d) => String(d._id) === String(deliveryId));
        if (u) setDetail(u);
      }
    } catch (err) {
      toast.error(err || "Update failed");
    }
  };

  const submitDelay = async () => {
    if (!delayTarget || !delayReason.trim()) {
      toast.error("Enter a delay reason");
      return;
    }
    try {
      await dispatch(
        recordDeliveryDelay({
          deliveryId: delayTarget._id,
          reason: delayReason.trim(),
        })
      ).unwrap();
      toast.success("Delay recorded");
      setDelayOpen(false);
      setDelayTarget(null);
      setDelayReason("");
      refresh();
    } catch (err) {
      toast.error(err || "Failed to record delay");
    }
  };

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((delivery) => {
      const ref = (delivery.orderReference || delivery.purchaseOrderNumber || "")
        .toLowerCase();
      const num = (delivery.deliveryNumber || "").toLowerCase();
      const vendor = (delivery.vendorName || "").toLowerCase();
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !q || ref.includes(q) || num.includes(q) || vendor.includes(q);
      const matchesStatus =
        statusFilter === "all" || delivery.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [deliveries, searchTerm, statusFilter]);

  const getStatusBadge = (status) => {
    const map = {
      pending: "statusWarning",
      shipped: "statusNeutral",
      in_transit: "statusInfo",
      delivered: "statusInfo",
      received: "statusSuccess",
      inspected: "statusMuted",
      rejected: "statusDanger",
    };
    const v = map[status] || "statusWarning";
    return (
      <Badge variant={v} className="whitespace-nowrap">
        {STATUS_LABELS[status] || status}
      </Badge>
    );
  };

  const formatDate = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-NP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const openDetail = async (d) => {
    setDetail(d);
    setInspectNotes("");
    setCommentNote("");
    try {
      const res = await dispatch(getDeliveryById(d._id)).unwrap();
      if (res?.delivery) setDetail(res.delivery);
    } catch {
      /* list row still usable without full history */
    }
  };

  const historySorted = (d) => {
    const h = d?.statusHistory || [];
    return [...h].sort((a, b) => new Date(b.at) - new Date(a.at));
  };

  const submitComment = async (deliveryId) => {
    const note = commentNote.trim();
    if (!note) {
      toast.error("Enter a note first");
      return;
    }
    try {
      await dispatch(addDeliveryComment({ deliveryId, note })).unwrap();
      toast.success("Comment added");
      setCommentNote("");
      const result = await loadDeliveries().unwrap();
      if (detail && String(detail._id) === String(deliveryId)) {
        const updated = result?.deliveries?.find(
          (d) => String(d._id) === String(deliveryId)
        );
        if (updated) setDetail(updated);
      }
    } catch (err) {
      toast.error(err || "Failed to add comment");
    }
  };

  return (
    <WorkspacePageLayout>
      <WorkspacePageHeader title="Delivery tracking" />

      <WorkspaceToolbar>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by delivery #, order ref, or vendor…"
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
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="shipped">Shipped</option>
          <option value="in_transit">In transit</option>
          <option value="delivered">Delivered</option>
          <option value="received">Received</option>
          <option value="inspected">Inspected</option>
          <option value="rejected">Rejected</option>
        </select>
      </WorkspaceToolbar>

      <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Delivery #</TableHead>
                <TableHead>Order ref</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Actual / received</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : filteredDeliveries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    No deliveries yet. Records appear after a tender or invoice payment
                    completes.
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeliveries.map((delivery) => (
                  <TableRow key={delivery._id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {delivery.deliveryNumber}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {delivery.orderReference || delivery.purchaseOrderNumber || "—"}
                    </TableCell>
                    <TableCell>{delivery.vendorName}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(delivery.expectedDate)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {delivery.actualDate
                        ? formatDate(delivery.actualDate)
                        : "—"}
                    </TableCell>
                    <TableCell>{getStatusBadge(delivery.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDetail(delivery)}
                        >
                          <Eye className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Details</span>
                        </Button>
                        {isVendor && nextVendorStatus(delivery.status) && (
                          <Button
                            size="sm"
                            className="bg-slate-900"
                            onClick={() =>
                              handleAdvanceStatus(
                                delivery._id,
                                nextVendorStatus(delivery.status)
                              )
                            }
                          >
                            <Truck className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">
                              {nextVendorLabel(delivery.status)}
                            </span>
                          </Button>
                        )}
                        {isStaff && delivery.status === "delivered" && (
                          <Button
                            size="sm"
                            className="bg-teal-700 hover:bg-teal-600"
                            onClick={() => handleReceive(delivery._id)}
                          >
                            <CheckCircle className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Confirm receipt</span>
                          </Button>
                        )}
                        {isStaff &&
                          ["received"].includes(delivery.status) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                openDetail(delivery);
                              }}
                            >
                              Inspect
                            </Button>
                          )}
                        {isVendor &&
                          !["received", "inspected"].includes(delivery.status) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-amber-800 border-amber-300"
                              onClick={() => {
                                setDelayTarget(delivery);
                                setDelayReason("");
                                setDelayOpen(true);
                              }}
                            >
                              <AlertTriangle className="h-4 w-4 sm:mr-1" />
                              <span className="hidden sm:inline">Delay</span>
                            </Button>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.deliveryNumber}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>
                  <span className="text-slate-500">Order ref</span>
                  <p className="font-medium text-slate-900">
                    {detail.orderReference || detail.purchaseOrderNumber || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Vendor</span>
                  <p className="font-medium text-slate-900">{detail.vendorName}</p>
                </div>
                <div>
                  <span className="text-slate-500">Expected delivery</span>
                  <p className="font-medium">{formatDate(detail.expectedDate)}</p>
                </div>
                <div>
                  <span className="text-slate-500">Current status</span>
                  <p>{getStatusBadge(detail.status)}</p>
                </div>
              </div>

              {detail.delayReason ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
                  <p className="font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Delay on record
                  </p>
                  <p className="mt-1">{detail.delayReason}</p>
                  {detail.delayRecordedAt && (
                    <p className="text-xs mt-1 opacity-80">
                      {formatDate(detail.delayRecordedAt)}
                    </p>
                  )}
                </div>
              ) : null}

              <div>
                <p className="font-medium text-slate-900 mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Status history
                </p>
                <ul className="space-y-2 border border-slate-100 rounded-lg p-3 bg-slate-50 max-h-48 overflow-y-auto">
                  {historySorted(detail).length === 0 ? (
                    <li className="text-slate-500">No history entries.</li>
                  ) : (
                    historySorted(detail).map((entry, idx) => (
                      <li key={idx} className="text-xs border-b border-slate-200 pb-2 last:border-0">
                        <span className="font-semibold">
                          {STATUS_LABELS[entry.status] || entry.status}
                        </span>
                        {entry.note ? ` — ${entry.note}` : ""}
                        <div className="text-slate-500 mt-0.5">
                          {formatDate(entry.at)}
                          {entry.byName ? ` · ${entry.byName}` : ""}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div className="space-y-2">
                <Label>Vendor communication note</Label>
                <Input
                  value={commentNote}
                  onChange={(e) => setCommentNote(e.target.value)}
                  placeholder="Add a note for the vendor/procurement log"
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => submitComment(detail._id)}
                >
                  Add note to history
                </Button>
              </div>

              {detail.items?.length > 0 && (
                <div>
                  <p className="font-medium text-slate-900 mb-1 flex items-center gap-2">
                    <Package className="h-4 w-4" /> Line items
                  </p>
                  <p className="text-slate-600">{detail.items.length} item(s)</p>
                </div>
              )}

              {isVendor && nextVendorStatus(detail.status) && (
                <Button
                  className="w-full bg-slate-900"
                  onClick={() =>
                    handleAdvanceStatus(detail._id, nextVendorStatus(detail.status))
                  }
                >
                  {nextVendorLabel(detail.status)}
                </Button>
              )}

              {isStaff && detail.status === "delivered" && (
                <Button
                  className="w-full bg-teal-700"
                  onClick={() => handleReceive(detail._id)}
                >
                  Confirm receipt & verification
                </Button>
              )}

              {isStaff &&
                detail.status === "received" && (
                  <div className="space-y-2">
                    <Label>Inspection notes</Label>
                    <Input
                      value={inspectNotes}
                      onChange={(e) => setInspectNotes(e.target.value)}
                      placeholder="Quality / quantity notes"
                    />
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => handleInspect(detail._id)}
                    >
                      Record inspection
                    </Button>
                  </div>
                )}

              {isVendor &&
                !["received", "inspected"].includes(detail.status) && (
                  <Button
                    variant="outline"
                    className="w-full border-amber-300 text-amber-900"
                    onClick={() => {
                      setDelayTarget(detail);
                      setDelayReason("");
                      setDelayOpen(true);
                      setDetail(null);
                    }}
                  >
                    Record delay / issue
                  </Button>
                )}

              {isStaff && ["received", "inspected"].includes(detail.status) && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleDownloadDeliveryReceiptPdf(detail)}
                >
                  Download receipt
                </Button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={delayOpen} onOpenChange={setDelayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record delivery delay</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delay-reason">Reason</Label>
            <textarea
              id="delay-reason"
              className="w-full min-h-[100px] border border-slate-300 rounded-lg p-2 text-sm"
              value={delayReason}
              onChange={(e) => setDelayReason(e.target.value)}
              placeholder="Explain the delay (e.g. stock, transport, weather)…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelayOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitDelay}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspacePageLayout>
  );
};

export default Deliveries;
