import { drawRoof, expect, startWithCustomer, test } from './fixtures';

test.describe('drawing roof faces', () => {
	test.beforeEach(async ({ page }) => {
		await startWithCustomer(page);
	});

	test('a drawn roof gets modules, a south orientation and a map label', async ({ page }) => {
		await drawRoof(page);

		const card = page.getByTestId('roof-card');
		await expect(card).toHaveCount(1);
		await expect(card.getByLabel('Roof name')).toHaveValue('Roof 1');
		await expect(card.getByTestId('roof-facing')).toHaveText(/S\s+180°/);
		const modules = Number(await card.getByTestId('roof-modules').innerText());
		expect(modules).toBeGreaterThan(40);
		expect(modules).toBeLessThan(120);

		const [, plan] = (await card.getByTestId('roof-area').innerText()).match(/([\d,]+) m² plan/)!;
		const planArea = Number(plan.replace(',', ''));
		expect(planArea).toBeGreaterThan(120);
		expect(planArea).toBeLessThan(175);

		await expect(page.locator('.roof-label-content')).toContainText('35°');
		await expect(page.getByTestId('totals')).toContainText(String(modules));
	});

	test('changing the pitch recomputes the layout', async ({ page }) => {
		await drawRoof(page);
		const card = page.getByTestId('roof-card');
		const pitched = Number(await card.getByTestId('roof-modules').innerText());

		await card.getByLabel('Pitch').fill('0');
		await expect(card.getByText('0°', { exact: true })).toBeVisible();
		const flat = Number(await card.getByTestId('roof-modules').innerText());
		// Same footprint: a flat roof has less real surface than a 35° one.
		expect(flat).toBeLessThan(pitched);

		await card.getByLabel('Pitch').fill('50');
		const steep = Number(await card.getByTestId('roof-modules').innerText());
		expect(steep).toBeGreaterThan(pitched);
	});

	test('switching module orientation re-packs the roof', async ({ page }) => {
		await drawRoof(page);
		// At 35° this roof fits 72 modules either way (12 × 6 vs 8 × 9); flat it does not.
		await page.getByLabel('Pitch').fill('0');
		const modules = page.getByTestId('roof-modules');
		const portrait = await modules.innerText();
		await page.getByText('Module', { exact: true }).click();
		await page.getByRole('button', { name: 'Landscape' }).click();
		await expect(page.getByText('Long side runs along the eave.')).toBeVisible();
		await expect(modules).not.toHaveText(portrait);
	});

	test('bigger modules mean fewer of them', async ({ page }) => {
		await drawRoof(page);
		const modules = page.getByTestId('roof-modules');
		const before = Number(await modules.innerText());
		await page.getByText('Module', { exact: true }).click();
		await page.getByLabel('Length (m)').fill('2.2');
		await expect.poll(async () => Number(await modules.innerText())).toBeLessThan(before);
	});

	test('the toolbar previews which way the roof will face', async ({ page }) => {
		await page.getByRole('button', { name: 'Draw roof face' }).click();
		const box = (await page.locator('.leaflet-container').boundingBox())!;
		const x = box.x + box.width / 2 + 120;
		const y = box.y + box.height / 2;
		await page.mouse.click(x - 60, y + 40);
		await page.mouse.click(x + 60, y + 40);
		const preview = page.getByTestId('facing-preview');

		// Pointer above the west-east eave: the roof rises northwards and faces south.
		await page.mouse.move(x, y - 30);
		await expect(preview).toHaveText('Faces S · 180°');
		await expect(page.getByTestId('facing-preview-marker')).toContainText('S');

		// Below the eave it would face north.
		await page.mouse.move(x, y + 90);
		await expect(preview).toHaveText('Faces N · 0°');

		// Once the outline has a third point, that side wins over the pointer.
		await page.mouse.click(x + 60, y - 40);
		await page.mouse.move(x, y + 90);
		await expect(preview).toHaveText('Faces S · 180°');
	});

	test('finish needs three points, undo and escape work', async ({ page }) => {
		await page.getByRole('button', { name: 'Draw roof face' }).click();
		await expect(page.getByText('Step 1 · Eave')).toBeVisible();
		const finish = page.getByRole('button', { name: 'Finish' });
		const box = (await page.locator('.leaflet-container').boundingBox())!;
		const x = box.x + box.width / 2 + 120;
		const y = box.y + box.height / 2;

		await page.mouse.click(x - 60, y + 40);
		await page.mouse.click(x + 60, y + 40);
		await expect(page.getByText('Step 2 · Outline')).toBeVisible();
		await expect(finish).toBeDisabled();

		await page.mouse.click(x + 60, y - 40);
		await expect(finish).toBeEnabled();
		await page.getByRole('button', { name: 'Undo last point (Backspace)' }).click();
		await expect(finish).toBeDisabled();

		await page.keyboard.press('Escape');
		await expect(finish).toBeHidden();
		await expect(page.getByTestId('roof-card')).toHaveCount(0);
	});

	test('clicking the first point closes the outline', async ({ page }) => {
		await page.getByRole('button', { name: 'Draw roof face' }).click();
		const box = (await page.locator('.leaflet-container').boundingBox())!;
		const x = box.x + box.width / 2 + 120;
		const y = box.y + box.height / 2;
		for (const [dx, dy] of [
			[-70, 45],
			[70, 45],
			[70, -45],
			[-70, -45],
			[-70, 45]
		]) {
			await page.mouse.click(x + dx, y + dy);
		}
		await expect(page.getByTestId('roof-card')).toHaveCount(1);
	});

	test('several roofs are numbered and can be deleted', async ({ page }) => {
		await drawRoof(page, { x: -80, y: 0 });
		await drawRoof(page, { x: 120, y: 0 });
		const cards = page.getByTestId('roof-card');
		await expect(cards).toHaveCount(2);
		await expect(cards.nth(1).getByLabel('Roof name')).toHaveValue('Roof 2');

		await cards.nth(0).getByRole('button', { name: 'Delete roof' }).click();
		await expect(cards).toHaveCount(1);
		await page.getByRole('button', { name: 'Remove all roofs' }).click();
		await expect(cards).toHaveCount(0);
	});

	test('roofs are renamed inline and persist', async ({ page }) => {
		await drawRoof(page);
		await page.getByLabel('Roof name').fill('South garage');
		await page.reload();
		await expect(page.getByLabel('Roof name')).toHaveValue('South garage');
	});
});
