import { resolve } from "node:path";
import { env } from "node:process";
import { fs } from "zx";
import { listAllRussianBonds } from "../src/listAll.ts";

const bonds = await listAllRussianBonds(env.T_INVEST_READONLY_TOKEN);

fs.outputJSON(
	resolve(import.meta.dirname, "..", "exports", "bonds.json"),
	bonds,
	{ spaces: "\t" },
);
