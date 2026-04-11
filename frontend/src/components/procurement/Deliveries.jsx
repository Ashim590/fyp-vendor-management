import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  getAllDeliveries,
  getMyDeliveries,
  getDeliveryById,
  confirmDelivery,
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
import { LoadingState } from "../ui/loading-state";
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
  MapContainer,
  Marker,
  Popup,
  TileLayer,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import {
  WorkspacePageLayout,
  WorkspacePageHeader,
  WorkspaceToolbar,
  WorkspaceSegmentedControl,
  WORKSPACE_DATA_TABLE_CLASS,
} from "../layout/WorkspacePageLayout";
import { cn } from "@/lib/utils";
import {
  DELIVERY_STATUS,
  normalizeDeliveryStatus,
  STATUS_LABELS,
  statusLabel,
} from "@/utils/deliveryWorkflow";
import { SESSION_ROLE } from "@/constants/userRoles";

const DEFAULT_MARKER_ICON = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function hasRecordedDelay(d) {
  return Boolean(
    (d.delayReason && String(d.delayReason).trim()) || d.delayRecordedAt,
  );
}

function nextVendorStatus(status) {
  const s = normalizeDeliveryStatus(status);
  if (s === DELIVERY_STATUS.PENDING) return DELIVERY_STATUS.ACCEPTED;
  if (s === DELIVERY_STATUS.ACCEPTED) return DELIVERY_STATUS.IN_TRANSIT;
  if (s === DELIVERY_STATUS.IN_TRANSIT) return DELIVERY_STATUS.READY_FOR_CONFIRMATION;
  return null;
}

function nextVendorLabel(status) {
  const s = normalizeDeliveryStatus(status);
  const m = {
    [DELIVERY_STATUS.PENDING]: "Mark accepted",
    [DELIVERY_STATUS.ACCEPTED]: "Mark in transit",
    [DELIVERY_STATUS.IN_TRANSIT]: "Mark ready for confirmation",
  };
  return m[s] || null;
}

const Deliveries = () => {
  const dispatch = useDispatch();
  const { deliveries, loading, error } = useSelector((store) => store.delivery);
  const { user } = useSelector((store) => store.auth);
  const [searchTerm, setSearchTerm] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState(
    /** @type {"all" | "in_progress" | "awaiting_receipt" | "closed" | "rejected" | "delayed"} */ (
      "all"
    ),
  );
  const [detail, setDetail] = useState(null);
  const [delayOpen, setDelayOpen] = useState(false);
  const [delayTarget, setDelayTarget] = useState(null);
  const [delayReason, setDelayReason] = useState("");
  const [inspectNotes, setInspectNotes] = useState("");
  const [commentNote, setCommentNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [location, setLocation] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [proofImage, setProofImage] = useState(null);
  const [vendorProofFile, setVendorProofFile] = useState(null);

  const isProcurementOfficer = user?.role === SESSION_ROLE.PROCUREMENT_OFFICER;
  const isAdmin = user?.role === "admin";
  const canOpenAuditMap = isProcurementOfficer || isAdmin;
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
      ["Status", statusLabel(delivery.status)],
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

  const openConfirmDelivery = (delivery) => {
    setConfirmTarget(delivery);
    setProofImage(null);
    setLocation(null);
    setGeoError("");
    setConfirmOpen(true);
  };

  const captureLocation = () => {
    if (!navigator?.geolocation) {
      setGeoError("Geolocation is not supported by this browser.");
      return;
    }
    setGeoLoading(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: Number(position.coords.latitude),
          longitude: Number(position.coords.longitude),
          accuracy: Number(position.coords.accuracy || 0),
          capturedAt: new Date().toISOString(),
        });
        setGeoLoading(false);
      },
      (err) => {
        const msg =
          err?.code === 1
            ? "Location permission denied. Please allow location access and try again."
            : err?.code === 2
            ? "Unable to determine your location. Check GPS/network and retry."
            : err?.code === 3
            ? "Location request timed out. Please retry."
            : "Failed to capture location.";
        setGeoError(msg);
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const submitConfirmDelivery = async () => {
    if (!confirmTarget?._id) return;
    if (!location?.latitude || !location?.longitude) {
      toast.error("Capture delivery location before submitting.");
      return;
    }
    let proofImageDataUrl;
    if (proofImage) {
      try {
        proofImageDataUrl = await readFileAsDataUrl(proofImage);
      } catch {
        toast.error("Could not read proof image.");
        return;
      }
    }
    const body = {
      latitude: location.latitude,
      longitude: location.longitude,
      receivedBy: user?.fullname || user?.name || "Procurement officer",
      notes: `Geo-tagged confirmation at ${new Date(
        location.capturedAt
      ).toLocaleString("en-NP")}`,
    };
    if (proofImageDataUrl) body.proofImage = proofImageDataUrl;
    try {
      const result = await dispatch(
        confirmDelivery({ deliveryId: confirmTarget._id, body })
      ).unwrap();
      toast.success("Delivery confirmed with location");
      if (result?.delivery) {
        handleDownloadDeliveryReceiptPdf(result.delivery);
      }
      setConfirmOpen(false);
      setConfirmTarget(null);
      refresh();
      setDetail(null);
    } catch (err) {
      toast.error(err || "Failed to confirm geo-tagged delivery");
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
      let proofImage;
      if (vendorProofFile) {
        proofImage = await readFileAsDataUrl(vendorProofFile);
      }
      await dispatch(
        updateDeliveryStatus({
          deliveryId,
          status,
          note: "",
          proofImage,
        })
      ).unwrap();
      setVendorProofFile(null);
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

  const lifecycleCounts = useMemo(() => {
    let inProgress = 0;
    let awaitingReceipt = 0;
    let closed = 0;
    let rejected = 0;
    let delayed = 0;
    for (const d of deliveries) {
      const s = normalizeDeliveryStatus(d.status);
      if (
        [
          DELIVERY_STATUS.PENDING,
          DELIVERY_STATUS.ACCEPTED,
          DELIVERY_STATUS.IN_TRANSIT,
        ].includes(s)
      )
        inProgress += 1;
      if (s === DELIVERY_STATUS.READY_FOR_CONFIRMATION) awaitingReceipt += 1;
      if ([DELIVERY_STATUS.VERIFIED, DELIVERY_STATUS.INSPECTED].includes(s))
        closed += 1;
      if (s === DELIVERY_STATUS.REJECTED) rejected += 1;
      if (hasRecordedDelay(d)) delayed += 1;
    }
    return {
      all: deliveries.length,
      inProgress,
      awaitingReceipt,
      closed,
      rejected,
      delayed,
    };
  }, [deliveries]);

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((delivery) => {
      const ref = (delivery.orderReference || delivery.purchaseOrderNumber || "")
        .toLowerCase();
      const num = (delivery.deliveryNumber || "").toLowerCase();
      const vendor = (delivery.vendorName || "").toLowerCase();
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !q || ref.includes(q) || num.includes(q) || vendor.includes(q);
      if (!matchesSearch) return false;
      const s = normalizeDeliveryStatus(delivery.status);
      if (lifecycleFilter === "all") return true;
      if (lifecycleFilter === "in_progress") {
        return [
          DELIVERY_STATUS.PENDING,
          DELIVERY_STATUS.ACCEPTED,
          DELIVERY_STATUS.IN_TRANSIT,
        ].includes(s);
      }
      if (lifecycleFilter === "awaiting_receipt") {
        return s === DELIVERY_STATUS.READY_FOR_CONFIRMATION;
      }
      if (lifecycleFilter === "closed") {
        return [DELIVERY_STATUS.VERIFIED, DELIVERY_STATUS.INSPECTED].includes(s);
      }
      if (lifecycleFilter === "rejected") {
        return s === DELIVERY_STATUS.REJECTED;
      }
      if (lifecycleFilter === "delayed") {
        return hasRecordedDelay(delivery);
      }
      return true;
    });
  }, [deliveries, searchTerm, lifecycleFilter]);

  const getStatusBadge = (status) => {
    const s = normalizeDeliveryStatus(status);
    const map = {
      [DELIVERY_STATUS.PENDING]: "statusWarning",
      [DELIVERY_STATUS.ACCEPTED]: "statusNeutral",
      [DELIVERY_STATUS.IN_TRANSIT]: "statusInfo",
      [DELIVERY_STATUS.READY_FOR_CONFIRMATION]: "statusInfo",
      [DELIVERY_STATUS.VERIFIED]: "statusSuccess",
      [DELIVERY_STATUS.INSPECTED]: "statusMuted",
      [DELIVERY_STATUS.REJECTED]: "statusDanger",
    };
    const v = map[s] || "statusWarning";
    return (
      <Badge variant={v} className="whitespace-nowrap">
        {STATUS_LABELS[s] || status}
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
        {canOpenAuditMap ? (
          <Button asChild variant="outline" className="shrink-0">
            <Link to="/deliveries/audit">Delivery audit map</Link>
          </Button>
        ) : null}
        {isVendor ? (
          <div className="flex min-w-0 shrink-0 flex-col gap-1 text-xs text-slate-500">
            <label className="sr-only" htmlFor="vendor-delivery-proof">
              Optional proof image for next status update
            </label>
            <Input
              id="vendor-delivery-proof"
              type="file"
              accept="image/*"
              className="h-9 max-w-[220px] text-xs"
              onChange={(e) =>
                setVendorProofFile(e.target.files?.[0] || null)
              }
            />
          </div>
        ) : null}
      </WorkspaceToolbar>

      {!loading ? (
        <div className="mb-4 space-y-3">
          <WorkspaceSegmentedControl
            value={lifecycleFilter}
            onChange={setLifecycleFilter}
            options={[
              { value: "all", label: `All (${lifecycleCounts.all})` },
              {
                value: "in_progress",
                label: `In progress (${lifecycleCounts.inProgress})`,
              },
              {
                value: "awaiting_receipt",
                label: `Awaiting receipt (${lifecycleCounts.awaitingReceipt})`,
              },
              {
                value: "closed",
                label: `Closed (${lifecycleCounts.closed})`,
              },
              {
                value: "rejected",
                label: `Rejected (${lifecycleCounts.rejected})`,
              },
              {
                value: "delayed",
                label: `Delayed (${lifecycleCounts.delayed})`,
              },
            ]}
            className="w-full max-w-5xl flex-wrap"
          />
          {deliveries.length > 0 && filteredDeliveries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm font-medium text-slate-600">
              No deliveries match this filter or search. Try{" "}
              <button
                type="button"
                className="font-semibold text-teal-800 underline-offset-2 hover:underline"
                onClick={() => {
                  setLifecycleFilter("all");
                  setSearchTerm("");
                }}
              >
                All
              </button>{" "}
              or clear search.
            </p>
          ) : null}
        </div>
      ) : null}

      <Table className={cn(WORKSPACE_DATA_TABLE_CLASS, "table-fixed")}>
            <colgroup>
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[20%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[13%]" />
              <col className="min-w-[200px] w-[25%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-left">Delivery #</TableHead>
                <TableHead className="text-left">Order ref</TableHead>
                <TableHead className="text-left">Vendor</TableHead>
                <TableHead className="text-left">Expected</TableHead>
                <TableHead className="text-left">Actual / received</TableHead>
                <TableHead className="text-left">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <LoadingState variant="table" />
                  </TableCell>
                </TableRow>
              ) : deliveries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    No deliveries yet. Records appear after a tender or invoice payment
                    completes.
                  </TableCell>
                </TableRow>
              ) : filteredDeliveries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    No matching deliveries for this filter or search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeliveries.map((delivery) => (
                  <TableRow key={delivery._id}>
                    <TableCell className="min-w-0 truncate font-medium tabular-nums">
                      {delivery.deliveryNumber}
                    </TableCell>
                    <TableCell className="min-w-0 truncate whitespace-nowrap">
                      {delivery.orderReference || delivery.purchaseOrderNumber || "—"}
                    </TableCell>
                    <TableCell className="min-w-0">
                      <span className="line-clamp-2 break-words">{delivery.vendorName}</span>
                    </TableCell>
                    <TableCell className="min-w-0 whitespace-nowrap">
                      {formatDate(delivery.expectedDate)}
                    </TableCell>
                    <TableCell className="min-w-0 whitespace-nowrap">
                      {delivery.actualDate
                        ? formatDate(delivery.actualDate)
                        : "—"}
                    </TableCell>
                    <TableCell className="min-w-0">{getStatusBadge(delivery.status)}</TableCell>
                    <TableCell className="min-w-0 text-right align-top">
                      <div className="flex flex-col items-end gap-2 md:flex-row md:flex-wrap md:justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => openDetail(delivery)}
                        >
                          <Eye className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Details</span>
                        </Button>
                        {isVendor && nextVendorStatus(delivery.status) && (
                          <Button
                            size="sm"
                            className="shrink-0 bg-slate-900"
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
                        {isProcurementOfficer &&
                          normalizeDeliveryStatus(delivery.status) ===
                            DELIVERY_STATUS.READY_FOR_CONFIRMATION && (
                          <Button
                            size="sm"
                            className="shrink-0 bg-teal-700 shadow-none hover:bg-teal-600"
                            onClick={() => openConfirmDelivery(delivery)}
                          >
                            <CheckCircle className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Confirm receipt</span>
                          </Button>
                        )}
                        {isProcurementOfficer &&
                          normalizeDeliveryStatus(delivery.status) ===
                            DELIVERY_STATUS.VERIFIED && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0"
                              onClick={() => {
                                openDetail(delivery);
                              }}
                            >
                              Inspect
                            </Button>
                          )}
                        {isVendor &&
                          ![
                            DELIVERY_STATUS.VERIFIED,
                            DELIVERY_STATUS.INSPECTED,
                            DELIVERY_STATUS.REJECTED,
                          ].includes(normalizeDeliveryStatus(delivery.status)) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0 text-amber-800 border-amber-300"
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
                          {statusLabel(entry.status)}
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

              {isProcurementOfficer &&
                normalizeDeliveryStatus(detail.status) ===
                  DELIVERY_STATUS.READY_FOR_CONFIRMATION && (
                <Button
                  className="w-full bg-teal-700"
                  onClick={() => openConfirmDelivery(detail)}
                >
                  Confirm receipt & verification
                </Button>
              )}

              {isProcurementOfficer &&
                normalizeDeliveryStatus(detail.status) ===
                  DELIVERY_STATUS.VERIFIED && (
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
                ![
                  DELIVERY_STATUS.VERIFIED,
                  DELIVERY_STATUS.INSPECTED,
                  DELIVERY_STATUS.REJECTED,
                ].includes(normalizeDeliveryStatus(detail.status)) && (
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

              {(isProcurementOfficer || isAdmin) &&
                [DELIVERY_STATUS.VERIFIED, DELIVERY_STATUS.INSPECTED].includes(
                  normalizeDeliveryStatus(detail.status)
                ) && (
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

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) {
            setConfirmTarget(null);
            setProofImage(null);
            setLocation(null);
            setGeoError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm geo-tagged delivery</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">
              Capture location and optionally upload an image proof before
              confirming receipt.
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              {location ? (
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">Latitude:</span>{" "}
                    {location.latitude.toFixed(6)}
                  </p>
                  <p>
                    <span className="font-medium">Longitude:</span>{" "}
                    {location.longitude.toFixed(6)}
                  </p>
                  <p>
                    <span className="font-medium">Accuracy:</span>{" "}
                    {Math.round(location.accuracy)} m
                  </p>
                  <a
                    href={`https://maps.google.com/?q=${location.latitude},${location.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-700 underline"
                  >
                    Open location in map
                  </a>
                  <div className="h-44 overflow-hidden rounded-lg border border-slate-200">
                    <MapContainer
                      center={[location.latitude, location.longitude]}
                      zoom={16}
                      scrollWheelZoom={false}
                      className="h-full w-full"
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <Marker
                        position={[location.latitude, location.longitude]}
                        icon={DEFAULT_MARKER_ICON}
                      >
                        <Popup>Delivery confirmation location</Popup>
                      </Marker>
                    </MapContainer>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500">Location not captured yet.</p>
              )}
            </div>
            {geoError ? <p className="text-xs text-red-600">{geoError}</p> : null}
            <Button
              type="button"
              variant="outline"
              onClick={captureLocation}
              disabled={geoLoading}
              className="w-full"
            >
              {geoLoading ? "Capturing location..." : "Capture current location"}
            </Button>
            <div className="space-y-1">
              <Label htmlFor="delivery-proof-image">
                Proof image (optional)
              </Label>
              <Input
                id="delivery-proof-image"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setProofImage(file);
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-teal-700 hover:bg-teal-600"
              onClick={submitConfirmDelivery}
              disabled={!location || loading}
            >
              Confirm delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspacePageLayout>
  );
};

export default Deliveries;
