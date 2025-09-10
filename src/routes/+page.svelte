<script lang="ts">
	import { Map, TileLayer, Polygon, Popup, CircleMarker } from 'sveaflet';
	import { onMount } from 'svelte';
	import L from 'leaflet';

	interface DrawnPolygon {
		id: string;
		coordinates: [number, number][];
		area: number;
		name: string;
		solarPanels: SolarPanel[];
		angle: number;
	}

	interface SolarPanel {
		id: string;
		coordinates: [number, number][];
		center: [number, number];
		area: number; // in m²
	}

	let polygons = $state<DrawnPolygon[]>([]);
	let isDrawing = $state(false);
	let mapInstance: L.Map;
	let drawingPoints = $state<[number, number][]>([]);
	let polygonCounter = $state(1);

	// Solar panel settings
	let panelWidth = $state(2.0); // meters
	let panelHeight = $state(1.0); // meters
	let panelSpacing = $state(0.5); // meters between panels
	let costPerPanel = $state(500); // cost per panel in currency units

	function handleMapClick(e: any) {
		if (isDrawing) {
			const point: [number, number] = [e.latlng.lat, e.latlng.lng];
			drawingPoints = [...drawingPoints, point];
		}
	}

	function startDrawing() {
		isDrawing = true;
		drawingPoints = [];
		if (mapInstance) {
			mapInstance.doubleClickZoom.disable();
		}
	}

	function calculateAngle(p1: [number, number], p2: [number, number]): number {
		const dx = p2[1] - p1[1]; // longitude difference
		const dy = p2[0] - p1[0]; // latitude difference
		return Math.atan2(dy, dx);
	}

	function metersToLatLng(meters: number, lat: number): number {
		// Approximate conversion: 1 degree latitude ≈ 111,320 meters
		// Longitude varies by latitude: 1 degree longitude ≈ 111,320 * cos(latitude) meters
		return meters / (111320 * Math.cos((lat * Math.PI) / 180));
	}

	function rotatePoint(
		point: [number, number],
		center: [number, number],
		angle: number
	): [number, number] {
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const dx = point[1] - center[1];
		const dy = point[0] - center[0];
		return [center[0] + dx * sin + dy * cos, center[1] + dx * cos - dy * sin];
	}

	function createSolarPanel(
		center: [number, number],
		width: number,
		height: number,
		angle: number
	): [number, number][] {
		// Convert meters to lat/lng degrees
		const widthDeg = metersToLatLng(width, center[0]);
		const heightDeg = metersToLatLng(height, center[0]);

		const halfWidth = widthDeg / 2;
		const halfHeight = heightDeg / 2;

		// Create rectangle corners relative to center
		const corners: [number, number][] = [
			[center[0] - halfHeight, center[1] - halfWidth],
			[center[0] - halfHeight, center[1] + halfWidth],
			[center[0] + halfHeight, center[1] + halfWidth],
			[center[0] + halfHeight, center[1] - halfWidth]
		];

		// Rotate each corner around the center
		return corners.map((corner) => rotatePoint(corner, center, angle));
	}

	function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
		const [x, y] = point;
		let inside = false;

		for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
			const [xi, yi] = polygon[i];
			const [xj, yj] = polygon[j];

			if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
				inside = !inside;
			}
		}

		return inside;
	}

	function rectanglesOverlap(rect1: [number, number][], rect2: [number, number][]): boolean {
		// Simple bounding box overlap check
		const rect1MinLat = Math.min(...rect1.map((p) => p[0]));
		const rect1MaxLat = Math.max(...rect1.map((p) => p[0]));
		const rect1MinLng = Math.min(...rect1.map((p) => p[1]));
		const rect1MaxLng = Math.max(...rect1.map((p) => p[1]));

		const rect2MinLat = Math.min(...rect2.map((p) => p[0]));
		const rect2MaxLat = Math.max(...rect2.map((p) => p[0]));
		const rect2MinLng = Math.min(...rect2.map((p) => p[1]));
		const rect2MaxLng = Math.max(...rect2.map((p) => p[1]));

		return !(
			rect1MaxLat < rect2MinLat ||
			rect2MaxLat < rect1MinLat ||
			rect1MaxLng < rect2MinLng ||
			rect2MaxLng < rect1MinLng
		);
	}

	function solarPanelFitsInPolygon(
		panelCorners: [number, number][],
		polygon: [number, number][]
	): boolean {
		// Check if all corners of solar panel are inside polygon
		return panelCorners.every((corner) => pointInPolygon(corner, polygon));
	}

	function generateSolarPanels(polygon: [number, number][], angle: number): SolarPanel[] {
		if (polygon.length < 3) return [];

		// Find bounding box of polygon
		const lats = polygon.map((p) => p[0]);
		const lngs = polygon.map((p) => p[1]);
		const minLat = Math.min(...lats);
		const maxLat = Math.max(...lats);
		const minLng = Math.min(...lngs);
		const maxLng = Math.max(...lngs);

		const centerLat = (minLat + maxLat) / 2;

		// Convert panel dimensions and spacing to degrees
		const panelWidthDeg = metersToLatLng(panelWidth, centerLat);
		const panelHeightDeg = metersToLatLng(panelHeight, centerLat);
		const spacingWidthDeg = metersToLatLng(panelSpacing, centerLat);
		const spacingHeightDeg = metersToLatLng(panelSpacing, centerLat);

		const solarPanels: SolarPanel[] = [];
		const placedPanels: [number, number][][] = [];
		let id = 0;

		// Generate grid of solar panels with spacing
		const stepWidth = panelWidthDeg + spacingWidthDeg;
		const stepHeight = panelHeightDeg + spacingHeightDeg;

		for (let lat = minLat; lat <= maxLat; lat += stepHeight) {
			for (let lng = minLng; lng <= maxLng; lng += stepWidth) {
				const center: [number, number] = [lat + panelHeightDeg / 2, lng + panelWidthDeg / 2];
				const panelCorners = createSolarPanel(center, panelWidth, panelHeight, angle);

				// Check if panel fits completely within polygon
				if (solarPanelFitsInPolygon(panelCorners, polygon)) {
					// Check if panel overlaps with any existing panels
					let overlaps = false;
					for (const existingPanel of placedPanels) {
						if (rectanglesOverlap(panelCorners, existingPanel)) {
							overlaps = true;
							break;
						}
					}

					if (!overlaps) {
						const panelArea = panelWidth * panelHeight;
						solarPanels.push({
							id: `panel_${id++}`,
							coordinates: panelCorners,
							center: center,
							area: panelArea
						});
						placedPanels.push(panelCorners);
					}
				}
			}
		}

		return solarPanels;
	}

	function finishPolygon() {
		if (isDrawing && drawingPoints.length >= 3) {
			const area = calculatePolygonArea(drawingPoints);
			const angle =
				drawingPoints.length >= 2 ? calculateAngle(drawingPoints[0], drawingPoints[1]) : 0;
			const solarPanels = generateSolarPanels(drawingPoints, angle);

			const newPolygon: DrawnPolygon = {
				id: `polygon_${Date.now()}`,
				coordinates: [...drawingPoints],
				area: area,
				name: `Solar Site ${polygonCounter}`,
				solarPanels: solarPanels,
				angle: angle
			};

			polygons = [...polygons, newPolygon];
			polygonCounter++;

			// Reset drawing state
			isDrawing = false;
			drawingPoints = [];
			if (mapInstance) {
				mapInstance.doubleClickZoom.enable();
			}
		}
	}

	function cancelDrawing() {
		isDrawing = false;
		drawingPoints = [];
		if (mapInstance) {
			mapInstance.doubleClickZoom.enable();
		}
	}

	function calculatePolygonArea(coords: [number, number][]): number {
		// Simple area calculation using shoelace formula (approximate)
		if (coords.length < 3) return 0;

		let area = 0;
		for (let i = 0; i < coords.length; i++) {
			const j = (i + 1) % coords.length;
			area += coords[i][0] * coords[j][1];
			area -= coords[j][0] * coords[i][1];
		}
		return Math.abs(area / 2) * 111.32 * 111.32; // Rough conversion to km²
	}

	function deletePolygon(id: string) {
		polygons = polygons.filter((p) => p.id !== id);
	}

	function clearAllPolygons() {
		polygons = [];
		polygonCounter = 1;
	}

	function formatArea(area: number): string {
		if (area < 1) {
			return `${(area * 1000000).toFixed(0)} m²`;
		}
		return `${area.toFixed(2)} km²`;
	}

	function updateSolarPanels() {
		// Regenerate solar panels for all polygons with new settings
		polygons = polygons.map((polygon) => ({
			...polygon,
			solarPanels: generateSolarPanels(polygon.coordinates, polygon.angle)
		}));
	}

	// Calculated values
	const totalSolarPanels = $derived(polygons.reduce((sum, p) => sum + p.solarPanels.length, 0));
	const totalSolarArea = $derived(
		polygons.reduce(
			(sum, p) => sum + p.solarPanels.reduce((panelSum, panel) => panelSum + panel.area, 0),
			0
		)
	);
	const totalCost = $derived(totalSolarPanels * costPerPanel);
	const averagePanelsPerSite = $derived(
		polygons.length > 0 ? totalSolarPanels / polygons.length : 0
	);
</script>

<div class="bg-base-100 flex h-screen">
	<!-- Sidebar -->
	<div class="bg-base-200 flex w-80 flex-col overflow-y-auto border-r p-4">
		<!-- Controls Section -->
		<div class="mb-6">
			<h2 class="mb-4 text-lg font-bold">Solar Panel Designer</h2>

			<!-- Drawing Controls -->
			<div class="card bg-base-100 mb-4 shadow">
				<div class="card-body p-4">
					<h3 class="mb-3 font-semibold">Drawing Controls</h3>
					<div class="space-y-2">
						{#if !isDrawing}
							<button class="btn btn-primary w-full" onclick={startDrawing}>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-5 w-5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
									/>
								</svg>
								Draw Solar Site
							</button>
						{:else}
							<button
								class="btn btn-success w-full"
								onclick={finishPolygon}
								disabled={drawingPoints.length < 3}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-5 w-5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 13l4 4L19 7"
									/>
								</svg>
								Finish ({drawingPoints.length} points)
							</button>
							<button class="btn btn-ghost w-full" onclick={cancelDrawing}>Cancel</button>
						{/if}
						<button
							class="btn btn-outline w-full"
							onclick={clearAllPolygons}
							disabled={polygons.length === 0}
						>
							Clear All Sites
						</button>
					</div>
				</div>
			</div>

			<!-- Solar Panel Settings -->
			<div class="card bg-base-100 mb-4 shadow">
				<div class="card-body p-4">
					<h3 class="mb-3 font-semibold">Solar Panel Settings</h3>
					<div class="space-y-4">
						<div class="form-control">
							<label class="label">
								<span class="label-text">Panel Width (m)</span>
								<span class="label-text-alt">{panelWidth}m</span>
							</label>
							<input
								type="range"
								min="1"
								max="3"
								step="0.1"
								bind:value={panelWidth}
								onchange={updateSolarPanels}
								class="range range-primary range-sm"
							/>
						</div>

						<div class="form-control">
							<label class="label">
								<span class="label-text">Panel Height (m)</span>
								<span class="label-text-alt">{panelHeight}m</span>
							</label>
							<input
								type="range"
								min="0.5"
								max="2"
								step="0.1"
								bind:value={panelHeight}
								onchange={updateSolarPanels}
								class="range range-primary range-sm"
							/>
						</div>

						<div class="form-control">
							<label class="label">
								<span class="label-text">Panel Spacing (m)</span>
								<span class="label-text-alt">{panelSpacing}m</span>
							</label>
							<input
								type="range"
								min="0.1"
								max="2"
								step="0.1"
								bind:value={panelSpacing}
								onchange={updateSolarPanels}
								class="range range-primary range-sm"
							/>
						</div>

						<div class="form-control">
							<label class="label">
								<span class="label-text">Cost per Panel</span>
							</label>
							<input
								type="number"
								min="100"
								max="2000"
								step="50"
								bind:value={costPerPanel}
								class="input input-bordered input-sm"
								placeholder="500"
							/>
						</div>

						<div class="text-base-content/60 bg-base-200 rounded p-2 text-xs">
							Panel Size: {panelWidth}m × {panelHeight}m = {(panelWidth * panelHeight).toFixed(2)}m²
							each
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Solar Sites List -->
		<div class="flex-1">
			<h2 class="mb-4 text-lg font-semibold">Solar Sites ({polygons.length})</h2>

			{#if polygons.length === 0}
				<div class="text-base-content/60 mt-8 text-center">
					<div class="mb-2 text-4xl">☀️</div>
					<p>No solar sites yet.</p>
					<p class="mt-2 text-sm">Draw your first site to start planning!</p>
					<div class="text-base-content/50 bg-base-100 mt-4 rounded p-3 text-xs">
						<p><strong>How to use:</strong></p>
						<p>🔴 First point: Sets panel origin</p>
						<p>🟢 Second point: Sets panel angle</p>
						<p>🔵 More points: Complete the site boundary</p>
					</div>
				</div>
			{:else}
				<div class="mb-6 space-y-3">
					{#each polygons as polygon, index}
						<div class="card bg-base-100 compact shadow">
							<div class="card-body p-3">
								<div class="flex items-start justify-between">
									<div class="flex-1">
										<h3 class="text-sm font-medium">{polygon.name}</h3>
										<div class="text-base-content/70 mt-1 space-y-1 text-xs">
											<p>Site Area: {formatArea(polygon.area)}</p>
											<p>Solar Panels: {polygon.solarPanels.length}</p>
											<p>
												Solar Area: {polygon.solarPanels
													.reduce((sum, p) => sum + p.area, 0)
													.toFixed(1)}m²
											</p>
											<p>Angle: {((polygon.angle * 180) / Math.PI).toFixed(1)}°</p>
											<p class="text-success font-semibold">
												Cost: ${(polygon.solarPanels.length * costPerPanel).toLocaleString()}
											</p>
										</div>
									</div>
									<button class="btn btn-error btn-xs" onclick={() => deletePolygon(polygon.id)}
										>×</button
									>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Summary Statistics -->
		{#if polygons.length > 0}
			<div class="card bg-primary text-primary-content shadow-lg">
				<div class="card-body p-4">
					<h3 class="mb-3 font-bold">Project Summary</h3>
					<div class="space-y-2 text-sm">
						<div class="flex justify-between">
							<span>Total Sites:</span>
							<span class="font-bold">{polygons.length}</span>
						</div>
						<div class="flex justify-between">
							<span>Total Panels:</span>
							<span class="font-bold">{totalSolarPanels.toLocaleString()}</span>
						</div>
						<div class="flex justify-between">
							<span>Solar Area:</span>
							<span class="font-bold">{totalSolarArea.toFixed(0)}m²</span>
						</div>
						<div class="flex justify-between">
							<span>Avg. Panels/Site:</span>
							<span class="font-bold">{averagePanelsPerSite.toFixed(1)}</span>
						</div>
						<hr class="border-primary-content/30 my-2" />
						<div class="flex justify-between text-lg">
							<span class="font-bold">Total Cost:</span>
							<span class="font-bold">${totalCost.toLocaleString()}</span>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Map Container -->
	<div class="relative flex-1">
		<Map
			options={{
				center: [51.505, -0.09],
				zoom: 16
			}}
			style="width:100%;height:100%;"
			onclick={handleMapClick}
			bind:instance={mapInstance}
		>
			<TileLayer url={'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} />

			<!-- Render completed polygons -->
			{#each polygons as polygon}
				<Polygon
					latLngs={polygon.coordinates}
					options={{
						color: '#059669',
						weight: 2,
						opacity: 0.8,
						fillOpacity: 0.1
					}}
				>
					<Popup>
						<div class="p-2">
							<h3 class="font-semibold">{polygon.name}</h3>
							<p class="text-sm">Site Area: {formatArea(polygon.area)}</p>
							<p class="text-sm">Solar Panels: {polygon.solarPanels.length}</p>
							<p class="text-sm">
								Solar Area: {polygon.solarPanels.reduce((sum, p) => sum + p.area, 0).toFixed(1)}m²
							</p>
							<p class="text-sm">
								Installation Cost: ${(polygon.solarPanels.length * costPerPanel).toLocaleString()}
							</p>
							<button class="btn btn-error btn-xs mt-2" onclick={() => deletePolygon(polygon.id)}>
								Delete Site
							</button>
						</div>
					</Popup>
				</Polygon>

				<!-- Render solar panels -->
				{#each polygon.solarPanels as panel}
					<Polygon
						latLngs={panel.coordinates}
						options={{
							color: '#1d4ed8',
							weight: 1,
							opacity: 0.8,
							fillColor: '#3b82f6',
							fillOpacity: 0.6
						}}
					>
						<Popup>
							<div class="p-1">
								<p class="text-sm font-medium">Solar Panel</p>
								<p class="text-xs">Size: {panelWidth}m × {panelHeight}m</p>
								<p class="text-xs">Area: {panel.area.toFixed(2)}m²</p>
								<p class="text-xs">Cost: ${costPerPanel}</p>
							</div>
						</Popup>
					</Polygon>
				{/each}
			{/each}

			<!-- Render current drawing polygon -->
			{#if isDrawing && drawingPoints.length >= 3}
				<Polygon
					latLngs={drawingPoints}
					options={{
						color: '#059669',
						weight: 2,
						opacity: 0.6,
						fillOpacity: 0.2,
						dashArray: '5, 10'
					}}
				/>
			{/if}

			<!-- Render drawing points as circles -->
			{#if isDrawing}
				{#each drawingPoints as point, index}
					<CircleMarker
						latLng={point}
						options={{
							radius: 6,
							fillColor: index === 0 ? '#ef4444' : index === 1 ? '#22c55e' : '#3b82f6',
							color: '#ffffff',
							weight: 2,
							opacity: 1,
							fillOpacity: 0.8
						}}
					>
						<Popup>
							<div class="p-1">
								<p class="text-sm font-medium">
									{index === 0
										? '🔴 Origin Point'
										: index === 1
											? '🟢 Direction Point'
											: `🔵 Point ${index + 1}`}
								</p>
								<p class="text-xs">Lat: {point[0].toFixed(6)}</p>
								<p class="text-xs">Lng: {point[1].toFixed(6)}</p>
							</div>
						</Popup>
					</CircleMarker>
				{/each}
			{/if}
		</Map>

		<!-- Drawing Status -->
		{#if isDrawing}
			<div class="absolute top-4 right-4 z-[1000]">
				<div class="alert alert-info max-w-xs shadow-lg">
					<div class="text-sm">
						<div class="font-bold">Drawing Solar Site</div>
						<p>Points: {drawingPoints.length}</p>
						{#if drawingPoints.length === 0}
							<p class="text-xs">🔴 Click to set panel origin</p>
						{:else if drawingPoints.length === 1}
							<p class="text-xs">🟢 Click to set panel angle</p>
						{:else}
							<p class="text-xs">🔵 Click to add boundary points</p>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
	}
</style>
