import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// PVGIS (EU JRC) blocks browser requests, so the app asks this Bun function instead.
export const prerender = false;

const PVGIS = 'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc';

function param(url: URL, name: string, min: number, max: number): number {
	const raw = url.searchParams.get(name);
	const value = raw === null || raw.trim() === '' ? NaN : Number(raw);
	if (!Number.isFinite(value) || value < min || value > max) error(400, `Invalid ${name}`);
	return value;
}

/** Annual and monthly yield in kWh for 1 kWp at the given location, tilt and azimuth. */
export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
	const lat = param(url, 'lat', -90, 90);
	const lon = param(url, 'lon', -180, 180);
	const tilt = param(url, 'tilt', 0, 90);
	// App azimuth is clockwise from north; PVGIS "aspect" is 0 = south, 90 = west, -90 = east.
	const azimuth = param(url, 'azimuth', 0, 360);
	const aspect = ((((azimuth - 180) % 360) + 540) % 360) - 180;

	const query = new URLSearchParams({
		lat: lat.toFixed(4),
		lon: lon.toFixed(4),
		peakpower: '1',
		loss: '14',
		angle: tilt.toFixed(0),
		aspect: aspect.toFixed(0),
		outputformat: 'json'
	});
	const response = await fetch(`${PVGIS}?${query}`);
	if (!response.ok) error(502, 'PVGIS unavailable');

	const data = await response.json();
	const yearly = data?.outputs?.totals?.fixed?.E_y;
	if (typeof yearly !== 'number') error(502, 'Unexpected PVGIS response');

	// Solar climate data does not change; let the CDN keep answers for a month.
	setHeaders({ 'cache-control': 'public, max-age=86400, s-maxage=2592000' });
	return json({
		yearly,
		monthly: (data.outputs.monthly?.fixed ?? []).map((month: { E_m: number }) => month.E_m),
		source: 'PVGIS'
	});
};
