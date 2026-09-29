import { getMoexBonds } from "@grind-t/moex";
import { type TInvestApi, tInvestDate, tInvestNumber } from "@grind-t/t-invest";
import { assertTruthy } from "@grind-t/toolkit/boolean";
import * as v from "valibot";

import { getAccountBonds } from "../get-account-bonds.ts";
import { getAccountBondOperations } from "./get-account-operations.ts";
import { getLastAmortization } from "./get-last-amortization.ts";
import { getNetQuantitiesByTicker } from "./get-net-quantities-by-ticker.ts";
import { getQuantityByPayment } from "./get-quantity-by-payment.ts";
import { BOND_REPAYMENT_FULL } from "./quantity-delta.ts";

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
                v.transform((value) => tInvestNumber(value)),
              ),
              quantityDone: v.pipe(v.bigint(), v.transform(Number)),
              date: v.pipe(
                v.nonNullish(v.any()),
                v.transform((value) => tInvestDate(value)),
              ),
            }),
          ),
        )
        .map((op) => ({ ...op, virtual: false })),
    ),
    getAccountBonds(tInvestApi, accountId).then((positions) =>
      positions
        .map(
          v.parser(
            v.object({
              ticker: v.string(),
              quantity: v.pipe(
                v.nonNullish(v.any()),
                v.transform((value) => tInvestNumber(value)),
              ),
              currentNkd: v.pipe(
                v.nonNullish(v.any()),
                v.transform((value) => tInvestNumber(value)),
              ),
              currentPrice: v.pipe(
                v.nonNullish(v.any()),
                v.transform((value) => tInvestNumber(value)),
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

  const operations = [...executedOperations, ...virtualOperations];

  const { 0: repaymentOperations = [], 1: restOperations = [] } = Object.groupBy(
    operations,
    (op) => (op.type === BOND_REPAYMENT_FULL ? 0 : 1),
  );

  for (const op of repaymentOperations) {
    const amortization = await getLastAmortization(op.ticker);
    assertTruthy(amortization);
    nominalByTicker.set(op.ticker, { value: amortization.facevalue, unit: amortization.faceunit });
    // full repayment comes with zero quantity, so derive it from the payment,
    // which is in rubles even for currency bonds
    op.quantityDone = getQuantityByPayment(op.payment, amortization.value_rub);
  }

  for (const op of restOperations) {
    if (nominalByTicker.has(op.ticker)) continue;
    const amortization = await getLastAmortization(op.ticker);
    assertTruthy(amortization);
    nominalByTicker.set(op.ticker, { value: amortization.facevalue, unit: amortization.faceunit });
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
