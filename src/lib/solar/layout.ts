export type LatLng = [lat: number, lng: number];

interface Point {
	x: number;
	y: number;
}

interface Rect {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

export interface PanelSettings {
	/** Long side of a module in metres. */
	length: number;
	/** Short side of a module in metres. */
	width: number;
	orientation: 'portrait' | 'landscape';
	/** Gap between neighbouring modules in metres (clamps, expansion joints). */
	gap: number;
	/** Keep-out distance from every roof edge in metres. */
	margin: number;
	/** Peak power per module in Wp. */
	watts: number;
	/** Cost per module in EUR. */
	cost: number;
}

export interface Roof {
	id: string;
	name: string;
	/** Outline as drawn on the map. The first edge (point 0 → 1) is the eave. */
	outline: LatLng[];
	/** Roof pitch in degrees, 0 = flat. */
	pitch: number;
}

export interface RoofLayout {
	/** Each panel as four corners, projected onto the map (i.e. foreshortened by the pitch). */
	panels: LatLng[][];
	/** Area as seen from above, m². */
	planArea: number;
	/** True sloped surface area, m². */
	roofArea: number;
	/** Module surface area, m². */
	panelArea: number;
	/** Share of the sloped surface covered by modules, 0–1. */
	coverage: number;
	/** Compass direction the roof face points to (down-slope), degrees clockwise from north. */
	azimuth: number;
	eave: [LatLng, LatLng];
	center: LatLng;
}

export const DEFAULT_SETTINGS: PanelSettings = {
	length: 1.72,
	width: 1.13,
	orientation: 'portrait',
	gap: 0.02,
	margin: 0.3,
	watts: 430,
	cost: 250
};

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const EPS = 1e-9;

/**
 * Local tangent-plane projection around `origin` (x = east, y = north, metres).
 * Error is far below a centimetre over roof-sized distances.
 */
function localProjection(origin: LatLng) {
	const cosLat = Math.cos(origin[0] * DEG);
	return {
		toLocal: ([lat, lng]: LatLng): Point => ({
			x: (lng - origin[1]) * DEG * EARTH_RADIUS * cosLat,
			y: (lat - origin[0]) * DEG * EARTH_RADIUS
		}),
		toLatLng: ({ x, y }: Point): LatLng => [
			origin[0] + y / EARTH_RADIUS / DEG,
			origin[1] + x / (EARTH_RADIUS * cosLat) / DEG
		]
	};
}

function signedArea(poly: Point[]): number {
	let area = 0;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		area += poly[j].x * poly[i].y - poly[i].x * poly[j].y;
	}
	return area / 2;
}

function centroid(poly: Point[]): Point {
	const a = signedArea(poly);
	if (Math.abs(a) < EPS) {
		const n = poly.length;
		return {
			x: poly.reduce((s, p) => s + p.x, 0) / n,
			y: poly.reduce((s, p) => s + p.y, 0) / n
		};
	}
	let cx = 0;
	let cy = 0;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const f = poly[j].x * poly[i].y - poly[i].x * poly[j].y;
		cx += (poly[j].x + poly[i].x) * f;
		cy += (poly[j].y + poly[i].y) * f;
	}
	return { x: cx / (6 * a), y: cy / (6 * a) };
}

function pointInPolygon(p: Point, poly: Point[]): boolean {
	let inside = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const a = poly[i];
		const b = poly[j];
		if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
			inside = !inside;
		}
	}
	return inside;
}

/** Liang–Barsky: does a piece of segment a→b with positive length lie strictly inside `r`? */
function segmentEntersRect(a: Point, b: Point, r: Rect): boolean {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const p = [-dx, dx, -dy, dy];
	const q = [a.x - r.minX, r.maxX - a.x, a.y - r.minY, r.maxY - a.y];
	let t0 = 0;
	let t1 = 1;
	for (let i = 0; i < 4; i++) {
		if (Math.abs(p[i]) < EPS) {
			if (q[i] <= EPS) return false;
		} else {
			const t = q[i] / p[i];
			if (p[i] < 0) t0 = Math.max(t0, t);
			else t1 = Math.min(t1, t);
			if (t0 >= t1) return false;
		}
	}
	return t1 - t0 > EPS;
}

/** A rectangle lies inside a simple polygon iff its centre is inside and no polygon edge cuts into it. */
function rectFits(r: Rect, poly: Point[]): boolean {
	const center = { x: (r.minX + r.maxX) / 2, y: (r.minY + r.maxY) / 2 };
	if (!pointInPolygon(center, poly)) return false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		if (segmentEntersRect(poly[j], poly[i], r)) return false;
	}
	return true;
}

interface Grid {
	/** Module footprint as seen from above. */
	cellW: number;
	cellH: number;
	stepX: number;
	stepY: number;
	marginX: number;
	marginY: number;
}

/** Grid offsets tried per axis; the grid itself is always rigid. */
const PHASES = 8;

/**
 * Lays one rigid grid over the whole roof (x along the eave, y up the slope, top-view metres)
 * and keeps every cell that fits. Only the grid offset is optimised: most modules first, then
 * closest to the eave, then best centred.
 */
function packGrid(roof: Point[], grid: Grid): Rect[] {
	const { cellW, cellH, stepX, stepY, marginX, marginY } = grid;
	const minX = Math.min(...roof.map((p) => p.x));
	const maxX = Math.max(...roof.map((p) => p.x));
	const minY = Math.min(...roof.map((p) => p.y));
	const maxY = Math.max(...roof.map((p) => p.y));

	let best: Rect[] = [];
	let bestBalance = Infinity;
	for (let j = 0; j < PHASES; j++) {
		for (let i = 0; i < PHASES; i++) {
			const cells: Rect[] = [];
			for (
				let y = minY + marginY + (j / PHASES) * stepY;
				y + cellH + marginY <= maxY + EPS;
				y += stepY
			) {
				for (
					let x = minX + marginX + (i / PHASES) * stepX;
					x + cellW + marginX <= maxX + EPS;
					x += stepX
				) {
					const keepOut = {
						minX: x - marginX,
						minY: y - marginY,
						maxX: x + cellW + marginX,
						maxY: y + cellH + marginY
					};
					if (rectFits(keepOut, roof))
						cells.push({ minX: x, minY: y, maxX: x + cellW, maxY: y + cellH });
				}
			}
			if (cells.length === 0 || cells.length < best.length) continue;

			const left = Math.min(...cells.map((c) => c.minX)) - minX;
			const right = maxX - Math.max(...cells.map((c) => c.maxX));
			const balance = Math.abs(left - right);
			// Rows are tried bottom-up, so on a tie the earlier (eave-hugging) row offset is kept.
			const sameRowOffset = best.length > 0 && Math.abs(best[0].minY - cells[0].minY) < EPS;
			if (cells.length > best.length || (sameRowOffset && balance < bestBalance - EPS)) {
				best = cells;
				bestBalance = balance;
			}
		}
	}
	return best;
}

/**
 * Lays out modules on a pitched roof face.
 *
 * The outline is what you see from above; its first edge is the eave. The whole roof is rotated
 * once so the eave is horizontal, one grid of modules is laid over it, and the result is rotated
 * back. Looking down on a pitched roof, everything running up the slope appears shorter by
 * cos(pitch), so a module's top-view depth is its length × cos(pitch) while its width along the
 * eave stays the same.
 */
export function layoutRoof(roof: Roof, settings: PanelSettings): RoofLayout {
	const proj = localProjection(roof.outline[0]);
	const plan = roof.outline.map(proj.toLocal);
	const center = centroid(plan);
	const planArea = Math.abs(signedArea(plan));
	const cosPitch = Math.cos(Math.min(Math.max(roof.pitch, 0), 85) * DEG);
	const roofArea = planArea / cosPitch;

	const [p0, p1] = plan;
	const eaveLength = Math.hypot(p1.x - p0.x, p1.y - p0.y);
	const empty: RoofLayout = {
		panels: [],
		planArea,
		roofArea,
		panelArea: 0,
		coverage: 0,
		azimuth: 0,
		eave: [roof.outline[0], roof.outline[1]],
		center: proj.toLatLng(center)
	};
	if (plan.length < 3 || eaveLength < 0.01) return empty;

	// u runs along the eave, n points up the slope (into the roof).
	const u = { x: (p1.x - p0.x) / eaveLength, y: (p1.y - p0.y) / eaveLength };
	let n = { x: -u.y, y: u.x };
	if ((center.x - p0.x) * n.x + (center.y - p0.y) * n.y < 0) n = { x: -n.x, y: -n.y };

	// Rotate the whole roof into the eave frame and back; no per-module rotation.
	const toRoof = (p: Point): Point => {
		const dx = p.x - p0.x;
		const dy = p.y - p0.y;
		return { x: dx * u.x + dy * u.y, y: dx * n.x + dy * n.y };
	};
	const toMap = (q: Point): LatLng =>
		proj.toLatLng({ x: p0.x + u.x * q.x + n.x * q.y, y: p0.y + u.y * q.x + n.y * q.y });

	const [w, h] =
		settings.orientation === 'portrait'
			? [settings.width, settings.length]
			: [settings.length, settings.width];
	// Anything measured up the slope (module length, gaps, edge margin) is foreshortened.
	const grid: Grid = {
		cellW: w,
		cellH: h * cosPitch,
		stepX: w + settings.gap,
		stepY: (h + settings.gap) * cosPitch,
		marginX: settings.margin,
		marginY: settings.margin * cosPitch
	};
	const rects = w > 0 && h > 0 ? packGrid(plan.map(toRoof), grid) : [];

	const panels = rects.map((r) => [
		toMap({ x: r.minX, y: r.minY }),
		toMap({ x: r.maxX, y: r.minY }),
		toMap({ x: r.maxX, y: r.maxY }),
		toMap({ x: r.minX, y: r.maxY })
	]);
	const panelArea = rects.length * w * h;
	const azimuth = (((Math.atan2(-n.x, -n.y) / DEG) % 360) + 360) % 360;

	return {
		...empty,
		panels,
		panelArea,
		coverage: roofArea > 0 ? panelArea / roofArea : 0,
		azimuth
	};
}

/**
 * Direction a roof face will point to (down-slope, degrees clockwise from north), given its
 * eave and any point on the roof side of it — used to preview the result while drawing.
 * Returns null while the point lies on the eave line.
 */
export function facingAzimuth(eave: [LatLng, LatLng], inside: LatLng): number | null {
	const proj = localProjection(eave[0]);
	const p1 = proj.toLocal(eave[1]);
	const q = proj.toLocal(inside);
	const length = Math.hypot(p1.x, p1.y);
	if (length < 0.01) return null;
	let n = { x: -p1.y / length, y: p1.x / length };
	const side = q.x * n.x + q.y * n.y;
	if (Math.abs(side) < 0.05) return null;
	if (side < 0) n = { x: -n.x, y: -n.y };
	return (((Math.atan2(-n.x, -n.y) / DEG) % 360) + 360) % 360;
}
