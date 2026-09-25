import { test as base, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ORTHOPHOTO_HOSTS } from '../src/lib/map/imagery';

/** 1 × 1 grey PNG, stretched by Leaflet into every map tile. */
const TILE = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC',
	'base64'
);

export const CUSTOMER = {
	name: 'Erika Muster',
	query: 'Schlossplatz 4, Stuttgart',
	address: 'Schlossplatz 4, 70173 Stuttgart',
	lat: 48.7781573,
	lon: 9.1814868
};

/** kWh per kWp and year returned by the mocked PVGIS endpoint. */
export const MOCK_YIELD = 1100;

export const LOGO = readFileSync(new URL('./fixtures/logo.png', import.meta.url));

interface Fixtures {
	/** Requests seen by the mocked Nominatim, yield and state imagery endpoints. */
	requests: { nominatim: string[]; yield: string[]; orthophotos: string[] };
}

export const test = base.extend<Fixtures>({
	requests: [
		async ({ context }, use) => {
			const requests = {
				nominatim: [] as string[],
				yield: [] as string[],
				orthophotos: [] as string[]
			};
			const cors = { 'access-control-allow-origin': '*' };

			await context.route(/server\.arcgisonline\.com|tile\.openstreetmap\.org/, (route) =>
				route.fulfill({ status: 200, contentType: 'image/png', headers: cors, body: TILE })
			);
			await context.route(
				(url) => ORTHOPHOTO_HOSTS.includes(url.host),
				(route) => {
					requests.orthophotos.push(route.request().url());
					route.fulfill({ status: 200, contentType: 'image/png', headers: cors, body: TILE });
				}
			);
			await context.route(/nominatim\.openstreetmap\.org\/search/, (route) => {
				const q = new URL(route.request().url()).searchParams.get('q') ?? '';
				requests.nominatim.push(q);
				const hit = q.toLowerCase().includes('schlossplatz');
				route.fulfill({
					status: 200,
					headers: cors,
					json: hit
						? [
								{
									display_name:
										'4, Schlossplatz, Mitte, Stuttgart, Baden-Württemberg, 70173, Deutschland',
									lat: String(CUSTOMER.lat),
									lon: String(CUSTOMER.lon),
									address: {
										road: 'Schlossplatz',
										house_number: '4',
										postcode: '70173',
										city: 'Stuttgart'
									}
								}
							]
						: []
				});
			});
			await context.route('**/api/yield?*', (route) => {
				requests.yield.push(route.request().url());
				route.fulfill({ status: 200, json: { yearly: MOCK_YIELD, monthly: [], source: 'PVGIS' } });
			});

			await use(requests);
		},
		{ auto: true }
	]
});

export { expect };

/** Fresh visit: completes the "New customer" dialog and waits until the map is at the house. */
export async function startWithCustomer(page: Page, name = CUSTOMER.name) {
	await page.goto('/');
	const dialog = page.getByRole('dialog', { name: 'New customer' });
	await expect(dialog).toBeVisible();
	await dialog.getByLabel('Customer name').fill(name);
	const address = dialog.getByPlaceholder('Street, number, town');
	await address.fill(CUSTOMER.query);
	await address.press('Enter');
	await expect(dialog.getByText(CUSTOMER.address)).toBeVisible();
	await dialog.getByRole('button', { name: 'Start planning' }).click();
	await expect(dialog).toBeHidden();
	await waitForMapIdle(page);
}

/** At zoom 20 the 150 px scale bar reads 10 m. */
export async function waitForMapIdle(page: Page) {
	await expect(page.locator('.leaflet-control-scale-line')).toHaveText('10 m');
	await page.waitForTimeout(400);
}

/**
 * Draws a 150 × 100 px (≈ 14.8 × 9.8 m at zoom 20) roof face right of the sidebar.
 * The first edge is the eave along the bottom, so the roof faces south.
 */
export async function drawRoof(page: Page, offset = { x: 0, y: 0 }) {
	await page.getByRole('button', { name: 'Draw roof face' }).click();
	const box = (await page.locator('.leaflet-container').boundingBox())!;
	const cx = box.x + box.width / 2 + 120 + offset.x;
	const cy = box.y + box.height / 2 + offset.y;
	for (const [dx, dy] of [
		[-75, 50],
		[75, 50],
		[75, -50],
		[-75, -50]
	]) {
		await page.mouse.click(cx + dx, cy + dy);
	}
	await page.getByRole('button', { name: 'Finish' }).click();
	return { cx, cy };
}
