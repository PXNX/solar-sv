import { drawRoof, expect, startWithCustomer, test } from './fixtures';
import { downloadBytes } from './utils';

test.describe('phone layout', () => {
	test.beforeEach(async ({ page }) => {
		await startWithCustomer(page);
	});

	test('bottom sheet stays low and leaves most of the map visible', async ({ page }) => {
		const viewport = page.viewportSize()!;
		const sheet = (await page.getByTestId('sidebar').boundingBox())!;
		expect(sheet.height).toBeLessThanOrEqual(viewport.height * 0.43);
		expect(sheet.y + sheet.height).toBeLessThanOrEqual(viewport.height);
	});

	test('the whole bottom sheet scrolls, header included', async ({ page }) => {
		const sheet = page.getByTestId('sidebar');
		const header = sheet.locator('header');
		expect(await sheet.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
		await sheet.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
		await expect(page.getByText('No roofs yet')).toBeInViewport();
		await expect(header).not.toBeInViewport();
		await sheet.evaluate((el) => el.scrollTo({ top: 0 }));
		await expect(header).toBeInViewport();
	});

	test('drawing toolbar fits on screen', async ({ page }) => {
		await page.getByRole('button', { name: 'Draw roof face' }).click();
		const toolbar = (await page.getByText('Step 1 · Eave').locator('..').boundingBox())!;
		const viewport = page.viewportSize()!;
		expect(toolbar.x).toBeGreaterThanOrEqual(0);
		expect(toolbar.x + toolbar.width).toBeLessThanOrEqual(viewport.width);
	});

	test('exports the same landscape image as on desktop', async ({ page }) => {
		await drawRoof(page, { x: -120, y: -150 });
		await expect(page.getByTestId('roof-card')).toHaveCount(1);
		const download = page.waitForEvent('download');
		await page.getByTestId('sidebar').getByRole('button', { name: 'Roof plan' }).click();
		const bytes = await downloadBytes(await download);
		expect(bytes.readUInt32BE(16)).toBe(2400);
		expect(bytes.readUInt32BE(20)).toBe(1500);
		// Afterwards the map fills the phone screen again.
		const map = (await page.locator('.leaflet-container').boundingBox())!;
		expect(map.width).toBe(page.viewportSize()!.width);
	});
});
