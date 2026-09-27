import { getMoexBondAmortizations } from "@grind-t/moex";
import { type TInvestApi, tInvestDate, tInvestNumber } from "@grind-t/t-invest";
import * as v from "valibot";

import { getAccountBonds } from "./get-account-bonds.ts";
import { getAccountBondOperations } from "./get-account-operations.ts";

export type BondCashFlow = {
  ticker: string;
  name: string;
  description: string;
  type: number;
  value: number;
  date: Date;
  virtual: boolean;
};

export const BUY_TYPES = new Set([15, 16, 17, 20]); // BUY, BUY_CARD, INPUT_SECURITIES, BUY_MARGIN
export const SELL_TYPES = new Set([3, 7, 18, 22]); // OUTPUT_SECURITIES, SELL_CARD, SELL_MARGIN, SELL
const BOND_REPAYMENT_FULL = 6;
const OPERATION_STATE_EXECUTED = 1;

export async function getAccountBondCashFlows(
  tInvestApi: TInvestApi,
  accountId: string,
  from?: Date,
  to?: Date,
): Promise<BondCashFlow[]> {
  const [operations, positions] = await Promise.all([
    getAccountBondOperations(tInvestApi, accountId, from, to),
    getAccountBonds(tInvestApi, accountId),
  ]);

  const operationSchema = v.object({
    ticker: v.string(),
    name: v.string(),
    description: v.string(),
    type: v.pipe(v.number(), v.integer()),
    payment: v.pipe(
      v.nonNullish(v.any()),
      v.transform((v) => tInvestNumber(v)),
    ),
    quantityDone: v.pipe(v.bigint(), v.transform(Number)),
    date: v.pipe(
      v.nonNullish(v.any()),
      v.transform((v) => tInvestDate(v)),
    ),
  });

  const executed = operations
    .filter((op) => op.state === OPERATION_STATE_EXECUTED)
    .map((op) => ({ ...v.parse(operationSchema, op), virtual: false }));

  const amortizationSchema = v.object({ value_rub: v.number() });

  for (const repayment of executed.filter((op) => op.type === BOND_REPAYMENT_FULL)) {
    const amortizations = await getMoexBondAmortizations(repayment.ticker);
    // the last amortization is the final repayment
    const amortization = v.parse(amortizationSchema, amortizations.at(-1));
    // full repayment comes with zero quantity, so derive it from the payment,
    // which is in rubles even for currency bonds
    repayment.quantityDone = repayment.payment / amortization.value_rub;
    if (repayment.quantityDone <= 0 || !Number.isInteger(repayment.quantityDone))
      throw new Error("Abnormal full repayment quantity");
  }

  const positionSchema = v.object({
    ticker: v.string(),
    quantity: v.pipe(
      v.nonNullish(v.any()),
      v.transform((v) => tInvestNumber(v)),
    ),
    currentNkd: v.pipe(
      v.nonNullish(v.any()),
      v.transform((v) => tInvestNumber(v)),
    ),
    currentPrice: v.pipe(
      v.nonNullish(v.any()),
      v.transform((v) => tInvestNumber(v)),
    ),
  });

  const virtual = positions.map((position) => {
    const pos = v.parse(positionSchema, position);
    return {
      ticker: pos.ticker,
      name: executed.find((op) => op.ticker === pos.ticker)?.name ?? pos.ticker,
      description: "Виртуальная продажа по рыночной цене",
      type: 22, // OPERATION_TYPE_SELL
      payment: (pos.currentPrice + pos.currentNkd) * pos.quantity,
      quantityDone: pos.quantity,
      date: new Date(),
      virtual: true,
    };
  });

  const all = [...executed, ...virtual];

  // history always ends at zero (virtual sell or full repayment), so a nonzero sum
  // means the ticker was held before the operations window
  const netQuantities = new Map<string, number>();
  for (const { ticker, type, quantityDone } of all) {
    let q = netQuantities.get(ticker) ?? 0;
    if (BUY_TYPES.has(type)) q += quantityDone;
    if (SELL_TYPES.has(type) || type === BOND_REPAYMENT_FULL) q -= quantityDone;
    netQuantities.set(ticker, q);
  }

  return all
    .filter((op) => netQuantities.get(op.ticker) === 0)
    .map((op) => ({
      ticker: op.ticker,
      name: op.name,
      description: op.description,
      type: op.type,
      value: op.payment,
      date: op.date,
      virtual: op.virtual,
    }));
}
