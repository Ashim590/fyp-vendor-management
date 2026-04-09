/**
 * Staff-side quotation comparison: rank bids and flag lowest price, fastest delivery, suggested best value.
 */

export type ComparisonInput = {
  bidId: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  deliveryDaysOffer?: number;
  rating: number;
  preferredSupplier: boolean;
  status: string;
};

export type ComparisonRow = ComparisonInput & {
  valueScore: number;
  flags: {
    lowestPrice: boolean;
    fastestDelivery: boolean;
    suggestedBestValue: boolean;
  };
};

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function buildQuotationComparison(rows: ComparisonInput[]): ComparisonRow[] {
  if (rows.length === 0) return [];

  const amounts = rows.map((r) => r.amount);
  const minA = Math.min(...amounts);
  const maxA = Math.max(...amounts);

  const withDelivery = rows.filter(
    (r) => r.deliveryDaysOffer != null && Number.isFinite(r.deliveryDaysOffer),
  ) as Array<ComparisonInput & { deliveryDaysOffer: number }>;
  let minD = 0;
  let maxD = 0;
  if (withDelivery.length > 0) {
    const ds = withDelivery.map((r) => r.deliveryDaysOffer);
    minD = Math.min(...ds);
    maxD = Math.max(...ds);
  }

  const scored = rows.map((r) => {
    const priceScore =
      maxA === minA ? 1 : (maxA - r.amount) / (maxA - minA);

    let deliveryScore = 0.5;
    if (
      r.deliveryDaysOffer != null &&
      Number.isFinite(r.deliveryDaysOffer) &&
      withDelivery.length > 1 &&
      maxD > minD
    ) {
      deliveryScore = (maxD - r.deliveryDaysOffer) / (maxD - minD);
    } else if (
      r.deliveryDaysOffer != null &&
      Number.isFinite(r.deliveryDaysOffer) &&
      withDelivery.length === 1
    ) {
      deliveryScore = 1;
    }

    const ratingScore = clamp01((r.rating || 0) / 5);
    const preferredBonus = r.preferredSupplier ? 0.05 : 0;
    const valueScore =
      0.45 * clamp01(priceScore) +
      0.25 * clamp01(deliveryScore) +
      0.25 * ratingScore +
      preferredBonus;

    return { ...r, valueScore, flags: {
      lowestPrice: false,
      fastestDelivery: false,
      suggestedBestValue: false,
    } };
  });

  const bestPriceIds = new Set(
    scored.filter((s) => s.amount === minA).map((s) => s.bidId),
  );

  const fastestIds = new Set<string>();
  if (withDelivery.length > 0) {
    const fastestVal = Math.min(
      ...withDelivery.map((w) => w.deliveryDaysOffer),
    );
    for (const s of scored) {
      if (s.deliveryDaysOffer === fastestVal) fastestIds.add(s.bidId);
    }
  }

  let bestValueId = scored[0].bidId;
  let bestVal = scored[0].valueScore;
  for (const s of scored) {
    if (s.valueScore > bestVal) {
      bestVal = s.valueScore;
      bestValueId = s.bidId;
    }
  }

  return scored.map((s) => ({
    ...s,
    flags: {
      lowestPrice: bestPriceIds.has(s.bidId),
      fastestDelivery: fastestIds.has(s.bidId),
      suggestedBestValue: s.bidId === bestValueId,
    },
  }));
}
