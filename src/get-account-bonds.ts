import type { TInvestApi } from "@grind-t/t-invest";

export async function getAccountBonds(tInvestApi: TInvestApi, accountId: string) {
  const portfolio = await tInvestApi.operations.getPortfolio({ accountId });
  return portfolio.positions.filter((pos) => pos.instrumentType === "bond");
}
