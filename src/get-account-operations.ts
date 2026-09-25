import { TInvestApi } from "@grind-t/t-invest";

export async function getAccountBondOperations(
  tInvestApiToken: string,
  accountId: string,
  from?: Date,
  to?: Date,
) {
  const tInvestApi = new TInvestApi(tInvestApiToken);

  const items = [];
  let cursor: string | undefined;
  do {
    const res = await tInvestApi.operations.getOperationsByCursor({
      accountId,
      from: from && { seconds: BigInt(Math.floor(from.getTime() / 1000)) },
      to: to && { seconds: BigInt(Math.floor(to.getTime() / 1000)) },
      cursor,
      limit: 1000, // API maximum
      operationTypes: [],
    });
    items.push(...res.items);
    cursor = res.hasNext ? res.nextCursor : undefined;
  } while (cursor);

  // API has no instrument type filter, so bonds are picked client-side
  return items.filter((op) => op.instrumentType === "bond");
}
