<script lang="ts">
	import { Map, TileLayer, Polygon, Popup, CircleMarker } from 'sveaflet';
	import { onMount } from 'svelte';
	import L from 'leaflet';

	// Import icons (assuming unplugin-icons is configured)
	// import IconPencil from '~icons/heroicons/pencil';
	// import IconCheck from '~icons/heroicons/check';
	// import IconX from '~icons/heroicons/x-mark';
	// import IconTrash from '~icons/heroicons/trash';
	// import IconSun from '~icons/heroicons/sun';

	interface DrawnPolygon {
		id: string;
		coordinates: [number, number][];
		area: number;
		name: string;
		solarPanels: SolarPanel[];
		angle: number;
		panelArea: number;
		coverage: number;
	}

	interface SolarPanel {
		id: string;
		coordinates: [number, number][];
		center: [number, number];
		area: number;
	}

	let polygons = $state<DrawnPolygon[]>([]);
	let isDrawing = $state(false);
	let mapInstance: L.Map;
	let drawingPoints = $state<[number, number][]>([]);
	let polygonCounter = $state(1);

	// Canvas overlay for panels
	let canvasOverlay: L.CanvasLayer | null = null;
	let canvasElement: HTMLCanvasElement | null = null;

	// Settings
	let panelWidth = $state(2.0);
	let panelHeight = $state(1.0);
	let panelSpacing = $state(0.5);
	let costPerPanel = $state(500);

	// Create custom canvas layer class
	class PanelCanvasLayer extends L.Layer {
		private canvas: HTMLCanvasElement;
		private ctx: CanvasRenderingContext2D;
		private map: L.Map;
		private bounds: L.LatLngBounds;

		constructor() {
			super();
			this.canvas = document.createElement('canvas');
			this.ctx = this.canvas.getContext('2d')!;
			this.canvas.style.position = 'absolute';
			this.canvas.style.top = '0';
			this.canvas.style.left = '0';
			this.canvas.style.pointerEvents = 'none';
			this.canvas.style.zIndex = '200';
		}

		onAdd(map: L.Map) {
			this.map = map;
			map.getPanes().overlayPane?.appendChild(this.canvas);
			map.on('viewreset', this.reset, this);
			map.on('zoom', this.reset, this);
			map.on('move', this.reset, this);
			this.reset();
			return this;
		}

		onRemove(map: L.Map) {
			map.getPanes().overlayPane?.removeChild(this.canvas);
			map.off('viewreset', this.reset, this);
			map.off('zoom', this.reset, this);
			map.off('move', this.reset, this);
			return this;
		}

		reset = () => {
			const size = this.map.getSize();
			const bounds = this.map.getBounds();
			const topLeft = this.map.latLngToContainerPoint(bounds.getNorthWest());

			this.canvas.width = size.x;
			this.canvas.height = size.y;
			this.canvas.style.width = size.x + 'px';
			this.canvas.style.height = size.y + 'px';

			L.DomUtil.setPosition(this.canvas, topLeft);
			this.bounds = bounds;
			this.redraw();
		};

		redraw() {
			if (!this.ctx || !this.map) return;

			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			this.ctx.fillStyle = 'rgba(59, 130, 246, 0.6)'; // Blue with opacity
			this.ctx.strokeStyle = 'rgba(29, 78, 216, 0.8)'; // Darker blue border
			this.ctx.lineWidth = 1;

			// Draw all panels
			polygons.forEach((polygon) => {
				polygon.solarPanels.forEach((panel) => {
					this.drawPanel(panel.coordinates);
				});
			});
		}

		private drawPanel(coordinates: [number, number][]) {
			if (coordinates.length < 3) return;

			const points = coordinates.map((coord) =>
				this.map.latLngToContainerPoint([coord[0], coord[1]])
			);

			this.ctx.beginPath();
			this.ctx.moveTo(points[0].x, points[0].y);
			for (let i = 1; i < points.length; i++) {
				this.ctx.lineTo(points[i].x, points[i].y);
			}
			this.ctx.closePath();
			this.ctx.fill();
			this.ctx.stroke();
		}
	}

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
			const coverage = area > 0 ? (panelArea / (area * 1000000)) * 100 : 0;

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

			// Redraw canvas
			updateCanvas();
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
		updateCanvas();
	}

	function clearAllPolygons() {
		polygons = [];
		polygonCounter = 1;
		updateCanvas();
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
		updateCanvas();
	}

	function updateCanvas() {
		if (canvasOverlay) {
			canvasOverlay.redraw();
		}
	}

	// Initialize canvas overlay when map is ready
	function initializeCanvas() {
		if (mapInstance && !canvasOverlay) {
			canvasOverlay = new PanelCanvasLayer();
			mapInstance.addLayer(canvasOverlay);
		}
	}

	// Watch for map instance changes
	$effect(() => {
		if (mapInstance) {
			initializeCanvas();
		}
	});

	// Computed values
	const totalSolarPanels = $derived(polygons.reduce((sum, p) => sum + p.solarPanels.length, 0));
	const totalSolarArea = $derived(polygons.reduce((sum, p) => sum + p.panelArea, 0));
	const totalCost = $derived(totalSolarPanels * costPerPanel);
	const avgCoverage = $derived(
		polygons.length > 0 ? polygons.reduce((sum, p) => sum + p.coverage, 0) / polygons.length : 0
	);
</script>

<div class="flex h-screen bg-gray-50">
	<!-- Simplified Sidebar -->
	<div class="flex w-72 flex-col border-r border-gray-200 bg-white">
		<!-- Header -->
		<div class="border-b border-gray-200 p-4">
			<h1 class="flex items-center gap-2 text-lg font-semibold text-gray-900">
				<!-- Replace with: <IconSun class="w-5 h-5 text-yellow-500" /> -->
				☀️ Solar Designer
			</h1>
			<p class="mt-1 text-xs text-gray-500">Canvas-powered for high performance</p>
		</div>

		<!-- Controls -->
		<div class="space-y-4 p-4">
			<!-- Drawing -->
			<div class="space-y-2">
				{#if !isDrawing}
					<button
						onclick={startDrawing}
						class="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
					>
						<!-- Replace with: <IconPencil class="w-4 h-4" /> -->
						✏️ Draw Site
					</button>
				{:else}
					<button
						onclick={finishPolygon}
						disabled={drawingPoints.length < 3}
						class="flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-gray-400"
					>
						<!-- Replace with: <IconCheck class="w-4 h-4" /> -->
						✓ Finish ({drawingPoints.length})
					</button>
					<button
						onclick={cancelDrawing}
						class="flex w-full items-center justify-center gap-2 rounded-md bg-gray-500 px-3 py-2 text-sm font-medium text-white hover:bg-gray-600"
					>
						<!-- Replace with: <IconX class="w-4 h-4" /> -->
						✗ Cancel
					</button>
				{/if}
			</div>

			<!-- Panel Settings -->
			<div class="space-y-3 rounded-md bg-gray-50 p-3">
				<h3 class="text-sm font-medium text-gray-700">Panel Settings</h3>

				<div class="space-y-2">
					<div class="flex justify-between text-xs text-gray-600">
						<span>Size: {panelWidth}×{panelHeight}m</span>
						<span>Gap: {panelSpacing}m</span>
					</div>
					<div class="space-y-1">
						<label class="text-xs text-gray-500">Width</label>
						<input
							type="range"
							min="1"
							max="3"
							step="0.1"
							bind:value={panelWidth}
							onchange={updateSolarPanels}
							class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
						/>
					</div>
					<div class="space-y-1">
						<label class="text-xs text-gray-500">Height</label>
						<input
							type="range"
							min="0.5"
							max="2"
							step="0.1"
							bind:value={panelHeight}
							onchange={updateSolarPanels}
							class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
						/>
					</div>
					<div class="space-y-1">
						<label class="text-xs text-gray-500">Spacing</label>
						<input
							type="range"
							min="0.1"
							max="1"
							step="0.1"
							bind:value={panelSpacing}
							onchange={updateSolarPanels}
							class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
						/>
					</div>
				</div>

				<div class="flex items-center justify-between">
					<span class="text-xs text-gray-600">Cost/panel:</span>
					<input
						type="number"
						min="100"
						max="2000"
						step="50"
						bind:value={costPerPanel}
						class="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
					/>
				</div>
			</div>

			{#if polygons.length > 0}
				<button
					onclick={clearAllPolygons}
					class="flex w-full items-center justify-center gap-2 rounded-md bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600"
				>
					<!-- Replace with: <IconTrash class="w-4 h-4" /> -->
					🗑️ Clear All
				</button>
			{/if}

			<!-- Performance Info -->
			<div class="rounded-md border border-green-200 bg-green-50 p-2">
				<div class="text-xs text-green-800">
					<div class="font-medium">⚡ Canvas Rendering</div>
					<div>Handles thousands of panels smoothly</div>
				</div>
			</div>
		</div>

		<!-- Sites List -->
		<div class="flex-1 overflow-y-auto p-4">
			<h3 class="mb-2 text-sm font-medium text-gray-700">Sites ({polygons.length})</h3>

			{#if polygons.length === 0}
				<div class="mt-8 text-center text-gray-400">
					<div class="mb-2 text-2xl">📍</div>
					<p class="text-xs">Click "Draw Site" to start</p>
					<p class="mt-2 text-xs text-gray-300">Canvas will render panels efficiently</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each polygons as polygon}
						<div
							class="rounded-md border border-gray-200 bg-white p-3 transition-colors hover:border-blue-300"
						>
							<div class="mb-2 flex items-start justify-between">
								<h4 class="text-sm font-medium text-gray-900">{polygon.name}</h4>
								<button
									onclick={() => deletePolygon(polygon.id)}
									class="text-xs text-red-500 hover:text-red-700"
								>
									×
								</button>
							</div>

							<div class="space-y-1 text-xs text-gray-600">
								<div class="flex justify-between">
									<span>Panels:</span>
									<span class="font-medium">{polygon.solarPanels.length.toLocaleString()}</span>
								</div>
								<div class="flex justify-between">
									<span>Coverage:</span>
									<span class="font-medium text-blue-600">{polygon.coverage.toFixed(1)}%</span>
								</div>
								<div class="flex justify-between">
									<span>Area:</span>
									<span>{polygon.panelArea.toFixed(0)}m²</span>
								</div>
								<div class="flex justify-between">
									<span>Cost:</span>
									<span class="font-medium text-green-600">
										${(polygon.solarPanels.length * costPerPanel).toLocaleString()}
									</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Summary -->
		{#if polygons.length > 0}
			<div class="border-t border-gray-200 bg-blue-50 p-4">
				<h3 class="mb-2 text-sm font-semibold text-gray-900">Total Summary</h3>
				<div class="space-y-1 text-xs">
					<div class="flex justify-between">
						<span>Sites:</span>
						<span class="font-medium">{polygons.length}</span>
					</div>
					<div class="flex justify-between">
						<span>Panels:</span>
						<span class="font-medium">{totalSolarPanels.toLocaleString()}</span>
					</div>
					<div class="flex justify-between">
						<span>Avg Coverage:</span>
						<span class="font-medium text-blue-600">{avgCoverage.toFixed(1)}%</span>
					</div>
					<div class="flex justify-between">
						<span>Solar Area:</span>
						<span class="font-medium">{totalSolarArea.toFixed(0)}m²</span>
					</div>
					<div class="mt-2 flex justify-between border-t border-gray-300 pt-1 font-semibold">
						<span>Total Cost:</span>
						<span class="text-green-600">${totalCost.toLocaleString()}</span>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Map -->
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

			<!-- Only render polygon boundaries - panels are on canvas -->
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
								<div>
									Panels: <span class="font-medium"
										>{polygon.solarPanels.length.toLocaleString()}</span
									>
								</div>
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
								<div class="mt-2 border-t border-gray-200 pt-2 text-xs text-gray-500">
									📊 Rendered on canvas for performance
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

		<!-- Drawing Status -->
		{#if isDrawing}
			<div
				class="absolute top-4 right-4 z-[1000] rounded-md border border-gray-200 bg-white p-3 shadow-lg"
			>
				<div class="text-sm">
					<div class="mb-1 font-semibold">Drawing Site</div>
					<div class="text-xs text-gray-600">Points: {drawingPoints.length}</div>
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

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	/* Custom range slider styling */
	input[type='range'] {
		-webkit-appearance: none;
	}

	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		height: 16px;
		width: 16px;
		border-radius: 50%;
		background: #3b82f6;
		cursor: pointer;
	}

	input[type='range']::-moz-range-thumb {
		height: 16px;
		width: 16px;
		border-radius: 50%;
		background: #3b82f6;
		cursor: pointer;
		border: none;
	}
</style>
