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
		panelArea: number; // Total area covered by panels
		coverage: number; // Percentage of roof covered
	}

	interface SolarPanel {
		id: string;
		coordinates: [number, number][];
		center: [number, number];
		area: number;
	}

	let polygons = $state<DrawnPolygon[]>([]);
	let isDrawing = $state(false);
	let mapInstance: L.Map | null = $state(null);
	let drawingPoints = $state<[number, number][]>([]);
	let polygonCounter = $state(1);

	// Enhanced settings with text inputs
	let panelWidth = $state(2.0);
	let panelHeight = $state(1.0);
	let panelSpacing = $state(0.5);
	let costPerPanel = $state(500);

	// Performance optimization: Group panels for rendering
	let showPanelDetails = $state(false);
	let isSettingsOpen = $state(false);

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
		const dx = p2[1] - p1[1];
		const dy = p2[0] - p1[0];
		return Math.atan2(dy, dx);
	}

	function metersToLatLng(meters: number, lat: number): number {
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
		const widthDeg = metersToLatLng(width, center[0]);
		const heightDeg = metersToLatLng(height, center[0]);

		const halfWidth = widthDeg / 2;
		const halfHeight = heightDeg / 2;

		const corners: [number, number][] = [
			[center[0] - halfHeight, center[1] - halfWidth],
			[center[0] - halfHeight, center[1] + halfWidth],
			[center[0] + halfHeight, center[1] + halfWidth],
			[center[0] + halfHeight, center[1] - halfWidth]
		];

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
		return panelCorners.every((corner) => pointInPolygon(corner, polygon));
	}

	function generateSolarPanels(polygon: [number, number][], angle: number): SolarPanel[] {
		if (polygon.length < 3) return [];

		const lats = polygon.map((p) => p[0]);
		const lngs = polygon.map((p) => p[1]);
		const minLat = Math.min(...lats);
		const maxLat = Math.max(...lats);
		const minLng = Math.min(...lngs);
		const maxLng = Math.max(...lngs);

		const centerLat = (minLat + maxLat) / 2;

		const panelWidthDeg = metersToLatLng(panelWidth, centerLat);
		const panelHeightDeg = metersToLatLng(panelHeight, centerLat);
		const spacingWidthDeg = metersToLatLng(panelSpacing, centerLat);
		const spacingHeightDeg = metersToLatLng(panelSpacing, centerLat);

		const solarPanels: SolarPanel[] = [];
		const placedPanels: [number, number][][] = [];
		let id = 0;

		const stepWidth = panelWidthDeg + spacingWidthDeg;
		const stepHeight = panelHeightDeg + spacingHeightDeg;

		for (let lat = minLat; lat <= maxLat; lat += stepHeight) {
			for (let lng = minLng; lng <= maxLng; lng += stepWidth) {
				const center: [number, number] = [lat + panelHeightDeg / 2, lng + panelWidthDeg / 2];
				const panelCorners = createSolarPanel(center, panelWidth, panelHeight, angle);

				if (solarPanelFitsInPolygon(panelCorners, polygon)) {
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
			const panelArea = solarPanels.reduce((sum, p) => sum + p.area, 0);
			const coverage = area > 0 ? (panelArea / (area * 1000000)) * 100 : 0; // Convert km² to m²

			const newPolygon: DrawnPolygon = {
				id: `polygon_${Date.now()}`,
				coordinates: [...drawingPoints],
				area: area,
				name: `Site ${polygonCounter}`,
				solarPanels: solarPanels,
				angle: angle,
				panelArea: panelArea,
				coverage: coverage
			};

			polygons = [...polygons, newPolygon];
			polygonCounter++;

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
		if (coords.length < 3) return 0;

		let area = 0;
		for (let i = 0; i < coords.length; i++) {
			const j = (i + 1) % coords.length;
			area += coords[i][0] * coords[j][1];
			area -= coords[j][0] * coords[i][1];
		}
		return Math.abs(area / 2) * 111.32 * 111.32;
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
		polygons = polygons.map((polygon) => {
			const solarPanels = generateSolarPanels(polygon.coordinates, polygon.angle);
			const panelArea = solarPanels.reduce((sum, p) => sum + p.area, 0);
			const coverage = polygon.area > 0 ? (panelArea / (polygon.area * 1000000)) * 100 : 0;

			return {
				...polygon,
				solarPanels,
				panelArea,
				coverage
			};
		});
	}

	// Performance: Create grouped panel polygons
	function createPanelGroups(panels: SolarPanel[]): [number, number][][] {
		const maxPanels = showPanelDetails ? panels.length : Math.min(panels.length, 50);
		return panels.slice(0, maxPanels).map((panel) => panel.coordinates);
	}

	// Input validation and update functions
	function validateAndUpdateWidth(value: string) {
		const num = parseFloat(value);
		if (!isNaN(num) && num > 0 && num <= 10) {
			panelWidth = num;
			updateSolarPanels();
		}
	}

	function validateAndUpdateHeight(value: string) {
		const num = parseFloat(value);
		if (!isNaN(num) && num > 0 && num <= 10) {
			panelHeight = num;
			updateSolarPanels();
		}
	}

	function validateAndUpdateSpacing(value: string) {
		const num = parseFloat(value);
		if (!isNaN(num) && num >= 0 && num <= 5) {
			panelSpacing = num;
			updateSolarPanels();
		}
	}

	function validateAndUpdateCost(value: string) {
		const num = parseFloat(value);
		if (!isNaN(num) && num > 0 && num <= 10000) {
			costPerPanel = num;
		}
	}

	// Computed values
	const totalSolarPanels = $derived(polygons.reduce((sum, p) => sum + p.solarPanels.length, 0));
	const totalSolarArea = $derived(polygons.reduce((sum, p) => sum + p.panelArea, 0));
	const totalCost = $derived(totalSolarPanels * costPerPanel);
	const avgCoverage = $derived(
		polygons.length > 0 ? polygons.reduce((sum, p) => sum + p.coverage, 0) / polygons.length : 0
	);
</script>

<div class="bg-base-200 flex h-screen">
	<!-- Modern Sidebar -->
	<div class="bg-base-100 flex w-90 flex-col shadow-xl">
		<!-- Controls -->
		<div class="flex-1 space-y-4 overflow-y-auto p-4">
			<div class="text-lg font-medium">Panel Configuration</div>

			<div class="space-y-4">
				<!-- Panel Dimensions -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Panel Width (m)</span>

						<input
							type="number"
							class="input input-bordered input-sm w-full"
							min="0.1"
							max="10"
							step="0.1"
							value={panelWidth}
							oninput={(e) => validateAndUpdateWidth(e.target.value)}
							placeholder="2.0"
						/>
					</label>
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Panel Height (m)</span>

						<input
							type="number"
							class="input input-bordered input-sm w-full"
							min="0.1"
							max="10"
							step="0.1"
							value={panelHeight}
							oninput={(e) => validateAndUpdateHeight(e.target.value)}
							placeholder="1.0"
						/>
					</label>
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Panel Spacing (m)</span>

						<input
							type="number"
							class="input input-bordered input-sm w-full"
							min="0"
							max="5"
							step="0.1"
							value={panelSpacing}
							oninput={(e) => validateAndUpdateSpacing(e.target.value)}
							placeholder="0.5"
						/>
					</label>
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Cost per Panel ($)</span>

						<input
							type="number"
							class="input input-bordered input-sm w-full"
							min="1"
							max="10000"
							step="1"
							value={costPerPanel}
							oninput={(e) => validateAndUpdateCost(e.target.value)}
							placeholder="500"
						/>
					</label>
				</div>

				<div class="form-control">
					<label class="label cursor-pointer">
						<span class="label-text">Show all panels (may affect performance)</span>
						<input type="checkbox" class="toggle toggle-primary" bind:checked={showPanelDetails} />
					</label>
				</div>
			</div>

			<!-- Drawing Controls -->
			<div class="card bg-base-200 shadow-lg">
				<div class="card-body p-4">
					{#if !isDrawing}
						<button onclick={startDrawing} class="btn btn-primary btn-block gap-2">
							Draw New Site
						</button>
					{:else}
						<div class="space-y-2">
							<button
								onclick={finishPolygon}
								disabled={drawingPoints.length < 3}
								class="btn btn-success btn-block gap-2"
							>
								Finish Site ({drawingPoints.length})
							</button>
							<button onclick={cancelDrawing} class="btn btn-ghost btn-block gap-2">
								Cancel
							</button>
						</div>
					{/if}
				</div>
			</div>

			<!-- Sites List -->
			<div class="card bg-base-200 shadow-lg">
				<div class="card-body p-4">
					<div class="mb-3 flex items-center justify-between">
						<h3 class="card-title text-lg">Sites ({polygons.length})</h3>
						{#if polygons.length > 0}
							<button onclick={clearAllPolygons} class="btn btn-error btn-sm gap-2">
								Clear All
							</button>
						{/if}
					</div>

					{#if polygons.length === 0}
						<div class="text-base-content/60 py-8 text-center">
							<div class="mb-3 text-4xl">📍</div>
							<p class="text-sm">Click "Draw New Site" to get started</p>
						</div>
					{:else}
						<div class="space-y-3">
							{#each polygons as polygon}
								<div class="card bg-base-100 shadow-md">
									<div class="card-body p-3">
										<div class="mb-2 flex items-start justify-between">
											<div class="grid grid-cols-2 gap-2 text-xs">
												<div class="stat bg-base-200 rounded-lg p-2">
													<div class="stat-title text-xs">Panels</div>
													<div class="stat-value text-lg">{polygon.solarPanels.length}</div>
												</div>

												<div class="stat bg-base-200 rounded-lg p-2">
													<div class="stat-title text-xs">Area</div>
													<div class="stat-value text-sm">{polygon.panelArea.toFixed(0)}m²</div>
												</div>
											</div>
											<button
												onclick={() => deletePolygon(polygon.id)}
												class="btn btn-ghost btn-xs text-error hover:bg-error hover:text-error-content"
											>
												Delete Site
											</button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- Summary Footer -->
			{#if polygons.length > 0}
				<div class="from-primary to-secondary text-primary-content bg-gradient-to-r p-4">
					<div class="stats stats-vertical text-primary-content bg-transparent shadow-none">
						<div class="stat p-2">
							<div class="stat-title text-primary-content/80 text-xs">Total Sites</div>
							<div class="stat-value text-lg">{polygons.length}</div>
						</div>
						<div class="stat p-2">
							<div class="stat-title text-primary-content/80 text-xs">Total Panels</div>
							<div class="stat-value text-lg">{totalSolarPanels.toLocaleString()}</div>
						</div>
						<div class="stat p-2">
							<div class="stat-title text-primary-content/80 text-xs">Avg Coverage</div>
							<div class="stat-value text-lg">{avgCoverage.toFixed(1)}%</div>
						</div>
						<div class="stat p-2">
							<div class="stat-title text-primary-content/80 text-xs">Solar Area</div>
							<div class="stat-value text-lg">{totalSolarArea.toFixed(0)}m²</div>
						</div>
						<div class="stat border-primary-content/20 mt-2 border-t p-2 pt-3">
							<div class="stat-title text-primary-content/80 font-semibold">Total Investment</div>
							<div class="stat-value text-2xl font-bold">${totalCost.toLocaleString()}</div>
						</div>
					</div>
				</div>
			{/if}
		</div>
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

			<!-- Polygons -->
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
						<div class="min-w-48 p-2">
							<h3 class="mb-1 font-semibold">{polygon.name}</h3>
							<div class="space-y-1 text-sm">
								<div>Panels: {polygon.solarPanels.length}</div>
								<div>
									Coverage: <span class="font-medium text-blue-600"
										>{polygon.coverage.toFixed(1)}%</span
									>
								</div>
								<div>Solar Area: {polygon.panelArea.toFixed(0)}m²</div>
								<div>
									Cost: <span class="font-medium text-green-600"
										>${(polygon.solarPanels.length * costPerPanel).toLocaleString()}</span
									>
								</div>
							</div>
							<button
								onclick={() => deletePolygon(polygon.id)}
								class="mt-2 rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
							>
								Delete
							</button>
						</div>
					</Popup>
				</Polygon>

				<!-- Panels (performance optimized) -->
				{#if showPanelDetails}
					{#each polygon.solarPanels as panel}
						<Polygon
							latLngs={panel.coordinates}
							options={{
								color: '#1d4ed8',
								weight: 1,
								opacity: 0.6,
								fillColor: '#3b82f6',
								fillOpacity: 0.4
							}}
						/>
					{/each}
				{:else if polygon.solarPanels.length > 0}
					<!-- Show sample panels for performance -->
					{#each createPanelGroups(polygon.solarPanels) as panelCoords}
						<Polygon
							latLngs={panelCoords}
							options={{
								color: '#1d4ed8',
								weight: 1,
								opacity: 0.6,
								fillColor: '#3b82f6',
								fillOpacity: 0.4
							}}
						/>
					{/each}
				{/if}
			{/each}

			<!-- Drawing preview -->
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

			<!-- Drawing points -->
			{#if isDrawing}
				{#each drawingPoints as point, index}
					<CircleMarker
						latLng={point}
						options={{
							radius: 5,
							fillColor: index === 0 ? '#ef4444' : index === 1 ? '#22c55e' : '#3b82f6',
							color: '#ffffff',
							weight: 2,
							opacity: 1,
							fillOpacity: 0.8
						}}
					/>
				{/each}
			{/if}
		</Map>

		<!-- Enhanced Drawing Status -->
		{#if isDrawing}
			<div class="absolute top-4 right-4 z-[1000]">
				<div class="alert alert-info max-w-xs shadow-lg">
					<h3 class="font-bold">Drawing Site</h3>
					<div class="text-xs">Points: {drawingPoints.length}</div>
					{#if drawingPoints.length === 0}
						<div class="mt-1 text-xs">🔴 Set origin point</div>
					{:else if drawingPoints.length === 1}
						<div class="mt-1 text-xs">🟢 Set panel direction</div>
					{:else}
						<div class="mt-1 text-xs">🔵 Add boundary points</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>
