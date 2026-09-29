export function getQuantityByPayment(payment: number, faceValueRub: number): number {
  const quantity = payment / faceValueRub;
  if (quantity <= 0 || !Number.isInteger(quantity))
    throw new Error("Abnormal full repayment quantity");
  return quantity;
}
