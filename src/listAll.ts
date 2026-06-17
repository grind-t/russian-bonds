import { type KRA, ratingValueToNumber } from "@grind-t/cbr-ratings";
import {
	getMoexBondSecurities,
	getMoexBonds,
	getMoexBondsMarketData,
	getMoexBondsMarketYield,
} from "@grind-t/moex";
import { TInvestApi, tInvestDate, tInvestNumber } from "@grind-t/t-invest";
import { toRecord } from "@grind-t/toolkit/array";
import retry from "p-retry";
import type { Bond, BondList } from "./types.ts";

const cbrBondRatingsUrl =
	"https://raw.githubusercontent.com/grind-t/cbr-ratings/refs/heads/main/exports/bond-ratings.json";
const cbrBondCompanyRaringsUrl =
	"https://raw.githubusercontent.com/grind-t/cbr-ratings/refs/heads/main/exports/bond-company-ratings.json";

export async function listAllRussianBonds(
	tInvestApiToken: string,
): Promise<BondList> {
	const tInvestApi = new TInvestApi(tInvestApiToken);

	const [
		bonds,
		moexSecurities,
		moexBonds,
		moexMarketData,
		moexMarketYields,
		bondRatings,
		bondCompanyRatings,
	] = await Promise.all([
		tInvestApi.instruments.bonds({}).then((v) => v.instruments),
		getMoexBondSecurities().then((v) => toRecord(v, (v) => v.isin)),
		getMoexBonds().then((v) => toRecord(v, (v) => v.ISIN)),
		getMoexBondsMarketData().then((v) => toRecord(v, (v) => v.SECID)),
		getMoexBondsMarketYield().then((v) => toRecord(v, (v) => v.SECID)),
		retry(() => fetch(cbrBondRatingsUrl).then((v) => v.json())),
		retry(() => fetch(cbrBondCompanyRaringsUrl).then((v) => v.json())),
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
		const eytm = marketEffectiveYield
			? Math.round(marketEffectiveYield * 100) / 100
			: undefined;

		if (!ytm && !eytm) {
			return acc;
		}

		const emitentId = moexSecurity?.emitent_id.toString();
		const emitentInn = moexSecurity?.emitent_inn;

		const ratings = bondRatings[bond.isin];
		const companyRatings = bondCompanyRatings[emitentInn];
		const getKRARating = (kra: KRA) => {
			const bondRating = ratings?.[kra]?.ratingValue;
			const companyRating = companyRatings?.[kra]?.ratingValue;
			const rating = bondRating || companyRating;
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
			},
			nominal: bond.nominal && tInvestNumber(bond.nominal),
			currency: bond.nominal?.currency ?? bond.currency,
			sector: bond.sector,
			emitent: emitentId
				? {
						id: emitentId,
						inn: emitentInn,
					}
				: undefined,
			isFloater: bond.floatingCouponFlag,
			hasAmortization: bond.amortizationFlag,
			hasOffer: !!bond.callDate,
			forQual: bond.forQualInvestorFlag,
		});

		return acc;
	}, []);
}
