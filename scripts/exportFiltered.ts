import { resolve } from "node:path";
import { ratingScale } from "@grind-t/cbr-ratings";
import dayjs from "dayjs";
import { fs } from "zx";
import type { BondList } from "../src/types.ts";

const EXPORTS_DIR = resolve(import.meta.dirname, "..", "exports");
const BBBP_RATING = ratingScale.indexOf("BBB+");

const bonds = (await fs.readJSON(
  resolve(EXPORTS_DIR, "bonds.json"),
)) as BondList;

const filteredBonds = bonds.filter(
  (bond) =>
    !bond.forQual &&
    !bond.hasOffer &&
    !bond.hasAmortization &&
    !!bond.maturityDate &&
    dayjs(bond.maturityDate).isAfter(dayjs().add(2, "month")) &&
    dayjs(bond.maturityDate).isBefore(dayjs().add(2, "years")) &&
    bond.sector !== "real_estate" &&
    (bond.rating.tInvest ?? Infinity) > 0 &&
    (bond.rating.AKRA ?? Infinity) > BBBP_RATING &&
    (bond.rating.NKR ?? Infinity) > BBBP_RATING &&
    (bond.rating.EXPERT_RA ?? Infinity) > BBBP_RATING &&
    (bond.rating.NRA ?? Infinity) > BBBP_RATING,
);

fs.outputJSON(resolve(EXPORTS_DIR, "bonds.filtered.json"), filteredBonds, {
  spaces: "\t",
});
