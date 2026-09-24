import { expect, LOGO, test } from './fixtures';

test.describe('settings', () => {
	test('branding is saved locally and previewed', async ({ page }) => {
		await page.goto('/settings');
		await page.getByLabel('Company name').fill('Sonnenwerk GmbH');
		await page.getByLabel('Consultant').fill('Max Berater');
		await page.getByLabel('Phone').fill('+49 711 000000');
		await page.getByLabel('Website').fill('sonnenwerk.example');
		await page.locator('input[type=file]').setInputFiles({
			name: 'logo.png',
			mimeType: 'image/png',
			buffer: LOGO
		});
		await expect(page.locator('section img').first()).toBeVisible();
		await expect(page.getByText('sonnenwerk.example · +49 711 000000')).toBeVisible();

		await page.reload();
		await expect(page.getByLabel('Company name')).toHaveValue('Sonnenwerk GmbH');
		const branding = await page.evaluate(() => JSON.parse(localStorage.getItem('solar-branding')!));
		expect(branding.logo).toMatch(/^data:image\/png;base64,/);

		await page.getByRole('button', { name: 'Remove logo' }).click();
		await expect(page.getByRole('button', { name: 'Remove logo' })).toHaveCount(0);
	});

	test('switching the language translates the interface', async ({ page }) => {
		await page.goto('/settings');
		await page.getByRole('button', { name: 'Deutsch' }).click();
		await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();

		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Solarplaner' })).toBeVisible();
		await expect(page.getByRole('dialog', { name: 'Neuer Kunde' })).toBeVisible();

		await page.goto('/settings');
		await page.getByRole('button', { name: 'Automatisch' }).click();
		// Back to the browser language of this test (en-US).
		await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
	});

	test('settings link back to the planner and to the privacy policy', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'Skip' }).click();
		await page.getByRole('link', { name: 'Settings' }).click();
		await expect(page).toHaveURL(/\/settings$/);
		await page.getByRole('link', { name: 'Privacy' }).click();
		await expect(page).toHaveURL(/\/privacy$/);
		await page.getByRole('link', { name: 'Settings' }).click();
		await page.getByRole('link', { name: 'Back to planner' }).click();
		await expect(page).toHaveURL(/\/$/);
	});
});

test.describe('German browser', () => {
	test.use({ locale: 'de-DE' });

	test('uses German automatically, including number formats', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Solarplaner' })).toBeVisible();
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await expect(page.getByRole('button', { name: 'Dachfläche zeichnen' })).toBeVisible();
		// German decimal comma in the module summary.
		await expect(page.getByText('1,72 × 1,13 m')).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.lang)).toBe('de');
	});
});
