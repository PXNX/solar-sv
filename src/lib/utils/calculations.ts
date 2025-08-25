import type { PanelConfig, SolarAnalysis } from '$lib/types';

export function calculatePolygonArea(latlngs: L.LatLng[]): number {
	const pointsCount = latlngs.length;
	let area = 0.0;
	const d2r = Math.PI / 180;

	if (pointsCount > 2) {
		for (let i = 0; i < pointsCount; i++) {
			const p1 = latlngs[i];
			const p2 = latlngs[(i + 1) % pointsCount];
			area += (p2.lng - p1.lng) * d2r * (2 + Math.sin(p1.lat * d2r) + Math.sin(p2.lat * d2r));
		}
		area = (area * 6378137.0 * 6378137.0) / 2.0;
	}

	return Math.abs(area);
}

export function calculateSolarPotential(roofArea: number, config: PanelConfig): SolarAnalysis {
	const panelArea = config.width * config.height;
	const effectivePanelArea = (config.width + config.spacing) * (config.height + config.spacing);
	const availableArea = roofArea * config.roofCoverage;
	const panelCount = Math.floor(availableArea / effectivePanelArea);
	const totalPanelArea = panelCount * panelArea;
	const estimatedPowerOutput = totalPanelArea * 0.2; // 200W/m²
	const efficiency = (totalPanelArea / roofArea) * 100;

	return {
		roofArea,
		availableArea,
		panelArea,
		effectivePanelArea,
		panelCount,
		totalPanelArea,
		estimatedPowerOutput,
		efficiency
	};
}
