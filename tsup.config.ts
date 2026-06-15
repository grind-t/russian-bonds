import { defineConfig } from "tsup";

export default defineConfig({
	name: "@grind-t/russian-bonds",
	entry: ["src/index.ts"],
	outDir: "dist",
	format: ["esm", "cjs"],
	experimentalDts: true,
	clean: true,
});
