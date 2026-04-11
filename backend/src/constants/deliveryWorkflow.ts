/** Canonical delivery lifecycle for geo audit (stored in MongoDB as uppercase). */
export const DELIVERY_STATUS = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  IN_TRANSIT: "IN_TRANSIT",
  READY_FOR_CONFIRMATION: "READY_FOR_CONFIRMATION",
  VERIFIED: "VERIFIED",
  INSPECTED: "INSPECTED",
  REJECTED: "REJECTED",
} as const;

export type DeliveryWorkflowStatus =
  (typeof DELIVERY_STATUS)[keyof typeof DELIVERY_STATUS];

/** Map legacy lowercase statuses from older records to canonical values. */
export const LEGACY_DELIVERY_STATUS_MAP: Record<string, DeliveryWorkflowStatus> = {
  pending: DELIVERY_STATUS.PENDING,
  shipped: DELIVERY_STATUS.ACCEPTED,
  in_transit: DELIVERY_STATUS.IN_TRANSIT,
  delivered: DELIVERY_STATUS.READY_FOR_CONFIRMATION,
  received: DELIVERY_STATUS.VERIFIED,
  inspected: DELIVERY_STATUS.INSPECTED,
  rejected: DELIVERY_STATUS.REJECTED,
};

const CANONICAL = new Set<string>(Object.values(DELIVERY_STATUS));

export function normalizeDeliveryStatus(
  status: string | undefined | null,
): DeliveryWorkflowStatus {
  if (!status) return DELIVERY_STATUS.PENDING;
  const mapped = LEGACY_DELIVERY_STATUS_MAP[status];
  if (mapped) return mapped;
  if (CANONICAL.has(status)) return status as DeliveryWorkflowStatus;
  return DELIVERY_STATUS.PENDING;
}

/** Allowed PATCH transitions: from -> to[] */
export const DELIVERY_PATCH_FORWARD: Record<
  DeliveryWorkflowStatus,
  DeliveryWorkflowStatus[]
> = {
  PENDING: [DELIVERY_STATUS.ACCEPTED, DELIVERY_STATUS.REJECTED],
  ACCEPTED: [DELIVERY_STATUS.IN_TRANSIT, DELIVERY_STATUS.REJECTED],
  IN_TRANSIT: [
    DELIVERY_STATUS.READY_FOR_CONFIRMATION,
    DELIVERY_STATUS.REJECTED,
  ],
  READY_FOR_CONFIRMATION: [],
  VERIFIED: [DELIVERY_STATUS.INSPECTED],
  INSPECTED: [],
  REJECTED: [],
};

/** True when procurement may run geo confirmation (canonical or legacy `delivered`). */
export function canProcurementGeoConfirm(status: string | undefined | null): boolean {
  if (!status) return false;
  if (status === "delivered") return true;
  return normalizeDeliveryStatus(status) === DELIVERY_STATUS.READY_FOR_CONFIRMATION;
}
