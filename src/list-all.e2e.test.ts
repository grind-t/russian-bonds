import assert from "node:assert/strict";
import { env } from "node:process";
import { it } from "node:test";

import z from "zod";

import { listAllRussianBonds } from "./list-all.ts";
import { BondListSchema } from "./types.ts";

it("bonds match schema", async () => {
  const bonds = await listAllRussianBonds(env.T_INVEST_READONLY_TOKEN);
  const { success, error } = BondListSchema.safeParse(bonds);

  assert.ok(success, error && z.prettifyError(error));
});
