import { CUSTOMER, drawRoof, expect, startWithCustomer, test } from './fixtures';
import { downloadBytes, pdfText, PNG_SIGNATURE } from './utils';

test.describe('exports', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/settings');
		await page.getByLabel('Company name').fill('Sonnenwerk GmbH');
		await page.getByLabel('Consultant').fill('Max Berater');
		await page.getByLabel('Email').fill('max@sonnenwerk.example');
		await startWithCustomer(page);
		await drawRoof(page);
	});

	test('roof plan PNG is a real image named after the customer', async ({ page }) => {
		const download = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Roof plan' }).click();
		const file = await download;

		expect(file.suggestedFilename()).toMatch(/^erika-muster-roof-plan-\d{4}-\d{2}-\d{2}\.png$/);
		const bytes = await downloadBytes(file);
		expect(bytes.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
		// Fixed 1600 × 1000 frame at 1.5×, regardless of the browser window.
		expect(bytes.readUInt32BE(16)).toBe(2400);
		expect(bytes.readUInt32BE(20)).toBe(1500);
	});

	test('the map returns to the planning view after an export', async ({ page }) => {
		const scale = page.locator('.leaflet-control-scale-line');
		const before = await scale.innerText();
		const download = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Roof plan' }).click();
		await download;
		await expect(scale).toHaveText(before);
		// Plan-style labels are only used while capturing.
		await expect(page.locator('.roof-label-content')).not.toContainText('m²');
	});

	test('proposal PDF contains branding, customer, roofs and economics as text', async ({
		page
	}) => {
		await page.getByLabel('Roof name').fill('Main roof');
		const download = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Proposal' }).click();
		const file = await download;

		expect(file.suggestedFilename()).toMatch(/^erika-muster-proposal-\d{4}-\d{2}-\d{2}\.pdf$/);
		const bytes = await downloadBytes(file);
		expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');

		const text = pdfText(bytes);
		for (const expected of [
			'Solar proposal',
			'Sonnenwerk GmbH',
			'Max Berater',
			'max@sonnenwerk.example',
			CUSTOMER.name,
			CUSTOMER.address,
			'Main roof',
			'Roof faces',
			'Economics',
			'Payback',
			'Module specification',
			'Yield data: PVGIS'
		]) {
			expect(text, `PDF should mention "${expected}"`).toContain(expected);
		}
	});

	test('export buttons are disabled while an export runs', async ({ page }) => {
		const download = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Proposal' }).click();
		await expect(page.getByRole('button', { name: 'Roof plan' })).toBeDisabled();
		await download;
		await expect(page.getByRole('button', { name: 'Roof plan' })).toBeEnabled();
	});
});
