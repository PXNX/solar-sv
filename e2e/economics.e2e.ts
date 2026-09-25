import { drawRoof, expect, MOCK_YIELD, startWithCustomer, test } from './fixtures';

/** First line of a result tile (the value), as a number. */
const euros = (text: string) => Number(text.split('\n')[0].replace(/[^\d.-]/g, ''));

test.describe('economics', () => {
	test.beforeEach(async ({ page }) => {
		await startWithCustomer(page);
		await drawRoof(page);
		await page.getByText('Economics', { exact: true }).click();
	});

	test('production uses the PVGIS yield for the roof', async ({ page, requests }) => {
		await expect.poll(() => requests.yield.length).toBeGreaterThan(0);
		const query = new URL(requests.yield[0]).searchParams;
		expect(query.get('tilt')).toBe('35');
		expect(query.get('azimuth')).toBe('180');

		const kwp = Number(await page.getByTestId('roof-kwp').innerText());
		const production = page.getByTestId('economics-production');
		await expect
			.poll(async () => euros(await production.innerText()))
			.toBeCloseTo(kwp * MOCK_YIELD, -2);
		await expect(page.getByText('Yield from PVGIS', { exact: false })).toBeVisible();
	});

	test('household presets set the consumption', async ({ page }) => {
		const consumption = page.getByLabel('Consumption (kWh/yr)');
		for (const [people, kwh] of [
			[1, '1500'],
			[3, '3500'],
			[5, '5000']
		] as const) {
			await page.getByRole('button', { name: `Household of ${people} ·` }).click();
			await expect(consumption).toHaveValue(kwh);
		}
	});

	test('a battery adds its price to the investment and raises self-sufficiency', async ({
		page
	}) => {
		const investment = page.getByTestId('economics-investment');
		const autarky = page.getByTestId('economics-autarky');
		const before = euros(await investment.innerText());
		const autarkyBefore = euros(await autarky.innerText());

		await page.getByLabel('Battery storage').check();
		await page.getByLabel('Capacity (kWh)').fill('8');
		await page.getByLabel('Price (€)', { exact: true }).fill('5000');

		await expect.poll(async () => euros(await investment.innerText())).toBe(before + 5000);
		expect(euros(await autarky.innerText())).toBeGreaterThan(autarkyBefore);
	});

	test('higher electricity prices shorten the payback', async ({ page }) => {
		const payback = page.getByTestId('economics-payback');
		const years = async () => euros(await payback.innerText());
		await page.getByLabel('Electricity (€/kWh)').fill('0.30');
		const cheap = await years();
		await page.getByLabel('Electricity (€/kWh)').fill('0.50');
		await expect.poll(years).toBeLessThan(cheap);
	});

	test('economics are stored per customer', async ({ page }) => {
		await page.getByLabel('Consumption (kWh/yr)').fill('6100');
		await page.reload();
		await page.getByText('Economics', { exact: true }).click();
		await expect(page.getByLabel('Consumption (kWh/yr)')).toHaveValue('6100');
	});
});
