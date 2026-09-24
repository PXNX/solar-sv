import { expect, startWithCustomer, test } from './fixtures';

test.describe('phone layout', () => {
	test('sidebar docks to the bottom and leaves the map visible', async ({ page }) => {
		await startWithCustomer(page);
		const viewport = page.viewportSize()!;
		const sidebar = (await page.locator('aside').boundingBox())!;
		expect(sidebar.y).toBeGreaterThan(viewport.height * 0.35);
		expect(sidebar.y + sidebar.height).toBeLessThanOrEqual(viewport.height);
		await expect(page.getByRole('button', { name: 'Draw roof face' })).toBeVisible();
	});

	test('drawing toolbar fits on screen', async ({ page }) => {
		await startWithCustomer(page);
		await page.getByRole('button', { name: 'Draw roof face' }).click();
		const toolbar = (await page.getByText('Step 1 · Eave').locator('..').boundingBox())!;
		const viewport = page.viewportSize()!;
		expect(toolbar.x).toBeGreaterThanOrEqual(0);
		expect(toolbar.x + toolbar.width).toBeLessThanOrEqual(viewport.width);
	});
});
