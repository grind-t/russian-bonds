import assert from "node:assert/strict";
import { resolve } from "node:path";
import { it } from "node:test";
import { fs } from "zx";
import { BondListSchema } from "./types.ts";

it("exports/bonds.json entries match schema", async () => {
	const fileUrl = resolve(
		import.meta.dirname,
		"..",
		"..",
		"exports",
		"bonds.json",
	);
	const bonds = await fs.readJson(fileUrl);
	const result = BondListSchema.safeParse(bonds);

	assert.ok(result.success, result.error);
});
