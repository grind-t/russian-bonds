import { writeFile } from "node:fs/promises";
import { env } from "node:process";

import { listAllRussianBonds } from "./src/index.ts";

const bonds = await listAllRussianBonds(env.T_INVEST_READONLY_TOKEN);
await writeFile("./snapshot.json", JSON.stringify(bonds, null, 2));
