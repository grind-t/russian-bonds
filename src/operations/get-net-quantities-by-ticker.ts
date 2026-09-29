import { quantityDelta } from "./quantity-delta.ts";

export function getNetQuantitiesByTicker(
  operations: { ticker: string; type: number; quantityDone: number }[],
): Map<string, number> {
  const netQuantities = new Map<string, number>();
  for (const { ticker, type, quantityDone } of operations) {
    netQuantities.set(ticker, (netQuantities.get(ticker) ?? 0) + quantityDelta(type, quantityDone));
  }
  return netQuantities;
}
