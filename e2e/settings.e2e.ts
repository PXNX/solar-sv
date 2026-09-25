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
		const crop = page.getByRole('dialog', { name: 'Crop logo' });
		await expect(crop).toBeVisible();
		await crop.getByRole('button', { name: 'Use logo' }).click();
		await expect(crop).toBeHidden();
		await expect(page.locator('section img').first()).toBeVisible();
		await expect(page.getByText('sonnenwerk.example · +49 711 000000')).toBeVisible();

		await page.reload();
		await expect(page.getByLabel('Company name')).toHaveValue('Sonnenwerk GmbH');
		const branding = await page.evaluate(() => JSON.parse(localStorage.getItem('solar-branding')!));
		expect(branding.logo).toMatch(/^data:image\/png;base64,/);

		await page.getByRole('button', { name: 'Remove logo' }).click();
		await expect(page.getByRole('button', { name: 'Remove logo' })).toHaveCount(0);
	});

	test('logo crop picker cuts out the selected area', async ({ page }) => {
		await page.goto('/settings');
		await page.locator('input[type=file]').setInputFiles({
			name: 'logo.png',
			mimeType: 'image/png',
			buffer: LOGO
		});
		const crop = page.getByRole('dialog', { name: 'Crop logo' });
		await expect(crop.getByTestId('crop-size')).toHaveText('64 × 64 px');

		// Drag the bottom-right corner halfway towards the top-left one.
		const handle = (await crop.getByTestId('crop-handle-se').boundingBox())!;
		const box = (await crop.getByTestId('crop-box').boundingBox())!;
		await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
		await page.mouse.up();
		await expect(crop.getByTestId('crop-size')).toHaveText('32 × 32 px');

		// Moving the frame keeps its size.
		await crop.getByTestId('crop-box').focus();
		await page.keyboard.press('ArrowRight');
		await expect(crop.getByTestId('crop-size')).toHaveText('32 × 32 px');

		await crop.getByRole('button', { name: 'Use logo' }).click();
		const size = await page.evaluate(async () => {
			const { logo } = JSON.parse(localStorage.getItem('solar-branding')!);
			const img = new Image();
			img.src = logo;
			await img.decode();
			return [img.naturalWidth, img.naturalHeight];
		});
		expect(size).toEqual([32, 32]);
	});

	test('cancelling the crop keeps the previous logo', async ({ page }) => {
		await page.goto('/settings');
		await page.locator('input[type=file]').setInputFiles({
			name: 'logo.png',
			mimeType: 'image/png',
			buffer: LOGO
		});
		await page
			.getByRole('dialog', { name: 'Crop logo' })
			.getByRole('button', { name: 'Cancel' })
			.click();
		await expect(page.getByRole('button', { name: 'Remove logo' })).toHaveCount(0);
		const branding = await page.evaluate(() => localStorage.getItem('solar-branding'));
		expect(JSON.parse(branding ?? '{}').logo ?? null).toBeNull();
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
		expect(await page.evaluate(() => localStorage.getItem('solar-language'))).toBeNull();
	});

	test('the browser language is not stored as a choice', async ({ page }) => {
		await page.goto('/settings');
		await expect(page.getByRole('button', { name: 'Automatic' })).toHaveClass(/bg-primary/);
		expect(await page.evaluate(() => localStorage.getItem('solar-language'))).toBeNull();
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
