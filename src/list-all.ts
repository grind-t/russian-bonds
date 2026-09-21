import { convertPrediction, type Kra, ratingValueToNumber } from "@grind-t/cbr-ratings";
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
    getMoexBondSecurities(),
    getMoexBonds(),
    getMoexBondsMarketData(),
    getMoexBondsMarketYield(),
    fetch(bondRatingsUrl).then(brotliJson),
    fetch(issuerRatingsUrl).then(brotliJson),
    fetch(ifrsRatingsUrl).then(brotliJson),
  ]);

  const moexSecurityByIsin = toRecord(moexSecurities, (v) => v.isin);
  const moexBondBySecId = Object.groupBy(moexBonds, (v) => v.SECID);
  const moexMarketDataBySecId = Object.groupBy(moexMarketData, (v) => v.SECID);
  const moexMarketYieldBySecId = Object.groupBy(moexMarketYields, (v) => v.SECID);

  return bonds.reduce((acc: Bond[], bond) => {
    if (!bond.buyAvailableFlag || !bond.apiTradeAvailableFlag) {
      return acc;
    }

    const moexSecurity = moexSecurityByIsin[bond.isin];

    if (!moexSecurity) {
      const isSPBExchange = bond.classCode.startsWith("SPB") || bond.classCode.startsWith("PS");
      if (!isSPBExchange) console.warn(`Missing moex data for bond ${bond.isin}`);
      return acc;
    }

    const { secid: secId, primary_boardid: boardId } = moexSecurity;
    const moexBond = moexBondBySecId[secId]?.find((v) => v.BOARDID === boardId);
    const marketData = moexMarketDataBySecId[secId]?.find((v) => v.BOARDID === boardId);
    const marketYield = moexMarketYieldBySecId[secId]?.find((v) => v.BOARDID === boardId);

    const isOfz = moexSecurity.type === "ofz_bond";
    const isFloater = bond.floatingCouponFlag;
    const hasOffer = !!moexBond?.CALLOPTIONDATE || !!moexBond?.PUTOPTIONDATE || !!bond.callDate;
    const ytm =
      (hasOffer && marketData?.YIELDTOOFFER) ||
      (isOfz && isFloater && marketYield?.EFFECTIVEYIELD) ||
      marketData?.YIELD ||
      marketData?.YIELDATWAPRICE ||
      moexBond?.YIELDATPREVWAPRICE ||
      undefined;

    const issuerInn = moexSecurity.emitent_inn;
    const bondRatings = ratingsByBond[bond.isin];
    const issuerRatings = ratingsByIssuer[issuerInn];

    const getKRARating = (kra: Kra) => {
      const bondRating = bondRatings?.[kra]?.ratingValue;
      const issuerRating = issuerRatings?.[kra]?.ratingValue;
      const rating = bondRating || issuerRating;
      return rating ? ratingValueToNumber(rating) : undefined;
    };

    const getKRAPrediction = (kra: Kra) => {
      const bondPrediction = bondRatings?.[kra]?.prediction;
      const issuerPrediction = issuerRatings?.[kra]?.prediction;
      return convertPrediction(bondPrediction || issuerPrediction) || undefined;
    };

    acc.push({
      isin: bond.isin,
      name: bond.name,
      maturityDate: tInvestDate(bond.maturityDate) ?? undefined,
      ytm,
      rating: {
        tInvest: bond.riskLevel < 1 ? undefined : 3 - bond.riskLevel,
        AKRA: getKRARating("AKRA"),
        NKR: getKRARating("NKR"),
        EXPERT_RA: getKRARating("EXPERT_RA"),
        NRA: getKRARating("NRA"),
        IFRS: ifrsRatingByIssuer[issuerInn]?.value,
      },
      prediction: {
        AKRA: getKRAPrediction("AKRA"),
        NKR: getKRAPrediction("NKR"),
        EXPERT_RA: getKRAPrediction("EXPERT_RA"),
        NRA: getKRAPrediction("NRA"),
        IFRS: ifrsRatingByIssuer[issuerInn]?.outlook,
      },
      nominal: tInvestNumber(bond.nominal) ?? undefined,
      currency: bond.nominal?.currency ?? bond.currency,
      sector: bond.sector,
      issuerInn,
      isFloater,
      hasAmortization: bond.amortizationFlag,
      hasOffer,
      forQual: bond.forQualInvestorFlag,
    });

    return acc;
  }, []);
}
