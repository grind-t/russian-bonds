import assert from "node:assert/strict";
import { it } from "node:test";
import { BondSchema } from "./bond.ts";
import { resolve } from "node:path";
import { fs } from "zx";
import z from "zod";

const OutputSchema = z.array(BondSchema);

it("exports/bonds.json entries match schema", async () => {
	const fileUrl = resolve(import.meta.dirname, "..", "exports", "bonds.json");
	const bonds = await fs.readJson(fileUrl);
	const result = OutputSchema.safeParse(bonds);

	assert.ok(result.success, result.error);
});
