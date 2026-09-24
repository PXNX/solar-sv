import { CUSTOMER, expect, startWithCustomer, test } from './fixtures';

test.describe('customer onboarding', () => {
	test('first visit asks for the customer and flies to the geocoded address', async ({
		page,
		requests
	}) => {
		await startWithCustomer(page);

		expect(requests.nominatim).toContain(CUSTOMER.query);
		const sidebar = page.locator('aside');
		await expect(sidebar.getByLabel('Customer name')).toHaveValue(CUSTOMER.name);
		await expect(sidebar.getByPlaceholder('Street, number, town')).toHaveValue(CUSTOMER.address);
		await expect(page.locator('.customer-pin-content')).toBeVisible();
		await expect(page).toHaveTitle(`${CUSTOMER.name} · Solar Planner`);
	});

	test('customer details survive a reload and the dialog stays closed', async ({ page }) => {
		await startWithCustomer(page);
		await page.reload();

		await expect(page.getByRole('dialog')).toHaveCount(0);
		await expect(page.locator('aside').getByLabel('Customer name')).toHaveValue(CUSTOMER.name);
		const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('solar-project')!));
		expect(stored.customer).toMatchObject({
			name: CUSTOMER.name,
			address: CUSTOMER.address,
			location: [CUSTOMER.lat, CUSTOMER.lon]
		});
	});

	test('unknown addresses show a hint instead of moving the map', async ({ page }) => {
		await page.goto('/');
		const dialog = page.getByRole('dialog', { name: 'New customer' });
		const address = dialog.getByPlaceholder('Street, number, town');
		await address.fill('Nowhere 999');
		await address.press('Enter');
		await expect(dialog.getByText('Address not found')).toBeVisible();
	});

	test('suggestions can be picked from the dropdown', async ({ page }) => {
		await page.goto('/');
		const dialog = page.getByRole('dialog', { name: 'New customer' });
		await dialog.getByPlaceholder('Street, number, town').fill('Schlossplatz');
		await dialog.getByRole('button', { name: /Schlossplatz 4, 70173 Stuttgart/ }).click();
		await expect(dialog.getByPlaceholder('Street, number, town')).toHaveValue(CUSTOMER.address);
	});

	test('skipping keeps the planner usable without a customer', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'Skip' }).click();
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Draw roof face' })).toBeEnabled();
		await expect(page.getByText('No roofs yet')).toBeVisible();
	});

	test('address lookups use the interface language', async ({ page }) => {
		const lookup = page.waitForRequest(/nominatim\.openstreetmap\.org\/search/);
		await page.goto('/');
		const address = page.getByRole('dialog').getByPlaceholder('Street, number, town');
		await address.fill(CUSTOMER.query);
		await address.press('Enter');
		expect(new URL((await lookup).url()).searchParams.get('accept-language')).toBe('en');
	});
});
