import { type KRA, ratingValueToNumber } from "@grind-t/cbr-ratings";
import {
  getMoexBondSecurities,
  getMoexBonds,
  getMoexBondsMarketData,
  getMoexBondsMarketYield,
} from "@grind-t/moex";
import { TInvestApi, tInvestDate, tInvestNumber } from "@grind-t/t-invest";
import { toRecord } from "@grind-t/toolkit/array";
import { brotliJson } from "@grind-t/toolkit/stream";

import type { Bond, BondList } from "./types.ts";

const bondRatingsUrl =
  "https://raw.githubusercontent.com/grind-t/cbr-ratings/refs/heads/main/exports/bonds.json.br";
const issuerRatingsUrl =
  "https://raw.githubusercontent.com/grind-t/cbr-ratings/refs/heads/main/exports/issuers.json.br";
const ifrsRatingsUrl =
  "https://raw.githubusercontent.com/grind-t/e-disclosure/refs/heads/main/exports/ratings.json.br";

export async function listAllRussianBonds(tInvestApiToken: string): Promise<BondList> {
  const tInvestApi = new TInvestApi(tInvestApiToken);

  const [
    bonds,
    moexSecurities,
    moexBonds,
    moexMarketData,
    moexMarketYields,
    ratingsByBond,
    ratingsByIssuer,
    ifrsRatingByIssuer,
  ] = await Promise.all([
    tInvestApi.instruments.bonds({}).then((v) => v.instruments),
    getMoexBondSecurities().then((v) => toRecord(v, (v) => v.isin)),
    getMoexBonds().then((v) => toRecord(v, (v) => v.ISIN)),
    getMoexBondsMarketData().then((v) => toRecord(v, (v) => v.SECID)),
    getMoexBondsMarketYield().then((v) => toRecord(v, (v) => v.SECID)),
    fetch(bondRatingsUrl).then(brotliJson),
    fetch(issuerRatingsUrl).then(brotliJson),
    fetch(ifrsRatingsUrl).then(brotliJson),
  ]);

  return bonds.reduce((acc: Bond[], bond) => {
    if (!bond.buyAvailableFlag || !bond.apiTradeAvailableFlag) {
      return acc;
    }

    const moexSecurity = moexSecurities[bond.isin];
    const moexBond = moexBonds[bond.isin];

    const marketYield = moexMarketData[bond.isin]?.YIELD;
    const marketYieldFallback = moexBond?.YIELDATPREVWAPRICE;
    const marketEffectiveYield = moexMarketYields[bond.isin]?.EFFECTIVEYIELD;
    const ytm = marketYield || marketYieldFallback || undefined;
    const eytm = marketEffectiveYield ? Math.round(marketEffectiveYield * 100) / 100 : undefined;
    const hasOffer = !!moexBond.OFFERDATE;

    if (!ytm && !eytm) {
      return acc;
    }

    const issuerInn = moexSecurity?.emitent_inn;

    const bondRatings = ratingsByBond[bond.isin];
    const issuerRatings = ratingsByIssuer[issuerInn];

    const getKRARating = (kra: KRA) => {
      const bondRating = bondRatings?.[kra]?.ratingValue;
      const issuerRating = issuerRatings?.[kra]?.ratingValue;
      const rating = bondRating || issuerRating;
      return rating ? ratingValueToNumber(rating) : undefined;
    };

    acc.push({
      isin: bond.isin,
      name: bond.name,
      maturityDate: bond.maturityDate && tInvestDate(bond.maturityDate),
      ytm,
      eytm,
      rating: {
        tInvest: bond.riskLevel < 1 ? undefined : 3 - bond.riskLevel,
        AKRA: getKRARating("AKRA"),
        NKR: getKRARating("NKR"),
        EXPERT_RA: getKRARating("EXPERT_RA"),
        NRA: getKRARating("NRA"),
        IFRS: ifrsRatingByIssuer[issuerInn],
      },
      nominal: bond.nominal && tInvestNumber(bond.nominal),
      currency: bond.nominal?.currency ?? bond.currency,
      sector: bond.sector,
      issuerInn,
      isFloater: bond.floatingCouponFlag,
      hasAmortization: bond.amortizationFlag,
      hasOffer,
      forQual: bond.forQualInvestorFlag,
    });

    return acc;
  }, []);
}
