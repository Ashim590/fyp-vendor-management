import { normalizeDeliveryStatus } from "../constants/deliveryWorkflow";

/** Normalize legacy status strings in API responses (lean docs skip Mongoose pre-validate). */
export function serializeDeliveryLean<T extends Record<string, unknown>>(d: T): T {
  if (!d || typeof d !== "object") return d;
  const out = { ...d } as Record<string, unknown>;
  if (typeof out.status === "string") {
    out.status = normalizeDeliveryStatus(out.status);
  }
  if (typeof out.deliveryStatus === "string") {
    out.deliveryStatus = normalizeDeliveryStatus(out.deliveryStatus);
  }
  return out as T;
}
