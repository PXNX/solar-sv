/**
 * Official aerial imagery (DOP, "Digitale Orthophotos") published as open data by the German
 * state survey offices. It is 10–40 cm per pixel, much sharper than global satellite
 * mosaics, and georeferenced to within centimetres.
 *
 * All sources are transparent outside their state, so they are stacked on top of the global
 * imagery, which shows through wherever no state layer covers the map. Every source sends CORS
 * headers; without them the map could not be exported to PNG/PDF. Sachsen-Anhalt and
 * Schleswig-Holstein are missing for that reason; Hamburg, Hessen, Bremen and Saarland have no
 * working open service yet.
 */

import type { LatLng } from '$lib/solar/layout';
import { REGIONS, REGION_TOLERANCE } from './regions.ts';

interface SourceConfig {
	/** Key into {@link REGIONS}. */
	id: string;
	/** State the imagery covers. */
	region: string;
	/** Tile URL template (`xyz`) or WMS endpoint (`wms`). */
	kind: 'xyz' | 'wms';
	url: string;
	layers?: string;
	/** Prefer JPEG-inside, transparent-outside tiles where the server offers them: ~10× smaller. */
	format?: string;
	/** Deepest zoom the server renders natively; Leaflet upscales beyond it. */
	maxNativeZoom: number;
	attribution: string;
}

const YEAR = new Date().getFullYear();
const DL_BY = '<a href="https://www.govdata.de/dl-de/by-2-0">dl-de/by-2-0</a>';
const CC_BY = '<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>';

/** Below this zoom the global imagery is sharp enough and much lighter. */
export const ORTHOPHOTO_MIN_ZOOM = 13;

export interface ImagerySource extends SourceConfig {
	/** Extent of the state, so Leaflet requests no tiles elsewhere. */
	bounds: [LatLng, LatLng];
}

interface Rect {
	south: number;
	west: number;
	north: number;
	east: number;
}

const SOURCES: SourceConfig[] = [
	{
		id: 'bw',
		region: 'Baden-Württemberg',
		kind: 'xyz',
		url:
			'https://owsproxy.lgl-bw.de/owsproxy/ows/WMTS_LGL-BW_ATKIS_DOP_20_C?SERVICE=WMTS&REQUEST=GetTile' +
			'&VERSION=1.0.0&LAYER=DOP_20_C&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible' +
			'&TILEMATRIX=GoogleMapsCompatible:{z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png',
		maxNativeZoom: 20,
		attribution: `© LGL-BW (${YEAR}), ${DL_BY}`
	},
	{
		id: 'by',
		region: 'Bayern',
		kind: 'wms',
		url: 'https://geoservices.bayern.de/od/wms/dop/v1/dop40',
		layers: 'by_dop40c',
		format: 'image/vnd.jpeg-png',
		maxNativeZoom: 19,
		attribution: `© Bayerische Vermessungsverwaltung (${YEAR}), ${CC_BY}`
	},
	{
		id: 'nw',
		region: 'Nordrhein-Westfalen',
		kind: 'wms',
		url: 'https://www.wms.nrw.de/geobasis/wms_nw_dop',
		layers: 'nw_dop_rgb',
		maxNativeZoom: 20,
		attribution: `© Geobasis NRW (${YEAR}), <a href="https://www.govdata.de/dl-de/zero-2-0">dl-de/zero-2-0</a>`
	},
	{
		id: 'ni',
		region: 'Niedersachsen',
		kind: 'wms',
		url: 'https://opendata.lgln.niedersachsen.de/doorman/noauth/dop_wms',
		layers: 'ni_dop20',
		format: 'image/vnd.jpeg-png',
		maxNativeZoom: 20,
		attribution: `© LGLN (${YEAR}), ${CC_BY}`
	},
	{
		id: 'bb',
		region: 'Berlin/Brandenburg',
		kind: 'wms',
		url: 'https://isk.geobasis-bb.de/mapproxy/dop20c/service/wms',
		layers: 'bebb_dop20c',
		maxNativeZoom: 20,
		attribution: `© GeoBasis-DE/LGB (${YEAR}), ${DL_BY}`
	},
	{
		id: 'sn',
		region: 'Sachsen',
		kind: 'wms',
		url: 'https://geodienste.sachsen.de/wms_geosn_dop-rgb/guest',
		layers: 'sn_dop_020',
		maxNativeZoom: 20,
		attribution: `© GeoSN (${YEAR}), ${DL_BY}`
	},
	{
		id: 'th',
		region: 'Thüringen',
		kind: 'wms',
		url: 'https://www.geoproxy.geoportal-th.de/geoproxy/services/DOP20',
		layers: 'th_dop',
		maxNativeZoom: 20,
		attribution: `© GDI-Th (${YEAR}), ${DL_BY}`
	},
	{
		id: 'rp',
		region: 'Rheinland-Pfalz',
		kind: 'wms',
		url: 'https://geo4.service24.rlp.de/wms/rp_dop20.fcgi',
		layers: 'rp_dop20',
		format: 'image/vnd.jpeg-png',
		maxNativeZoom: 20,
		attribution: `© GeoBasis-DE/LVermGeoRP (${YEAR}), ${DL_BY}`
	},
	{
		id: 'mv',
		region: 'Mecklenburg-Vorpommern',
		kind: 'wms',
		url: 'https://www.geodaten-mv.de/dienste/adv_dop',
		layers: 'mv_dop',
		maxNativeZoom: 20,
		attribution: `© GeoBasis-DE/M-V (${YEAR}), ${DL_BY}`
	}
];

function extent(rings: LatLng[][]): Rect {
	const points = rings.flat();
	return {
		south: Math.min(...points.map((p) => p[0])),
		west: Math.min(...points.map((p) => p[1])),
		north: Math.max(...points.map((p) => p[0])),
		east: Math.max(...points.map((p) => p[1]))
	};
}

export const ORTHOPHOTOS: ImagerySource[] = SOURCES.map((source) => {
	const { south, west, north, east } = extent(REGIONS[source.id]);
	const pad = REGION_TOLERANCE * 1.5;
	return {
		...source,
		bounds: [
			[south - pad, west - pad],
			[north + pad, east + pad]
		]
	};
});

const inside = (rect: Rect, [lat, lng]: LatLng) =>
	lat >= rect.south && lat <= rect.north && lng >= rect.west && lng <= rect.east;

/** Even-odd point in polygon test. */
function contains(ring: LatLng[], [lat, lng]: LatLng): boolean {
	let result = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [yi, xi] = ring[i];
		const [yj, xj] = ring[j];
		if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) result = !result;
	}
	return result;
}

/** Whether the segment a–b passes through the rectangle (Liang–Barsky). */
function crosses(rect: Rect, a: LatLng, b: LatLng): boolean {
	const dx = b[1] - a[1];
	const dy = b[0] - a[0];
	let t0 = 0;
	let t1 = 1;
	for (const [p, q] of [
		[-dx, a[1] - rect.west],
		[dx, rect.east - a[1]],
		[-dy, a[0] - rect.south],
		[dy, rect.north - a[0]]
	]) {
		if (p === 0) {
			if (q < 0) return false;
			continue;
		}
		const t = q / p;
		if (p < 0) t0 = Math.max(t0, t);
		else t1 = Math.min(t1, t);
		if (t0 > t1) return false;
	}
	return true;
}

/** Whether a (widened) view rectangle overlaps any of the outlines. */
export function overlaps(view: Rect, rings: LatLng[][]): boolean {
	const rect = {
		south: view.south - REGION_TOLERANCE * 1.5,
		west: view.west - REGION_TOLERANCE * 1.5,
		north: view.north + REGION_TOLERANCE * 1.5,
		east: view.east + REGION_TOLERANCE * 1.5
	};
	const center: LatLng = [(rect.south + rect.north) / 2, (rect.west + rect.east) / 2];
	return rings.some(
		(ring) =>
			contains(ring, center) ||
			ring.some(
				(point, i) => inside(rect, point) || crosses(rect, point, ring[(i + 1) % ring.length])
			)
	);
}

/** Sources whose state overlaps the visible map, at zooms where they are worth loading. */
export function visibleOrthophotos(view: Rect, zoom: number): ImagerySource[] {
	if (zoom < ORTHOPHOTO_MIN_ZOOM) return [];
	return ORTHOPHOTOS.filter(
		({ id, bounds: [[south, west], [north, east]] }) =>
			view.south <= north &&
			view.north >= south &&
			view.west <= east &&
			view.east >= west &&
			overlaps(view, REGIONS[id])
	);
}

/** Every host the orthophotos are loaded from, for the service worker's tile cache. */
export const ORTHOPHOTO_HOSTS = [...new Set(SOURCES.map((s) => new URL(s.url).host))];
