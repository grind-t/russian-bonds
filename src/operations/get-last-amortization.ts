import { getMoexBondAmortizations } from "@grind-t/moex";

// the last amortization is the final repayment
export async function getLastAmortization(ticker: string) {
  const amortizations = await getMoexBondAmortizations(ticker);
  return amortizations.at(-1);
}
