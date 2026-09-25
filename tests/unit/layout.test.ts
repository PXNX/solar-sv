import { describe, expect, test } from 'bun:test';
import { DEFAULT_SETTINGS, layoutRoof, type LatLng, type Roof } from '../../src/lib/solar/layout';

const LAT = 48.7758;
const LNG = 9.1829;
const COS_LAT = Math.cos((LAT * Math.PI) / 180);

/** Metres east/north of Stuttgart → lat/lng. */
const at = (x: number, y: number): LatLng => [LAT + y / 111320, LNG + x / (111320 * COS_LAT)];
/** lat/lng → metres east/north of Stuttgart. */
const metres = ([lat, lng]: LatLng) => ({
	x: (lng - LNG) * 111320 * COS_LAT,
	y: (lat - LAT) * 111320
});

const roof = (outline: LatLng[], pitch: number): Roof => ({ id: 'r', name: 'R', outline, pitch });
const rectangle = [at(0, 0), at(10, 0), at(10, 6), at(0, 6)];

function panelSize(corners: LatLng[]) {
	const [a, b, c] = corners.map(metres);
	return { along: Math.hypot(b.x - a.x, b.y - a.y), up: Math.hypot(c.x - b.x, c.y - b.y) };
}

describe('layoutRoof', () => {
	test('flat 10 × 6 m roof holds an 8 × 3 portrait grid', () => {
		const layout = layoutRoof(roof(rectangle, 0), DEFAULT_SETTINGS);
		expect(layout.panels).toHaveLength(24);
		expect(layout.planArea).toBeCloseTo(60, 1);
		expect(layout.roofArea).toBeCloseTo(60, 1);
	});

	test('pitch foreshortens modules up the slope by cos(pitch), not along the eave', () => {
		for (const pitch of [0, 30, 45]) {
			const layout = layoutRoof(roof(rectangle, pitch), DEFAULT_SETTINGS);
			const { along, up } = panelSize(layout.panels[0]);
			expect(along).toBeCloseTo(DEFAULT_SETTINGS.width, 3);
			expect(up).toBeCloseTo(DEFAULT_SETTINGS.length * Math.cos((pitch * Math.PI) / 180), 3);
		}
	});

	test('steeper roofs have more real surface and fit more rows', () => {
		const flat = layoutRoof(roof(rectangle, 0), DEFAULT_SETTINGS);
		const steep = layoutRoof(roof(rectangle, 45), DEFAULT_SETTINGS);
		expect(steep.roofArea).toBeCloseTo(60 / Math.cos(Math.PI / 4), 1);
		expect(steep.panels.length).toBe(32);
		expect(steep.panels.length).toBeGreaterThan(flat.panels.length);
	});

	test('modules form one rigid grid (shared columns and rows)', () => {
		const trapezoid = [at(0, 0), at(14, 0), at(10, 5), at(4, 5)];
		const layout = layoutRoof(roof(trapezoid, 40), DEFAULT_SETTINGS);
		const xs = new Set(layout.panels.map((p) => metres(p[0]).x.toFixed(3)));
		const ys = new Set(layout.panels.map((p) => metres(p[0]).y.toFixed(3)));
		expect(layout.panels.length).toBeGreaterThan(0);
		// Rows get shorter towards the ridge, but every module sits on the same column lines.
		expect(xs.size).toBeLessThanOrEqual(
			Math.ceil(14 / (DEFAULT_SETTINGS.width + DEFAULT_SETTINGS.gap))
		);
		expect(ys.size).toBe(3);
	});

	test('every module stays inside the outline with the edge margin', () => {
		const layout = layoutRoof(roof(rectangle, 30), DEFAULT_SETTINGS);
		const margin = DEFAULT_SETTINGS.margin;
		for (const corner of layout.panels.flat().map(metres)) {
			expect(corner.x).toBeGreaterThanOrEqual(margin - 1e-6);
			expect(corner.x).toBeLessThanOrEqual(10 - margin + 1e-6);
		}
	});

	test('azimuth follows the side of the eave the roof extends from', () => {
		const south = layoutRoof(roof(rectangle, 30), DEFAULT_SETTINGS);
		expect(south.azimuth).toBeCloseTo(180, 5);
		const north = layoutRoof(
			roof([at(10, 6), at(0, 6), at(0, 0), at(10, 0)], 30),
			DEFAULT_SETTINGS
		);
		expect(north.azimuth).toBeCloseTo(0, 5);
		const east = layoutRoof(roof([at(6, 10), at(6, 0), at(0, 0), at(0, 10)], 30), DEFAULT_SETTINGS);
		expect(east.azimuth).toBeCloseTo(90, 5);
	});

	test('landscape swaps the module axes', () => {
		const layout = layoutRoof(roof(rectangle, 0), {
			...DEFAULT_SETTINGS,
			orientation: 'landscape'
		});
		const { along, up } = panelSize(layout.panels[0]);
		expect(along).toBeCloseTo(DEFAULT_SETTINGS.length, 3);
		expect(up).toBeCloseTo(DEFAULT_SETTINGS.width, 3);
	});

	test('degenerate outlines produce no modules instead of throwing', () => {
		expect(layoutRoof(roof([at(0, 0), at(0, 0), at(1, 1)], 30), DEFAULT_SETTINGS).panels).toEqual(
			[]
		);
		expect(layoutRoof(roof(rectangle, 30), { ...DEFAULT_SETTINGS, width: 0 }).panels).toEqual([]);
	});

	test('roofs too small for one module stay empty', () => {
		const tiny = [at(0, 0), at(1, 0), at(1, 1), at(0, 1)];
		expect(layoutRoof(roof(tiny, 35), DEFAULT_SETTINGS).panels).toHaveLength(0);
	});
});

describe('facingAzimuth', () => {
	test('matches the layout for the same eave and roof side', async () => {
		const { facingAzimuth } = await import('../../src/lib/solar/layout');
		expect(facingAzimuth([at(0, 0), at(10, 0)], at(5, 3))).toBeCloseTo(180, 5);
		expect(facingAzimuth([at(0, 0), at(10, 0)], at(5, -3))).toBeCloseTo(0, 5);
		expect(facingAzimuth([at(0, 0), at(0, 10)], at(3, 5))).toBeCloseTo(270, 5);
		const layout = layoutRoof(
			roof([at(0, 0), at(8, 6), at(2, 12), at(-4, 6)], 30),
			DEFAULT_SETTINGS
		);
		expect(facingAzimuth([at(0, 0), at(8, 6)], layout.center)).toBeCloseTo(layout.azimuth, 5);
	});

	test('is undefined on the eave line itself', async () => {
		const { facingAzimuth } = await import('../../src/lib/solar/layout');
		expect(facingAzimuth([at(0, 0), at(10, 0)], at(5, 0))).toBeNull();
	});
});
