/** Canonical statuses (API returns normalized uppercase; legacy lowercase still accepted). */
export const DELIVERY_STATUS = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  IN_TRANSIT: "IN_TRANSIT",
  READY_FOR_CONFIRMATION: "READY_FOR_CONFIRMATION",
  VERIFIED: "VERIFIED",
  INSPECTED: "INSPECTED",
  REJECTED: "REJECTED",
};

const LEGACY_MAP = {
  pending: DELIVERY_STATUS.PENDING,
  shipped: DELIVERY_STATUS.ACCEPTED,
  in_transit: DELIVERY_STATUS.IN_TRANSIT,
  delivered: DELIVERY_STATUS.READY_FOR_CONFIRMATION,
  received: DELIVERY_STATUS.VERIFIED,
  inspected: DELIVERY_STATUS.INSPECTED,
  rejected: DELIVERY_STATUS.REJECTED,
};

export function normalizeDeliveryStatus(status) {
  if (!status) return DELIVERY_STATUS.PENDING;
  return LEGACY_MAP[status] || status;
}

export const STATUS_LABELS = {
  [DELIVERY_STATUS.PENDING]: "Pending",
  [DELIVERY_STATUS.ACCEPTED]: "Accepted",
  [DELIVERY_STATUS.IN_TRANSIT]: "In transit",
  [DELIVERY_STATUS.READY_FOR_CONFIRMATION]: "Ready for confirmation",
  [DELIVERY_STATUS.VERIFIED]: "Verified (GPS)",
  [DELIVERY_STATUS.INSPECTED]: "Inspected",
  [DELIVERY_STATUS.REJECTED]: "Rejected",
};

export function statusLabel(status) {
  const k = normalizeDeliveryStatus(status);
  return STATUS_LABELS[k] || status || "—";
}
