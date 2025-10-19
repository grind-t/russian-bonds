import assert from "node:assert/strict";
import { it } from "node:test";
import { add } from "./index.ts";

it("should add two numbers correctly", () => {
	assert.strictEqual(add(1, 2), 3);
});
