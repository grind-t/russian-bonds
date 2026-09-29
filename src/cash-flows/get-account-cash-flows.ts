import { getMoexBondAmortizations, getMoexBonds } from "@grind-t/moex";
import { type TInvestApi, tInvestDate, tInvestNumber } from "@grind-t/t-invest";
import * as v from "valibot";

import { getAccountBonds } from "../get-account-bonds.ts";
import { getAccountBondOperations } from "../operations/get-account-operations.ts";
import { getNetQuantitiesByTicker } from "../operations/get-net-quantities-by-ticker.ts";
import { getQuantityByPayment } from "../operations/get-quantity-by-payment.ts";
import { BOND_REPAYMENT_FULL } from "../operations/quantity-delta.ts";

export type BondCashFlow = {
  ticker: string;
  name: string;
  description: string;
  type: number;
  value: number;
  faceUnit: string;
  date: Date;
  virtual: boolean;
};

const OPERATION_STATE_EXECUTED = 1;

export async function getAccountBondCashFlows(
  tInvestApi: TInvestApi,
  accountId: string,
  from?: Date,
  to?: Date,
): Promise<BondCashFlow[]> {
  const now = new Date();

  const [executedOperations, virtualOperations, nominalByTicker] = await Promise.all([
    getAccountBondOperations(tInvestApi, accountId, from, to).then((operations) =>
      operations
        .filter((op) => op.state === OPERATION_STATE_EXECUTED)
        .map(
          v.parser(
            v.object({
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
            }),
          ),
        )
        .map((v) => ({ ...v, virtual: false })),
    ),
    getAccountBonds(tInvestApi, accountId).then((positions) =>
      positions
        .map(
          v.parser(
            v.object({
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
            }),
          ),
        )
        .map((pos) => ({
          ticker: pos.ticker,
          name: "Продажа",
          description: "Виртуальная продажа по рыночной цене",
          type: 22, // OPERATION_TYPE_SELL
          payment: (pos.currentPrice + pos.currentNkd) * pos.quantity,
          quantityDone: pos.quantity,
          date: now,
          virtual: true,
        })),
    ),
    getMoexBonds({ primary_board: 1 }).then(
      (bonds) =>
        new Map(
          bonds
            .map(
              v.parser(
                v.object({
                  SECID: v.string(),
                  FACEVALUE: v.number(),
                  FACEUNIT: v.string(),
                }),
              ),
            )
            .map((bond) => [bond.SECID, { value: bond.FACEVALUE, unit: bond.FACEUNIT }]),
        ),
    ),
  ]);

  // full repayments go first so the loop below derives their quantity
  // before an earlier operation on the same ticker fills nominalByTicker
  const operations = [...executedOperations, ...virtualOperations].sort(
    (a, b) => Number(b.type === BOND_REPAYMENT_FULL) - Number(a.type === BOND_REPAYMENT_FULL),
  );

  const amortizationSchema = v.object({
    facevalue: v.number(),
    faceunit: v.string(),
    value_rub: v.number(),
  });

  for (const op of operations) {
    if (nominalByTicker.has(op.ticker)) continue;
    const amortizations = await getMoexBondAmortizations(op.ticker);
    // the last amortization is the final repayment
    const amortization = v.parse(amortizationSchema, amortizations.at(-1));
    nominalByTicker.set(op.ticker, { value: amortization.facevalue, unit: amortization.faceunit });
    if (op.type === BOND_REPAYMENT_FULL) {
      // full repayment comes with zero quantity, so derive it from the payment,
      // which is in rubles even for currency bonds
      op.quantityDone = getQuantityByPayment(op.payment, amortization.value_rub);
    }
  }

  // history always ends at zero (virtual sell or full repayment), so a nonzero sum
  // means the ticker was held before the operations window
  const netQuantities = getNetQuantitiesByTicker(operations);

  return operations
    .filter((op) => netQuantities.get(op.ticker) === 0)
    .map((op) => ({
      ticker: op.ticker,
      name: op.name,
      description: op.description,
      type: op.type,
      value: op.payment,
      faceUnit: nominalByTicker.get(op.ticker)!.unit,
      date: op.date,
      virtual: op.virtual,
    }));
}
