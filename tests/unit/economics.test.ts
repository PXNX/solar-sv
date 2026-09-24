import { describe, expect, test } from 'bun:test';
import { computeEconomics, DEFAULT_ECONOMICS, HOUSEHOLD_PRESETS, type Economics } from '../../src/lib/solar/economics';
import { estimateYield, yieldKey } from '../../src/lib/solar/yield';

const economics = (overrides: Partial<Economics> = {}): Economics => ({
	...structuredClone(DEFAULT_ECONOMICS),
	...overrides
});

describe('computeEconomics', () => {
	test('without a battery about 30 % of the overlap is used directly', () => {
		const result = computeEconomics(8000, 8, 5000, economics({ consumption: 4000 }));
		expect(result.selfUse).toBeCloseTo(1200, 6);
		expect(result.feedIn).toBeCloseTo(6800, 6);
		expect(result.autarky).toBeCloseTo(0.3, 6);
		expect(result.selfConsumption).toBeCloseTo(0.15, 6);
	});

	test('benefit is saved grid power plus feed-in revenue', () => {
		const e = economics({ consumption: 4000, electricityPrice: 0.4, feedInTariff: 0.08 });
		const result = computeEconomics(8000, 8, 5000, e);
		expect(result.savings).toBeCloseTo(1200 * 0.4, 6);
		expect(result.feedInRevenue).toBeCloseTo(6800 * 0.08, 6);
		expect(result.annualBenefit).toBeCloseTo(result.savings + result.feedInRevenue, 6);
	});

	test('investment adds other costs per kWp and the battery price', () => {
		const e = economics({ otherCostsPerKwp: 800, battery: { enabled: true, capacity: 10, price: 6000 } });
		expect(computeEconomics(8000, 8, 5000, e).investment).toBe(5000 + 8 * 800 + 6000);
		const noBattery = economics({ otherCostsPerKwp: 800, battery: { enabled: false, capacity: 10, price: 6000 } });
		expect(computeEconomics(8000, 8, 5000, noBattery).investment).toBe(5000 + 8 * 800);
	});

	test('a battery raises self-sufficiency but never above demand', () => {
		const without = computeEconomics(8000, 8, 5000, economics({ consumption: 4000 }));
		const withBattery = computeEconomics(
			8000,
			8,
			5000,
			economics({ consumption: 4000, battery: { enabled: true, capacity: 10, price: 6000 } })
		);
		expect(withBattery.autarky).toBeGreaterThan(without.autarky);
		expect(withBattery.selfUse).toBeLessThanOrEqual(4000);
		// Losses: what the battery delivers costs more than that in feed-in.
		expect(withBattery.feedIn + withBattery.selfUse).toBeLessThan(8000);
	});

	test('payback is investment over annual benefit; no benefit never pays back', () => {
		const result = computeEconomics(8000, 8, 5000, economics());
		expect(result.payback).toBeCloseTo(result.investment / result.annualBenefit, 6);
		expect(computeEconomics(0, 0, 0, economics()).payback).toBe(Infinity);
	});

	test('lifetime value accounts for 0.5 % yearly degradation', () => {
		const result = computeEconomics(8000, 8, 5000, economics());
		let expected = 0;
		for (let year = 0; year < 20; year++) expected += result.annualBenefit * 0.995 ** year;
		expect(result.lifetimeValue).toBeCloseTo(expected - result.investment, 6);
	});

	test('household presets grow with the number of residents', () => {
		expect(HOUSEHOLD_PRESETS).toHaveLength(5);
		for (let i = 1; i < HOUSEHOLD_PRESETS.length; i++) {
			expect(HOUSEHOLD_PRESETS[i]).toBeGreaterThan(HOUSEHOLD_PRESETS[i - 1]);
		}
	});
});

describe('yield fallback', () => {
	test('south-facing mid pitch is best, north worst, facades lower', () => {
		const south = estimateYield(35, 180);
		expect(south).toBeGreaterThan(950);
		expect(south).toBeLessThan(1050);
		expect(estimateYield(35, 90)).toBeCloseTo(estimateYield(35, 270), 6);
		expect(estimateYield(35, 90)).toBeLessThan(south);
		expect(estimateYield(35, 0)).toBeLessThan(estimateYield(35, 90));
		expect(estimateYield(90, 180)).toBeLessThan(estimateYield(60, 180));
		expect(estimateYield(0, 0)).toBeCloseTo(estimateYield(0, 180), 6);
	});

	test('cache keys bucket position to ~100 m and azimuth to 5°', () => {
		expect(yieldKey([48.77581, 9.18294], 35, 181)).toBe(yieldKey([48.77579, 9.18289], 35, 179));
		expect(yieldKey([48.7758, 9.1829], 35, 180)).not.toBe(yieldKey([48.7758, 9.1829], 36, 180));
	});
});
