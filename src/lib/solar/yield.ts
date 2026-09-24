import type { LatLng } from './layout';

export interface RoofYield {
	/** kWh per kWp and year. */
	specific: number;
	source: 'pvgis' | 'estimate';
}

const DEG = Math.PI / 180;
const CACHE_KEY = 'solar-yield-cache';

/**
 * Rough fallback for Central Europe when PVGIS is unreachable (offline): about 1,000 kWh/kWp
 * for a south-facing 35° roof, less for flatter, steeper or east/west/north-facing roofs.
 */
export function estimateYield(tilt: number, azimuth: number): number {
	const t = tilt * DEG;
	const offSouth = (azimuth - 180) * DEG;
	const factor =
		0.87 +
		0.28 * Math.sin(t) * Math.cos(offSouth) -
		0.17 * (1 - Math.cos(t)) -
		0.25 * Math.sin(t) ** 4;
	return Math.max(0.3, factor) * 1000;
}

export function yieldKey(center: LatLng, tilt: number, azimuth: number): string {
	// ~100 m and 5° buckets: finer steps do not change PVGIS results meaningfully.
	return [
		center[0].toFixed(3),
		center[1].toFixed(3),
		Math.round(tilt),
		Math.round(azimuth / 5) * 5
	].join(',');
}

function readCache(): Record<string, number> {
	try {
		return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
	} catch {
		return {};
	}
}

const cache = readCache();
const pending = new Map<string, Promise<number | null>>();

export function cachedYield(key: string): number | undefined {
	return cache[key];
}

/** Specific yield from PVGIS via our /api/yield function, cached in localStorage. */
export function fetchYield(key: string): Promise<number | null> {
	if (key in cache) return Promise.resolve(cache[key]);
	const existing = pending.get(key);
	if (existing) return existing;

	const [lat, lon, tilt, azimuth] = key.split(',');
	const request = fetch(`/api/yield?${new URLSearchParams({ lat, lon, tilt, azimuth })}`)
		.then(async (response) => {
			if (!response.ok) return null;
			const { yearly } = (await response.json()) as { yearly: number };
			cache[key] = yearly;
			localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
			return yearly;
		})
		.catch(() => null)
		.finally(() => pending.delete(key));
	pending.set(key, request);
	return request;
}
