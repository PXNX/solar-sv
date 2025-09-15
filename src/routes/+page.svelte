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

	// Simplified settings
	let panelWidth = $state(2.0);
	let panelHeight = $state(1.0);
	let panelSpacing = $state(0.5);
	let costPerPanel = $state(500);

	// Location search
	let searchQuery = $state('');
	let searchResults = $state<SearchResult[]>([]);
	let isSearching = $state(false);
	let showResults = $state(false);

	// Map settings
	let mapType = $state('osm'); // 'osm' or 'satellite'

	// Debounced search
	let searchTimeout: number;

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

	// Location search functions
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
			mapInstance.setView([lat, lon], 18); // Increased zoom level from 16 to 18
		}

		searchQuery = result.display_name;
		showResults = false;
	}

	// Computed values
	const totalSolarPanels = $derived(polygons.reduce((sum, p) => sum + p.solarPanels.length, 0));
	const totalCost = $derived(totalSolarPanels * costPerPanel);

	// Get next point color
	function getNextPointColor(): string {
		if (drawingPoints.length === 0) return '#ef4444'; // red
		if (drawingPoints.length === 1) return '#22c55e'; // green
		return '#3b82f6'; // blue
	}
</script>

<div class="bg-base-200 flex h-screen">
	<!-- Simplified Sidebar -->
	<div class="bg-base-100 flex w-90 flex-col space-y-3 p-2 shadow-lg">
		<!-- Location Search -->

		<div class="relative">
			<input
				type="text"
				placeholder="Search location..."
				class="input input-bordered input-md w-full"
				bind:value={searchQuery}
				oninput={handleSearchInput}
				onfocus={() => (showResults = searchResults.length > 0)}
			/>
			{#if isSearching}
				<span class="loading loading-spinner loading-md absolute top-2 right-2"></span>
			{/if}

			{#if showResults && searchResults.length > 0}
				<div
					class="bg-base-100 border-base-300 absolute top-full z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border shadow-xl"
				>
					{#each searchResults as result}
						<button
							class="hover:bg-base-200 border-base-300 text-base-content w-full border-b px-3 py-2 text-left text-xs last:border-b-0"
							onclick={() => selectLocation(result)}
						>
							{result.display_name}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<div class="form-control flex flex-row gap-2">
			<button
				class="btn flex-1"
				class:btn-primary={mapType === 'osm'}
				onclick={() => (mapType = 'osm')}
			>
				Street
			</button>
			<button
				class="btn flex-1"
				class:btn-primary={mapType === 'satellite'}
				onclick={() => (mapType = 'satellite')}
			>
				Satellite
			</button>
		</div>

		<div class="flex flex-row gap-2">
			{#if !isDrawing}
				<button onclick={startDrawing} class="btn btn-primary flex-1"> Draw Site </button>
			{:else}
				<button
					onclick={finishPolygon}
					disabled={drawingPoints.length < 3}
					class="btn btn-success flex-1"
				>
					Finish ({drawingPoints.length})
				</button>
				<button onclick={cancelDrawing} class="btn btn-ghost flex-1"> Cancel </button>
			{/if}
		</div>

		<div class="grid grid-cols-2 gap-2">
			<div class="form-control">
				<label class="label-text-sm pb-1"
					>Width (m)
					<input
						type="number"
						class="input input-bordered input-sm"
						min="0.1"
						max="10"
						step="0.1"
						bind:value={panelWidth}
						onchange={() => updateSolarPanels()}
					/>
				</label>
			</div>
			<div class="form-control">
				<label class="label-text-sm pb-1"
					>Height (m)
					<input
						type="number"
						class="input input-bordered input-sm"
						min="0.1"
						max="10"
						step="0.1"
						bind:value={panelHeight}
						onchange={() => updateSolarPanels()}
					/>
				</label>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-2">
			<div class="form-control">
				<label class="label-text-sm pb-1"
					>Spacing (m)
					<input
						type="number"
						class="input input-bordered input-sm"
						min="0"
						max="5"
						step="0.1"
						bind:value={panelSpacing}
						onchange={() => updateSolarPanels()}
					/>
				</label>
			</div>
			<div class="form-control">
				<label class="label-text-sm pb-1"
					>Cost ($)
					<input
						type="number"
						class="input input-bordered input-sm"
						min="1"
						max="10000"
						bind:value={costPerPanel}
					/>
				</label>
			</div>
		</div>

		{#if polygons.length === 0}
			<div class="text-base-content/60 py-8 text-center">
				<div class="mb-2 text-3xl">🌞</div>
				<p class="text-sm">Draw sites to get started</p>
			</div>
		{:else}
			<div class="flex-1 overflow-y-auto">
				<div class="mb-3 flex items-center justify-between">
					<h3 class="font-medium">Sites ({polygons.length})</h3>
					{#if polygons.length > 0}
						<button onclick={clearAll} class="btn btn-error btn-xs">Clear</button>
					{/if}
				</div>

				<div class="space-y-2">
					{#each polygons as polygon}
						<div class="card bg-base-200 card-compact">
							<div class="card-body">
								<div class="grid grid-cols-4 gap-2 text-sm">
									<div>
										<div class="text-base-content/60">Panels</div>
										<div class="font-semibold">{polygon.solarPanels.length}</div>
									</div>
									<div>
										<div class="text-base-content/60">Coverage</div>
										<div class="font-semibold">{polygon.coverage.toFixed(1)}%</div>
									</div>
									<div>
										<div class="text-base-content/60">Cost</div>
										<div class="font-semibold">
											${(polygon.solarPanels.length * costPerPanel).toLocaleString()}
										</div>
									</div>

									<button
										onclick={() => deletePolygon(polygon.id)}
										class="btn btn-ghost btn-xs text-error"
									>
										×
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>

				<!-- Summary Footer -->
				<div class="bg-primary text-primary-content p-4">
					<div class="text-center">
						<div class="text-2xl font-bold">{totalSolarPanels.toLocaleString()}</div>
						<div class="text-sm opacity-80">panels</div>
						<div class="mt-1 text-lg font-semibold">${totalCost.toLocaleString()}</div>
						<div class="text-xs opacity-80">total cost</div>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Map Container -->
	<div class="relative flex-1">
		<!-- Drawing Status -->
		{#if isDrawing}
			<div class="absolute top-4 right-4 z-[1000]">
				<div class="alert alert-primary max-w-sm shadow-lg">
					<div>
						<div class="font-semibold">Drawing Mode</div>
						<div class="flex items-center gap-1 text-sm">
							<div
								class="size-3 rounded-full"
								style="background-color: {getNextPointColor()}"
							></div>
							{#if drawingPoints.length === 0}
								Set origin point
							{:else if drawingPoints.length === 1}
								Set panel direction
							{:else}
								Add boundary points
							{/if}
						</div>
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
			style="width:100%;height:100%;"
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
							<h3 class="mb-2 font-semibold">{polygon.name}</h3>
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
							opacity: 0.6,
							fillColor: '#3b82f6',
							fillOpacity: 0.4
						}}
					/>
				{/each}
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
	</div>
</div>
