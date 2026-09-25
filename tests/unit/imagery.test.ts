import { describe, expect, test } from 'bun:test';
import { ORTHOPHOTO_HOSTS, ORTHOPHOTOS, visibleOrthophotos } from '../../src/lib/map/imagery';

/** A view of roughly one street block (zoom 19) around a point. */
const around = (lat: number, lng: number, half = 0.002) => ({
	south: lat - half,
	west: lng - half,
	north: lat + half,
	east: lng + half
});

const ids = (lat: number, lng: number, zoom = 19) =>
	visibleOrthophotos(around(lat, lng), zoom).map((source) => source.id);

describe('visibleOrthophotos', () => {
	test.each([
		['Stuttgart', 48.7781, 9.1815, ['bw']],
		['Munich', 48.1374, 11.5755, ['by']],
		['Düsseldorf', 51.2277, 6.7735, ['nw']],
		['Hanover', 52.3745, 9.7386, ['ni']],
		['Berlin', 52.52, 13.405, ['bb']],
		['Potsdam', 52.3906, 13.0645, ['bb']],
		['Dresden', 51.0504, 13.7373, ['sn']],
		['Erfurt', 50.9787, 11.0328, ['th']],
		['Mainz', 49.9929, 8.2473, ['rp']],
		['Rostock', 54.0924, 12.0991, ['mv']],
		['Stralsund (Rügen side)', 54.33, 13.3, ['mv']],
		['Frankfurt (Hessen, no open service)', 50.1109, 8.6821, []],
		['Hamburg', 53.5511, 9.9937, []],
		['Paris', 48.8566, 2.3522, []]
	])('%s', (_, lat, lng, expected) => {
		expect(ids(lat, lng)).toEqual(expected);
	});

	test('near a border both states load', () => {
		// Ulm (BW) and Neu-Ulm (BY) face each other across the Danube.
		expect(ids(48.3984, 9.9916).sort()).toEqual(['bw', 'by']);
	});

	test('nothing loads when zoomed out', () => {
		expect(ids(48.7781, 9.1815, 12)).toEqual([]);
		expect(ids(48.7781, 9.1815, 13)).toEqual(['bw']);
	});

	test('every source has a request extent around its state', () => {
		for (const source of ORTHOPHOTOS) {
			const [[south, west], [north, east]] = source.bounds;
			expect(south).toBeLessThan(north);
			expect(west).toBeLessThan(east);
			expect(south).toBeGreaterThan(47);
			expect(north).toBeLessThan(55.2);
		}
	});

	test('service worker hosts cover every source', () => {
		for (const source of ORTHOPHOTOS) {
			expect(ORTHOPHOTO_HOSTS).toContain(new URL(source.url).host);
		}
	});
});
