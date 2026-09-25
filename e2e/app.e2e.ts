import type { Page } from '@playwright/test';
import { expect, startWithCustomer, test } from './fixtures';

test.describe('privacy policy', () => {
	test('explains local storage and every third party', async ({ page }) => {
		await page.goto('/privacy');
		await expect(page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible();
		for (const section of [
			'Your data stays in your browser',
			'Hosting and server logs',
			'Map services',
			'Address search',
			'Yield calculation (PVGIS)',
			'No cookies, no tracking',
			'Your rights'
		]) {
			await expect(page.getByRole('heading', { name: section })).toBeVisible();
		}
	});

	test.describe('in German', () => {
		test.use({ locale: 'de-DE' });
		test('is the Datenschutzerklärung', async ({ page }) => {
			await page.goto('/privacy');
			await expect(page.getByRole('heading', { name: 'Datenschutzerklärung' })).toBeVisible();
			await expect(page.getByText('Art. 13 DSGVO')).toBeVisible();
		});
	});
});

test.describe('yield API', () => {
	test('rejects invalid coordinates', async ({ request }) => {
		const response = await request.get('/api/yield?lat=200&lon=9&tilt=35&azimuth=180');
		expect(response.status()).toBe(400);
		expect((await response.json()).message).toBe('Invalid lat');
	});

	test('rejects a missing tilt', async ({ request }) => {
		const response = await request.get('/api/yield?lat=48.7&lon=9.1&azimuth=180');
		expect(response.status()).toBe(400);
	});

	test('returns PVGIS data @network', async ({ request }) => {
		test.skip(!process.env.PVGIS, 'set PVGIS=1 to call the real PVGIS service');
		const response = await request.get('/api/yield?lat=48.776&lon=9.183&tilt=35&azimuth=180');
		expect(response.ok()).toBe(true);
		const body = await response.json();
		expect(body.yearly).toBeGreaterThan(900);
		expect(body.monthly).toHaveLength(12);
		expect(response.headers()['cache-control']).toContain('s-maxage');
	});
});

test.describe('imagery alignment', () => {
	test('nudging shifts the imagery pane and persists the offset', async ({ page }) => {
		await startWithCustomer(page);
		await page.getByRole('button', { name: 'Align satellite imagery with the street map' }).click();
		await expect(page.getByText('Shift the photo until it matches the street map')).toBeVisible();

		await page.getByRole('button', { name: 'Shift east (→)' }).click();
		await page.getByRole('button', { name: 'Shift east (→)' }).click();
		await page.keyboard.press('ArrowUp');
		await expect(page.getByText('E 0.50 m')).toBeVisible();
		await expect(page.getByText('N 0.25 m')).toBeVisible();
		await expect
			.poll(() => page.locator('.leaflet-imagery-pane').evaluate((el) => el.style.transform))
			.toMatch(/translate\([1-9][\d.]*px, -[1-9][\d.]*px\)/);

		await page.getByRole('button', { name: 'Done' }).click();
		await page.reload();
		const offset = await page.evaluate(() =>
			JSON.parse(localStorage.getItem('solar-imagery-offset')!)
		);
		expect(offset).toEqual({ east: 0.5, north: 0.25 });
	});

	test('the state orthophotos are not shifted and hide while aligning', async ({ page }) => {
		await startWithCustomer(page);
		const orthophotos = page.locator('.leaflet-orthophotos-pane img');
		await expect(orthophotos.first()).toBeAttached();
		await page.getByRole('button', { name: 'Align satellite imagery with the street map' }).click();
		await expect(orthophotos).toHaveCount(0);
		await page.getByRole('button', { name: 'Shift east (→)' }).click();
		await page.getByRole('button', { name: 'Done' }).click();
		await expect(orthophotos.first()).toBeAttached();
		expect(
			await page.locator('.leaflet-orthophotos-pane').evaluate((el) => el.style.transform)
		).toBe('');
	});
});

test.describe('state orthophotos', () => {
	/** Opens the planner looking at the given place, without a customer. */
	async function viewAt(page: Page, center: [number, number], zoom = 19) {
		await page.addInitScript((view) => localStorage.setItem('solar-view', JSON.stringify(view)), {
			center,
			zoom
		});
		await page.goto('/');
		await expect(page.locator('.leaflet-imagery-pane img').first()).toBeAttached();
		await page.waitForTimeout(500);
	}

	test('Stuttgart loads the 20 cm imagery of Baden-Württemberg', async ({ page, requests }) => {
		await viewAt(page, [48.7781, 9.1815]);
		await expect.poll(() => requests.orthophotos.length).toBeGreaterThan(0);
		expect(requests.orthophotos.every((url) => url.includes('owsproxy.lgl-bw.de'))).toBe(true);
		expect(requests.orthophotos[0]).toContain('TILEMATRIX=GoogleMapsCompatible:19');
		await expect(page.locator('.leaflet-control-attribution')).toContainText('LGL-BW');
	});

	test('Munich asks the Bavarian WMS for web mercator tiles', async ({ page, requests }) => {
		await viewAt(page, [48.1374, 11.5755]);
		await expect.poll(() => requests.orthophotos.length).toBeGreaterThan(0);
		const url = new URL(requests.orthophotos.find((u) => u.includes('bayern.de'))!);
		expect(url.searchParams.get('layers')).toBe('by_dop40c');
		expect(url.searchParams.get('crs')).toBe('EPSG:3857');
		expect(url.searchParams.get('transparent')).toBe('true');
		await expect(page.locator('.leaflet-control-attribution')).toContainText(
			'Bayerische Vermessungsverwaltung'
		);
	});

	test('switching to Esri hides the orthophotos and is remembered', async ({ page }) => {
		await startWithCustomer(page);
		const choice = page.getByRole('group', { name: 'Aerial imagery' });
		const official = choice.getByRole('button', { name: 'Official · Baden-Württemberg' });
		const esri = choice.getByRole('button', { name: 'Esri' });
		const orthophotos = page.locator('.leaflet-orthophotos-pane img');
		const attribution = page.locator('.leaflet-control-attribution');
		await expect(official).toHaveAttribute('aria-pressed', 'true');
		await expect(orthophotos.first()).toBeAttached();

		await esri.click();
		await expect(esri).toHaveAttribute('aria-pressed', 'true');
		await expect(orthophotos).toHaveCount(0);
		await expect(attribution).not.toContainText('LGL-BW');

		await page.reload();
		await expect(esri).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('.leaflet-imagery-pane img').first()).toBeAttached();
		await expect(orthophotos).toHaveCount(0);

		await official.click();
		await expect(orthophotos.first()).toBeAttached();
		await expect(attribution).toContainText('LGL-BW');
	});

	test('outside Germany and when zoomed out only the global imagery loads', async ({
		page,
		requests
	}) => {
		await viewAt(page, [48.8566, 2.3522]);
		await viewAt(page, [48.7781, 9.1815], 10);
		await expect(page.locator('.leaflet-imagery-pane img').first()).toBeAttached();
		expect(requests.orthophotos).toEqual([]);
		await expect(page.locator('.leaflet-control-attribution')).not.toContainText('LGL-BW');
		await expect(page.getByTestId('imagery-choice')).toHaveCount(0);
	});
});

test.describe('PWA', () => {
	test('serves a complete web app manifest', async ({ request }) => {
		const manifest = await (await request.get('/manifest.webmanifest')).json();
		expect(manifest).toMatchObject({
			name: 'Solar Planner',
			display: 'standalone',
			start_url: '/'
		});
		const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
		expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
		expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')).toBe(
			true
		);
		for (const icon of manifest.icons) {
			expect((await request.get(icon.src)).ok()).toBe(true);
		}
	});

	test.describe('with service worker', () => {
		test.use({ serviceWorkers: 'allow' });

		test('registers and precaches every page for offline use', async ({ page, context }) => {
			await page.goto('/');
			await page.evaluate(() => navigator.serviceWorker.ready);
			const precached = await page.evaluate(async () => {
				const names = await caches.keys();
				const urls: string[] = [];
				for (const name of names) {
					for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
				}
				return urls;
			});
			for (const path of ['/settings', '/history', '/privacy', '/manifest.webmanifest']) {
				expect(precached.some((url) => new URL(url).pathname === path)).toBe(true);
			}

			await context.setOffline(true);
			await page.goto('/settings');
			await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
			await context.setOffline(false);
		});
	});
});
