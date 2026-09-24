export interface Economics {
	/** Household consumption, kWh per year. */
	consumption: number;
	/** Grid electricity price, EUR per kWh. */
	electricityPrice: number;
	/** Feed-in tariff for surplus energy, EUR per kWh. */
	feedInTariff: number;
	/** Inverter, mounting, installation etc., EUR per kWp. */
	otherCostsPerKwp: number;
	battery: { enabled: boolean; capacity: number; price: number };
}

export const DEFAULT_ECONOMICS: Economics = {
	consumption: 4000,
	electricityPrice: 0.35,
	feedInTariff: 0.078,
	otherCostsPerKwp: 800,
	battery: { enabled: false, capacity: 10, price: 6000 }
};

/** Typical annual consumption of a house without electric heating, by number of residents. */
export const HOUSEHOLD_PRESETS = [1500, 2500, 3500, 4250, 5000] as const;

export interface EconomicsResult {
	production: number;
	selfUse: number;
	feedIn: number;
	/** Share of the household demand covered by the PV system, 0–1. */
	autarky: number;
	/** Share of the production used on site, 0–1. */
	selfConsumption: number;
	savings: number;
	feedInRevenue: number;
	annualBenefit: number;
	investment: number;
	/** Simple payback in years, Infinity if the system never pays back. */
	payback: number;
	/** Benefit over the lifetime minus investment. */
	lifetimeValue: number;
	lifetimeYears: number;
}

/** Share of the overlap between production and demand that is used directly (no storage). */
const DIRECT_SHARE = 0.3;
const BATTERY_CYCLES_PER_YEAR = 250;
const BATTERY_EFFICIENCY = 0.9;
const DEGRADATION = 0.005;
const LIFETIME_YEARS = 20;

/**
 * Deliberately simple annual energy balance, in line with common rules of thumb (HTW Berlin):
 * about 30 % direct self-consumption, plus what a battery can shift at ~250 full cycles a year.
 * Prices are held constant; modules lose 0.5 % output per year.
 */
export function computeEconomics(
	production: number,
	kwp: number,
	moduleCost: number,
	economics: Economics
): EconomicsResult {
	const { consumption, electricityPrice, feedInTariff, otherCostsPerKwp, battery } = economics;
	const direct = Math.min(production, consumption) * DIRECT_SHARE;

	let fromBattery = 0;
	if (battery.enabled && battery.capacity > 0) {
		const shiftable = battery.capacity * BATTERY_CYCLES_PER_YEAR * BATTERY_EFFICIENCY;
		const surplus = (production - direct) * BATTERY_EFFICIENCY;
		fromBattery = Math.max(0, Math.min(shiftable, surplus, consumption - direct));
	}

	const selfUse = direct + fromBattery;
	const feedIn = Math.max(0, production - direct - fromBattery / BATTERY_EFFICIENCY);
	const savings = selfUse * electricityPrice;
	const feedInRevenue = feedIn * feedInTariff;
	const annualBenefit = savings + feedInRevenue;
	const investment = moduleCost + kwp * otherCostsPerKwp + (battery.enabled ? battery.price : 0);

	let lifetimeBenefit = 0;
	for (let year = 0; year < LIFETIME_YEARS; year++) {
		lifetimeBenefit += annualBenefit * (1 - DEGRADATION) ** year;
	}

	return {
		production,
		selfUse,
		feedIn,
		autarky: consumption > 0 ? selfUse / consumption : 0,
		selfConsumption: production > 0 ? selfUse / production : 0,
		savings,
		feedInRevenue,
		annualBenefit,
		investment,
		payback: annualBenefit > 0 ? investment / annualBenefit : Infinity,
		lifetimeValue: lifetimeBenefit - investment,
		lifetimeYears: LIFETIME_YEARS
	};
}
