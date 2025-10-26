import { z } from "zod";

export const BondSchema = z.object({
	isin: z.string(),
	name: z.string(),
	maturityDate: z.coerce.date().optional(),
	yield: z.object({
		effective: z.number().optional(),
		prevWAPrice: z.number().optional(),
	}),
	rating: z.object({
		tInvest: z.number().optional(),
		AKRA: z.number().optional(),
		NKR: z.number().optional(),
		EXPERT_RA: z.number().optional(),
		NRA: z.number().optional(),
	}),
	nominal: z.number().optional(),
	currency: z.string(),
	sector: z.string(),
	emitent: z.object({ id: z.string(), inn: z.string() }).optional(),
	isFloater: z.boolean(),
	hasAmortization: z.boolean(),
	hasOffer: z.boolean(),
	forQual: z.boolean(),
});

export type Bond = z.infer<typeof BondSchema>;
