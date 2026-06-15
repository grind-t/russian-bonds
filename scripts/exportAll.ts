import { resolve } from "node:path";
import { env } from "node:process";
import { groupByKeys } from "@grind-t/toolkit/array";
import { flatten } from "flat";
import { parquetWriteFile } from "hyparquet-writer";
import { listAllRussianBonds } from "../src/listAll.ts";

const bonds = await listAllRussianBonds(env.T_INVEST_READONLY_TOKEN);
const flatBonds = bonds.map((bond) => flatten(bond, { delimiter: "_" }));
const agg = groupByKeys(flatBonds as Record<string, unknown>[]);

parquetWriteFile({
	filename: resolve(import.meta.dirname, "..", "exports", "bonds.parquet"),
	columnData: Object.entries(agg).map(([name, data]) => ({ name, data })),
});
