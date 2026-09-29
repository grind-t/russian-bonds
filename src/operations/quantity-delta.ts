export const BUY_TYPES = new Set([15, 16, 17, 20]); // BUY, BUY_CARD, INPUT_SECURITIES, BUY_MARGIN
export const SELL_TYPES = new Set([3, 7, 18, 22]); // OUTPUT_SECURITIES, SELL_CARD, SELL_MARGIN, SELL
export const BOND_REPAYMENT_FULL = 6;

export function quantityDelta(type: number, quantity: number): number {
  if (BUY_TYPES.has(type)) return quantity;
  if (SELL_TYPES.has(type) || type === BOND_REPAYMENT_FULL) return -quantity;
  return 0;
}
