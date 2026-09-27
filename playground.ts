import { env } from "node:process";

import { cache, preview } from "@grind-t/analytics";
import { TInvestApi } from "@grind-t/t-invest";
import { xirr } from "@webcarrot/xirr";
import dayjs from "dayjs";

import { getAccountBondCashFlows } from "./src/index.ts";

const tInvestApi = new TInvestApi(env.T_INVEST_READONLY_TOKEN);
const accountId = env.T_INVEST_ACCOUNT_ID;

const rows = await cache("t-invest-bond-cash-flows", () =>
  getAccountBondCashFlows(tInvestApi, accountId, dayjs().subtract(2, "year").toDate()),
);

console.log("XIRR:", xirr(rows.map((row) => ({ amount: row.value, date: row.date }))));

void preview(
  rows.sort((a, b) => a.ticker.localeCompare(b.ticker) || a.date.getTime() - b.date.getTime()),
);
