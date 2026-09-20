import { mkdir, writeFile } from "node:fs/promises";
import { env } from "node:process";

import {
  getMoexBondSecurities,
  getMoexBonds,
  getMoexBondsMarketData,
  getMoexBondsMarketYield,
} from "@grind-t/moex";
import { type Bond, type Rating, TInvestApi, tInvestDate, tInvestNumber } from "@grind-t/t-invest";

function flattenRatings(ratings: Rating[]) {
  const flat: Record<string, string | boolean | ReturnType<typeof tInvestDate>> = {};
  ratings.forEach((rating, i) => {
    const n = i + 1;
    flat[`rating${n}AgencyName`] = rating.agencyName;
    flat[`rating${n}RatingLevel`] = rating.ratingLevel;
    flat[`rating${n}RatingDate`] = tInvestDate(rating.ratingDate);
    flat[`rating${n}Forecast`] = rating.forecast;
    flat[`rating${n}IsUnderWatch`] = rating.isUnderWatch;
  });
  return flat;
}

function normalizeBond(bond: Bond) {
  return {
    ...bond,
    klong: tInvestNumber(bond.klong),
    kshort: tInvestNumber(bond.kshort),
    dlong: tInvestNumber(bond.dlong),
    dshort: tInvestNumber(bond.dshort),
    dlongMin: tInvestNumber(bond.dlongMin),
    dshortMin: tInvestNumber(bond.dshortMin),
    dlongClient: tInvestNumber(bond.dlongClient),
    dshortClient: tInvestNumber(bond.dshortClient),
    minPriceIncrement: tInvestNumber(bond.minPriceIncrement),
    nominal: tInvestNumber(bond.nominal),
    nominalCurrency: bond.nominal?.currency,
    initialNominal: tInvestNumber(bond.initialNominal),
    initialNominalCurrency: bond.initialNominal?.currency,
    placementPrice: tInvestNumber(bond.placementPrice),
    aciValue: tInvestNumber(bond.aciValue),
    maturityDate: tInvestDate(bond.maturityDate),
    stateRegDate: tInvestDate(bond.stateRegDate),
    placementDate: tInvestDate(bond.placementDate),
    first1minCandleDate: tInvestDate(bond.first1minCandleDate),
    first1dayCandleDate: tInvestDate(bond.first1dayCandleDate),
    callDate: tInvestDate(bond.callDate),
    issueSize: Number(bond.issueSize),
    issueSizePlan: Number(bond.issueSizePlan),
    requiredTests: bond.requiredTests.join(","),
    brand: undefined,
    brandLogoName: bond.brand?.logoName,
    brandLogoBaseColor: bond.brand?.logoBaseColor,
    brandTextColor: bond.brand?.textColor,
    ratings: undefined,
    ...flattenRatings(bond.ratings),
  };
}

const tInvestApi = new TInvestApi(env.T_INVEST_READONLY_TOKEN);

const [bonds, moexSecurities, moexBonds, moexMarketData, moexMarketYields] = await Promise.all([
  tInvestApi.instruments.bonds({}).then((v) => v.instruments),
  getMoexBondSecurities(),
  getMoexBonds(),
  getMoexBondsMarketData(),
  getMoexBondsMarketYield(),
]);

await mkdir("exports", { recursive: true });

await Promise.all([
  writeFile("exports/bonds.json", JSON.stringify(bonds.map(normalizeBond), null, 2)),
  writeFile("exports/moex-securities.json", JSON.stringify(moexSecurities, null, 2)),
  writeFile("exports/moex-bonds.json", JSON.stringify(moexBonds, null, 2)),
  writeFile("exports/moex-market-data.json", JSON.stringify(moexMarketData, null, 2)),
  writeFile("exports/moex-market-yields.json", JSON.stringify(moexMarketYields, null, 2)),
]);
