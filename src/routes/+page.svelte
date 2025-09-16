<script lang="ts">
	import { Map, TileLayer, Polygon, Popup, CircleMarker } from 'sveaflet';
	import { onMount } from 'svelte';
	import L from 'leaflet';

	// Import unplugin icons
	import MaterialSymbolsSearch from '~icons/material-symbols/search';
	import MaterialSymbolsWbSunny from '~icons/material-symbols/wb-sunny';
	import MaterialSymbolsMap from '~icons/material-symbols/map';
	import MaterialSymbolsSatelliteAlt from '~icons/material-symbols/satellite-alt';
	import MaterialSymbolsEdit from '~icons/material-symbols/edit';
	import MaterialSymbolsCheck from '~icons/material-symbols/check';
	import MaterialSymbolsCancel from '~icons/material-symbols/cancel';
	import MaterialSymbolsDelete from '~icons/material-symbols/delete';
	import MaterialSymbolsClearAll from '~icons/material-symbols/clear-all';
	import MaterialSymbolsSolarPower from '~icons/material-symbols/solar-power';
	import MaterialSymbolsWarning from '~icons/material-symbols/warning';

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

	interface SearchResult {
		display_name: string;
		lat: string;
		lon: string;
	}

	let polygons = $state<DrawnPolygon[]>([]);
	let isDrawing = $state(false);
	let mapInstance: L.Map | undefined = $state();
	let drawingPoints = $state<[number, number][]>([]);
	let polygonCounter = $state(1);

	let panelWidth = $state(2.0);
	let panelHeight = $state(1.0);
	let panelSpacing = $state(0.5);
	let costPerPanel = $state(500);

	let searchQuery = $state('');
	let searchResults = $state<SearchResult[]>([]);
	let isSearching = $state(false);
	let showResults = $state(false);

	let mapType = $state('osm');
	let showPerformanceDialog = $state(false);
	let pendingPolygonData: {
		coordinates: [number, number][];
		area: number;
		angle: number;
		estimatedPanelCount: number;
	} | null = $state(null);

	let searchTimeout: number;

	// Load settings from localStorage on mount
	onMount(() => {
		if (typeof localStorage !== 'undefined') {
			const savedWidth = localStorage.getItem('panelWidth');
			const savedHeight = localStorage.getItem('panelHeight');
			const savedSpacing = localStorage.getItem('panelSpacing');
			const savedCost = localStorage.getItem('costPerPanel');

			if (savedWidth) panelWidth = parseFloat(savedWidth);
			if (savedHeight) panelHeight = parseFloat(savedHeight);
			if (savedSpacing) panelSpacing = parseFloat(savedSpacing);
			if (savedCost) costPerPanel = parseFloat(savedCost);
		}
	});

	// Save to localStorage when values change
	function saveToLocalStorage() {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('panelWidth', panelWidth.toString());
			localStorage.setItem('panelHeight', panelHeight.toString());
			localStorage.setItem('panelSpacing', panelSpacing.toString());
			localStorage.setItem('costPerPanel', costPerPanel.toString());
		}
	}

	function handleMapClick(e: any) {
		if (isDrawing) {
			const point: [number, number] = [e.latlng.lat, e.latlng.lng];
			drawingPoints = [...drawingPoints, point];
		}
		showResults = false;
	}

	function startDrawing() {
		isDrawing = true;
		drawingPoints = [];
		showResults = false;
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

	// Estimate panel count without generating actual panels
	function estimatePanelCount(polygon: [number, number][]): number {
		if (polygon.length < 3) return 0;

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

		const stepWidth = panelWidthDeg + spacingWidthDeg;
		const stepHeight = panelHeightDeg + spacingHeightDeg;

		const latSteps = Math.floor((maxLat - minLat) / stepHeight);
		const lngSteps = Math.floor((maxLng - minLng) / stepWidth);

		// Rough estimate - actual count will be lower due to polygon fitting
		return Math.floor(latSteps * lngSteps * 0.7); // 0.7 is approximation factor
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

			// Estimate panel count before generating
			const estimatedCount = estimatePanelCount(drawingPoints);

			// Check if estimated count is too high and show warning dialog
			if (estimatedCount > 500) {
				pendingPolygonData = {
					coordinates: [...drawingPoints],
					area: area,
					angle: angle,
					estimatedPanelCount: estimatedCount
				};
				showPerformanceDialog = true;
			} else {
				createPolygonWithPanels(drawingPoints, area, angle);
			}
		}
	}

	function createPolygonWithPanels(coordinates: [number, number][], area: number, angle: number) {
		const solarPanels = generateSolarPanels(coordinates, angle);
		const panelArea = solarPanels.reduce((sum, p) => sum + p.area, 0);
		const coverage = area > 0 ? (panelArea / (area * 1000000)) * 100 : 0;

		const newPolygon: DrawnPolygon = {
			id: `polygon_${Date.now()}`,
			coordinates: coordinates,
			area: area,
			name: `Site ${polygonCounter}`,
			solarPanels: solarPanels,
			angle: angle,
			panelArea: panelArea,
			coverage: coverage
		};

		addPolygon(newPolygon);
	}

	function addPolygon(polygon: DrawnPolygon) {
		polygons = [...polygons, polygon];
		polygonCounter++;

		isDrawing = false;
		drawingPoints = [];
		if (mapInstance) {
			mapInstance.doubleClickZoom.enable();
		}
	}

	function confirmAddPolygon() {
		if (pendingPolygonData) {
			createPolygonWithPanels(
				pendingPolygonData.coordinates,
				pendingPolygonData.area,
				pendingPolygonData.angle
			);
			pendingPolygonData = null;
		}
		showPerformanceDialog = false;
	}

	function cancelAddPolygon() {
		pendingPolygonData = null;
		showPerformanceDialog = false;
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

	function clearAll() {
		polygons = [];
		polygonCounter = 1;
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

	async function searchLocation(query: string) {
		if (!query.trim()) {
			searchResults = [];
			return;
		}

		isSearching = true;
		try {
			const response = await fetch(
				`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`
			);
			const results = await response.json();
			searchResults = results;
			showResults = true;
		} catch (error) {
			console.error('Search error:', error);
			searchResults = [];
		} finally {
			isSearching = false;
		}
	}

	function handleSearchInput(event: Event) {
		const target = event.target as HTMLInputElement;
		searchQuery = target.value;

		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			searchLocation(searchQuery);
		}, 300);
	}

	function selectLocation(result: SearchResult) {
		const lat = parseFloat(result.lat);
		const lon = parseFloat(result.lon);

		if (mapInstance) {
			mapInstance.setView([lat, lon], 18);
		}

		searchQuery = result.display_name;
		showResults = false;
	}

	const totalSolarPanels = $derived(polygons.reduce((sum, p) => sum + p.solarPanels.length, 0));
	const totalCost = $derived(totalSolarPanels * costPerPanel);

	function getNextPointColor(): string {
		if (drawingPoints.length === 0) return '#f87171';
		if (drawingPoints.length === 1) return '#34d399';
		return '#60a5fa';
	}
</script>

<div class="flex h-screen w-full flex-row">
	<!-- Professional Sidebar -->
	<div
		class="flex h-svh w-80 flex-col border-r border-gray-700 bg-gray-800 p-3 text-white shadow-2xl"
	>
		<!-- Header -->
		<div class="mb-4 flex items-center gap-2">
			<MaterialSymbolsWbSunny class="size-5" />
			<h1 class="text-lg font-bold text-white">Solar Planner</h1>
		</div>

		<!-- Location Search -->
		<div class="relative mb-3">
			<div class="relative">
				<MaterialSymbolsSearch
					class="absolute top-1/2 left-3 size-4 -translate-y-1/2 transform text-gray-400"
				/>
				<input
					type="text"
					placeholder="Search location..."
					class="input input-sm w-full border-gray-600 bg-gray-700 pl-9 text-white placeholder-gray-400 focus:border-blue-500"
					bind:value={searchQuery}
					oninput={handleSearchInput}
					onfocus={() => (showResults = searchResults.length > 0)}
				/>
				{#if isSearching}
					<span
						class="loading loading-spinner loading-sm absolute top-1/2 right-3 -translate-y-1/2 transform"
					></span>
				{/if}
			</div>

			{#if showResults && searchResults.length > 0}
				<div
					class="absolute top-full z-50 mt-1 max-h-40 w-full overflow-y-auto rounded border border-gray-600 bg-gray-700 shadow-xl"
				>
					{#each searchResults as result}
						<button
							class="w-full border-b border-gray-600 px-3 py-2 text-left text-xs text-gray-200 last:border-b-0 hover:bg-gray-600"
							onclick={() => selectLocation(result)}
						>
							{result.display_name}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Map Toggle -->
		<div class="mb-3 flex gap-1">
			<button
				class="btn btn-sm flex-1 gap-1"
				class:btn-primary={mapType === 'osm'}
				class:btn-outline={mapType !== 'osm'}
				onclick={() => (mapType = 'osm')}
			>
				<MaterialSymbolsMap class="size-4" />
				Street
			</button>
			<button
				class="btn btn-sm flex-1 gap-1"
				class:btn-primary={mapType === 'satellite'}
				class:btn-outline={mapType !== 'satellite'}
				onclick={() => (mapType = 'satellite')}
			>
				<MaterialSymbolsSatelliteAlt class="size-4" />
				Satellite
			</button>
		</div>

		<!-- Drawing Controls -->
		<div class="mb-3 rounded bg-gray-700 p-1">
			<div class="flex gap-2">
				{#if !isDrawing}
					<button onclick={startDrawing} class="btn btn-primary btn-sm flex-1 gap-1">
						<MaterialSymbolsEdit class="size-4" />
						Draw Site
					</button>
				{:else}
					<button
						onclick={finishPolygon}
						disabled={drawingPoints.length < 3}
						class="btn btn-success btn-sm flex-1"
					>
						<MaterialSymbolsCheck class="size-4" />
						Finish ({drawingPoints.length})
					</button>
					<button onclick={cancelDrawing} class="btn btn-ghost btn-sm">
						<MaterialSymbolsCancel class="size-4" />
					</button>
				{/if}
			</div>
		</div>

		<!-- Panel Settings -->
		<div class="mb-3 rounded bg-gray-700 p-1">
			<div class="grid grid-cols-2 gap-2 text-xs">
				<div>
					<label class="text-gray-400"
						>Width (m)
						<input
							type="number"
							class="input input-xs mt-1 w-full border-gray-500 bg-gray-600 text-white"
							min="0.1"
							max="10"
							step="0.1"
							bind:value={panelWidth}
							onchange={() => {
								updateSolarPanels();
								saveToLocalStorage();
							}}
						/>
					</label>
				</div>
				<div>
					<label class="text-gray-400"
						>Height (m)
						<input
							type="number"
							class="input input-xs mt-1 w-full border-gray-500 bg-gray-600 text-white"
							min="0.1"
							max="10"
							step="0.1"
							bind:value={panelHeight}
							onchange={() => {
								updateSolarPanels();
								saveToLocalStorage();
							}}
						/>
					</label>
				</div>
				<div>
					<label class="text-gray-400"
						>Spacing (m)
						<input
							type="number"
							class="input input-xs mt-1 w-full border-gray-500 bg-gray-600 text-white"
							min="0"
							max="5"
							step="0.1"
							bind:value={panelSpacing}
							onchange={() => {
								updateSolarPanels();
								saveToLocalStorage();
							}}
						/>
					</label>
				</div>
				<div>
					<label class="text-gray-400"
						>Cost (€)
						<input
							type="number"
							class="input input-xs mt-1 w-full border-gray-500 bg-gray-600 text-white"
							min="1"
							max="10000"
							bind:value={costPerPanel}
							onchange={() => saveToLocalStorage()}
						/>
					</label>
				</div>
			</div>
		</div>

		<!-- Sites List -->
		{#if polygons.length === 0}
			<div class="py-6 text-center text-gray-400">
				<div class="mb-2">
					<MaterialSymbolsWbSunny class="mx-auto size-8" />
				</div>
				<p class="text-sm">Draw sites to start</p>
			</div>
		{:else}
			<div class="flex flex-1 flex-col overflow-hidden">
				<div class="mb-2 flex items-center justify-between">
					<span class="text-sm font-medium text-gray-300">Sites ({polygons.length})</span>
					<button onclick={clearAll} class="btn btn-error btn-xs">
						<MaterialSymbolsClearAll class="size-4" />
					</button>
				</div>

				<div class="flex-1 space-y-2 overflow-y-auto">
					{#each polygons as polygon, index}
						<div class="rounded bg-gray-700 p-2">
							<div class="mb-2 flex items-center justify-between">
								<span class="text-sm font-medium text-white">Site {index + 1}</span>
								<button
									onclick={() => deletePolygon(polygon.id)}
									class="btn btn-ghost btn-xs h-5 min-h-0 p-0 text-red-400"
								>
									<MaterialSymbolsDelete class="size-4" />
								</button>
							</div>

							<div class="grid grid-cols-3 gap-2 text-xs">
								<div class="text-center">
									<div class="font-medium text-blue-400">{polygon.solarPanels.length}</div>
									<div class="text-gray-400">Panels</div>
								</div>
								<div class="text-center">
									<div class="font-medium text-green-400">{polygon.coverage.toFixed(1)}%</div>
									<div class="text-gray-400">Cover</div>
								</div>
								<div class="text-center">
									<div class="font-medium text-yellow-400">
										${((polygon.solarPanels.length * costPerPanel) / 1000).toFixed(0)}k
									</div>
									<div class="text-gray-400">Cost</div>
								</div>
							</div>
						</div>
					{/each}
				</div>

				<!-- Summary -->
				<div class="mt-3 rounded bg-blue-600 p-3 text-white">
					<div class="flex items-center justify-between">
						<div>
							<div class="text-lg font-bold">{totalSolarPanels.toLocaleString()}</div>
							<div class="text-xs opacity-80">Total Panels</div>
						</div>
						<div class="text-right">
							<div class="text-lg font-bold">${(totalCost / 1000).toFixed(0)}k</div>
							<div class="text-xs opacity-80">Total Cost</div>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Map Container -->
	<div class="relative h-svh flex-1">
		<!-- Drawing Status -->
		{#if isDrawing}
			<div class="absolute top-4 right-4 z-[1000]">
				<div class="alert border-gray-600 bg-gray-800 text-white shadow-xl">
					<MaterialSymbolsEdit class="size-5" />
					<div>
						<div class="font-medium">Drawing Mode</div>
						<div class="text-xs opacity-80">
							{#if drawingPoints.length === 0}
								Click origin point
							{:else if drawingPoints.length === 1}
								Set direction
							{:else}
								Add boundaries
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Performance Warning Dialog -->
		{#if showPerformanceDialog}
			<div
				class="bg-opacity-50 fixed inset-0 z-[2000] flex items-center justify-center bg-black/30"
			>
				<div class="mx-4 max-w-md rounded-lg border border-gray-600 bg-gray-800 p-6">
					<div class="mb-4 flex items-center gap-3">
						<MaterialSymbolsWarning class="size-6 text-yellow-500" />
						<h3 class="text-lg font-bold text-white">Performance Warning</h3>
					</div>
					<p class="mb-6 text-gray-300">
						This site will generate approximately {pendingPolygonData?.estimatedPanelCount} solar panels,
						which may cause performance issues and slow down the interface. Consider reducing the site
						size or increasing panel spacing.
					</p>
					<div class="flex justify-end gap-3">
						<button class="btn btn-ghost text-gray-300" onclick={cancelAddPolygon}> Cancel </button>
						<button class="btn btn-warning" onclick={confirmAddPolygon}> Add Anyway </button>
					</div>
				</div>
			</div>
		{/if}

		<Map
			options={{
				center: [51.505, -0.09],
				zoom: 16,
				minZoom: 1,
				maxZoom: 20
			}}
			class={'h-full w-full flex-1 flex-col overflow-hidden'}
			onclick={handleMapClick}
			bind:instance={mapInstance}
		>
			{#if mapType === 'osm'}
				<TileLayer url={'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} />
			{:else}
				<TileLayer
					url={'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'}
					attribution="Tiles &copy; Esri"
				/>
			{/if}

			<!-- Polygons -->
			{#each polygons as polygon, index}
				<Polygon
					latLngs={polygon.coordinates}
					options={{
						color: '#3b82f6',
						weight: 2,
						opacity: 0.8,
						fillOpacity: 0.1
					}}
				>
					<Popup>
						<div class="rounded bg-gray-800 p-3 text-white">
							<h3 class="mb-2 font-bold">Site {index + 1}</h3>
							<div class="space-y-1 text-sm">
								<div>Panels: <strong>{polygon.solarPanels.length}</strong></div>
								<div>Coverage: <strong>{polygon.coverage.toFixed(1)}%</strong></div>
								<div>
									Cost: <strong
										>${(polygon.solarPanels.length * costPerPanel).toLocaleString()}</strong
									>
								</div>
							</div>
						</div>
					</Popup>
				</Polygon>

				<!-- Solar Panels -->
				{#each polygon.solarPanels as panel}
					<Polygon
						latLngs={panel.coordinates}
						options={{
							color: '#1d4ed8',
							weight: 1,
							opacity: 0.7,
							fillColor: '#3b82f6',
							fillOpacity: 0.5
						}}
					/>
				{/each}
			{/each}

			<!-- Drawing preview -->
			{#if isDrawing && drawingPoints.length >= 3}
				<Polygon
					latLngs={drawingPoints}
					options={{
						color: '#10b981',
						weight: 2,
						opacity: 0.7,
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
							radius: 6,
							fillColor: index === 0 ? '#f87171' : index === 1 ? '#34d399' : '#60a5fa',
							color: '#ffffff',
							weight: 2,
							opacity: 1,
							fillOpacity: 0.8
						}}
					/>
				{/each}
			{/if}
		</Map>
	</div>
</div>
