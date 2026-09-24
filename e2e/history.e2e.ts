import { CUSTOMER, drawRoof, expect, startWithCustomer, test } from './fixtures';

test.describe('customer history', () => {
	test('"New customer" archives the current customer and starts fresh', async ({ page }) => {
		await startWithCustomer(page);
		await drawRoof(page);

		await page.getByRole('button', { name: 'New customer' }).click();
		await expect(page.getByText('Previous customer saved to history.')).toBeVisible();
		const dialog = page.getByRole('dialog', { name: 'New customer' });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByLabel('Customer name')).toHaveValue('');
		await dialog.getByRole('button', { name: 'Skip' }).click();
		await expect(page.getByTestId('roof-card')).toHaveCount(0);

		await page.getByRole('link', { name: 'History' }).click();
		await expect(page).toHaveURL(/\/history$/);
		const entry = page.getByRole('listitem').filter({ hasText: CUSTOMER.name });
		await expect(entry).toBeVisible();
		await expect(entry).toContainText(CUSTOMER.address);
		await expect(entry).toContainText('1 roofs');
	});

	test('opening an archived customer restores it and archives the current one', async ({
		page
	}) => {
		await startWithCustomer(page);
		await drawRoof(page);
		await page.getByRole('button', { name: 'New customer' }).click();
		const dialog = page.getByRole('dialog', { name: 'New customer' });
		await dialog.getByLabel('Customer name').fill('Second Customer');
		await dialog.getByRole('button', { name: 'Start planning' }).click();

		await page.goto('/history');
		await page
			.getByRole('listitem')
			.filter({ hasText: CUSTOMER.name })
			.getByRole('button', { name: 'Open' })
			.click();

		await expect(page).toHaveURL(/\/$/);
		await expect(page.locator('aside').getByLabel('Customer name')).toHaveValue(CUSTOMER.name);
		await expect(page.getByTestId('roof-card')).toHaveCount(1);

		await page.goto('/history');
		await expect(page.getByRole('listitem')).toHaveCount(1);
		await expect(page.getByRole('listitem')).toContainText('Second Customer');
	});

	test('history can be searched and entries deleted', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => {
			const now = Date.now();
			const project = (id: string, name: string, address: string) => ({
				id,
				customer: { name, address, location: null },
				roofs: [],
				economics: {},
				createdAt: now,
				updatedAt: now
			});
			localStorage.setItem(
				'solar-history',
				JSON.stringify([
					project('a', 'Anna Beispiel', 'Königstraße 1, Stuttgart'),
					project('b', 'Bernd Probe', 'Marktplatz 1, Esslingen')
				])
			);
		});
		await page.goto('/history');
		await expect(page.getByRole('listitem')).toHaveCount(2);

		await page.getByPlaceholder('Search customers…').fill('esslingen');
		await expect(page.getByRole('listitem')).toHaveCount(1);
		await expect(page.getByRole('listitem')).toContainText('Bernd Probe');

		page.once('dialog', (dialog) => dialog.accept());
		await page.getByRole('button', { name: 'Delete' }).click();
		await page.getByPlaceholder('Search customers…').fill('');
		await expect(page.getByRole('listitem')).toHaveCount(1);
		await expect(page.getByRole('listitem')).toContainText('Anna Beispiel');
	});

	test('an empty history explains how to fill it', async ({ page }) => {
		await page.goto('/history');
		await expect(page.getByText('No archived customers yet.')).toBeVisible();
	});

	test('empty projects are not archived', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'Skip' }).click();
		await page.getByRole('button', { name: 'New customer' }).click();
		await expect(page.getByText('Previous customer saved to history.')).toHaveCount(0);
		const history = await page.evaluate(() => localStorage.getItem('solar-history'));
		expect(JSON.parse(history ?? '[]')).toHaveLength(0);
	});
});
