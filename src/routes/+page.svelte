<!-- SolarPanelPlanner.svelte -->
<script>
	import { onMount, tick } from 'svelte';

	// Icons - only essential ones
	import IconSearch from '~icons/heroicons/magnifying-glass';
	import IconPencil from '~icons/heroicons/pencil';
	import IconCheck from '~icons/heroicons/check';
	import IconX from '~icons/heroicons/x-mark';
	import IconTrash from '~icons/heroicons/trash';
	import IconSun from '~icons/heroicons/sun';

	// Svelte 5 runes
	let map = $state(null);
	let leaflet = $state(null);
	let searchAddress = $state('');
	let searchResults = $state([]);
	let showSearchResults = $state(false);
	let isSearching = $state(false);
	let roofPolygons = $state([]);
	let currentPolygon = $state(null);
	let isDrawing = $state(false);
	let panelWidth = $state(1.65);
	let panelHeight = $state(1.0);
	let panelSpacing = $state(0.1);
	let searchTimeout = $state(null);
	let mapInitialized = $state(false);
	let currentMapLayer = $state('satellite');
	let satelliteLayer = $state(null);
	let streetLayer = $state(null);
	let tempMarkers = $state([]);

	// Calculated values
	let totalRoofArea = $derived(roofPolygons.reduce((sum, polygon) => sum + polygon.area, 0));
	let panelArea = $derived(panelWidth * panelHeight);
	let panelWithSpacing = $derived((panelWidth + panelSpacing) * (panelHeight + panelSpacing));
	let estimatedPanels = $derived(Math.floor(totalRoofArea / panelWithSpacing));
	let totalPanelArea = $derived(estimatedPanels * panelArea);
	let coveragePercentage = $derived(totalRoofArea > 0 ? (totalPanelArea / totalRoofArea) * 100 : 0);

	onMount(async () => {
		try {
			const leafletCSS = document.createElement('link');
			leafletCSS.rel = 'stylesheet';
			leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
			document.head.appendChild(leafletCSS);

			await new Promise((resolve) => {
				leafletCSS.onload = resolve;
				leafletCSS.onerror = resolve;
			});

			const leafletScript = document.createElement('script');
			leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
			document.head.appendChild(leafletScript);

			await new Promise((resolve, reject) => {
				leafletScript.onload = resolve;
				leafletScript.onerror = reject;
			});

			await tick();
			leaflet = window.L;

			if (!leaflet) throw new Error('Leaflet failed to load');

			initializeMap();
		} catch (error) {
			console.error('Failed to initialize map:', error);
		}
	});

	function initializeMap() {
		const mapElement = document.getElementById('map');
		if (!mapElement || !leaflet) return;

		mapElement.style.height = '100%';
		mapElement.style.width = '100%';

		// Initialize map
		map = leaflet.map('map', {
			center: [52.520008, 13.404954],
			zoom: 13,
			zoomControl: true,
			attributionControl: true,
			preferCanvas: false
		});

		// Create layers
		satelliteLayer = leaflet.tileLayer(
			'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
			{ attribution: 'Tiles © Esri', maxZoom: 20 }
		);

		streetLayer = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '© OpenStreetMap contributors',
			maxZoom: 19
		});

		// Add default layer (satellite)
		satelliteLayer.addTo(map);

		// Add click handler
		map.on('click', handleMapClick);

		// Handle zoom events to only redraw panels, not move polygons
		map.on('zoomend', () => {
			// Only redraw panels after zoom is complete
			setTimeout(redrawPanels, 50);
		});

		mapInitialized = true;
		setTimeout(() => map?.invalidateSize(), 100);
	}

	function switchMapLayer() {
		if (!map || !satelliteLayer || !streetLayer) return;

		if (currentMapLayer === 'satellite') {
			map.removeLayer(satelliteLayer);
			map.addLayer(streetLayer);
			currentMapLayer = 'street';
		} else {
			map.removeLayer(streetLayer);
			map.addLayer(satelliteLayer);
			currentMapLayer = 'satellite';
		}
	}

	async function searchLocation(selectedResult = null) {
		const query = selectedResult || searchAddress;
		if (!query.trim() || !map) return;

		isSearching = true;
		showSearchResults = false;

		try {
			const response = await fetch(
				`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
			);
			const data = await response.json();

			if (data.length > 0) {
				const lat = parseFloat(data[0].lat);
				const lon = parseFloat(data[0].lon);
				map.setView([lat, lon], 20);

				if (window.searchMarker) {
					map.removeLayer(window.searchMarker);
				}
				window.searchMarker = leaflet
					.marker([lat, lon])
					.addTo(map)
					.bindPopup(`${data[0].display_name}`)
					.openPopup();
			}
		} catch (error) {
			console.error('Search failed:', error);
		} finally {
			isSearching = false;
		}
	}

	async function searchPreview() {
		if (!searchAddress.trim() || searchAddress.length < 3) {
			searchResults = [];
			showSearchResults = false;
			return;
		}

		try {
			const response = await fetch(
				`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddress)}&limit=5`
			);
			const data = await response.json();
			searchResults = data.slice(0, 5);
			showSearchResults = searchResults.length > 0;
		} catch (error) {
			console.error('Search preview failed:', error);
			searchResults = [];
			showSearchResults = false;
		}
	}

	function handleSearchInput() {
		if (searchTimeout) clearTimeout(searchTimeout);
		searchTimeout = setTimeout(searchPreview, 300);
	}

	function selectSearchResult(result) {
		searchAddress = result.display_name;
		showSearchResults = false;
		searchLocation(result.display_name);
	}

	function hideSearchResults() {
		setTimeout(() => {
			showSearchResults = false;
		}, 200);
	}

	function startDrawing() {
		if (!map) return;
		isDrawing = true;
		currentPolygon = { points: [], leafletPolygon: null, area: 0, panels: [] };
		tempMarkers = [];
		map.getContainer().style.cursor = 'crosshair';
	}

	function stopDrawing() {
		if (!map) return;
		isDrawing = false;

		// Clean up temporary markers
		tempMarkers.forEach((marker) => {
			if (marker && map.hasLayer(marker)) {
				map.removeLayer(marker);
			}
		});
		tempMarkers = [];

		if (currentPolygon?.leafletPolygon && map.hasLayer(currentPolygon.leafletPolygon)) {
			map.removeLayer(currentPolygon.leafletPolygon);
		}
		currentPolygon = null;
		map.getContainer().style.cursor = '';
	}

	function handleMapClick(e) {
		if (!isDrawing || !currentPolygon || !leaflet) return;

		// Get precise click coordinates with high precision
		const lat = parseFloat(e.latlng.lat.toFixed(8));
		const lng = parseFloat(e.latlng.lng.toFixed(8));

		// Store coordinates with high precision to prevent drift
		currentPolygon.points.push([lat, lng]);

		// Clean up previous temporary polygon
		if (currentPolygon.leafletPolygon && map.hasLayer(currentPolygon.leafletPolygon)) {
			map.removeLayer(currentPolygon.leafletPolygon);
		}

		// Add a point marker
		const marker = leaflet
			.circleMarker([lat, lng], {
				color: '#3b82f6',
				fillColor: '#3b82f6',
				fillOpacity: 1,
				radius: 4,
				weight: 2
			})
			.addTo(map);

		tempMarkers.push(marker);

		// Create temporary polygon if we have enough points
		if (currentPolygon.points.length >= 2) {
			currentPolygon.leafletPolygon = leaflet
				.polygon([...currentPolygon.points], {
					color: '#3b82f6',
					fillColor: 'rgba(59, 130, 246, 0.3)',
					weight: 2,
					opacity: 0.8,
					fillOpacity: 0.3
				})
				.addTo(map);
		}
	}

	function finishPolygon() {
		if (!currentPolygon || currentPolygon.points.length < 3 || !leaflet) return;

		// Clean up temporary markers
		tempMarkers.forEach((marker) => {
			if (marker && map.hasLayer(marker)) {
				map.removeLayer(marker);
			}
		});
		tempMarkers = [];

		// Remove temporary polygon
		if (currentPolygon.leafletPolygon && map.hasLayer(currentPolygon.leafletPolygon)) {
			map.removeLayer(currentPolygon.leafletPolygon);
		}

		// Calculate area
		const area = calculatePolygonArea(currentPolygon.points);
		currentPolygon.area = area;

		// Create final polygon with proper styling and ensure coordinates are fixed
		const fixedPoints = currentPolygon.points.map((point) => [
			parseFloat(point[0].toFixed(8)),
			parseFloat(point[1].toFixed(8))
		]);

		currentPolygon.points = fixedPoints;
		currentPolygon.leafletPolygon = leaflet
			.polygon(fixedPoints, {
				color: '#10b981',
				fillColor: 'rgba(16, 185, 129, 0.2)',
				weight: 2,
				opacity: 0.9,
				fillOpacity: 0.2
			})
			.addTo(map);

		// Add popup without the remove button dialog
		const panelCount = Math.floor(area / panelWithSpacing);
		currentPolygon.leafletPolygon.bindPopup(`
			<div style="font-size: 12px; font-family: inherit;">
				<strong>Roof Area:</strong> ${area.toFixed(2)} m²<br>
				<strong>Estimated Panels:</strong> ${panelCount}<br>
				<button onclick="removePolygon(${roofPolygons.length})" style="margin-top: 4px; padding: 2px 8px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Remove</button>
			</div>
		`);

		// Generate and draw panels
		generatePanels(currentPolygon);

		// Add to roof polygons array
		roofPolygons.push({ ...currentPolygon });

		// Stop drawing mode
		isDrawing = false;
		currentPolygon = null;
		map.getContainer().style.cursor = '';
	}

	function generatePanels(polygon) {
		if (!polygon || !polygon.points || polygon.points.length < 3) return;

		polygon.panels = [];
		const bounds = getPolygonBounds(polygon.points);

		// Convert panel dimensions from meters to degrees (approximate)
		const metersToLat = 1 / 111320; // 1 meter ≈ 1/111320 degrees latitude
		const metersToLng = 1 / (111320 * Math.cos((bounds.center.lat * Math.PI) / 180)); // longitude varies with latitude

		const panelLatSize = panelHeight * metersToLat;
		const panelLngSize = panelWidth * metersToLng;
		const spacingLatSize = panelSpacing * metersToLat;
		const spacingLngSize = panelSpacing * metersToLng;

		// Generate grid of panel positions with proper spacing from polygon edges
		const startLat = bounds.south + spacingLatSize;
		const startLng = bounds.west + spacingLngSize;

		for (
			let lat = startLat;
			lat <= bounds.north - panelLatSize - spacingLatSize;
			lat += panelLatSize + spacingLatSize
		) {
			for (
				let lng = startLng;
				lng <= bounds.east - panelLngSize - spacingLngSize;
				lng += panelLngSize + spacingLngSize
			) {
				// Define all four corners of the panel rectangle
				const panelCorners = [
					[lat, lng],
					[lat + panelLatSize, lng],
					[lat + panelLatSize, lng + panelLngSize],
					[lat, lng + panelLngSize]
				];

				// Check if ALL corners of the panel are inside the polygon
				const allCornersInside = panelCorners.every((corner) =>
					isPointInPolygon(corner, polygon.points)
				);

				// Only place panel if all corners are inside the polygon
				if (allCornersInside) {
					const panel = leaflet
						.polygon(panelCorners, {
							color: '#fbbf24',
							fillColor: '#fbbf24',
							weight: 1,
							opacity: 0.8,
							fillOpacity: 0.6
						})
						.addTo(map);

					panel.bindTooltip(`Solar Panel<br>${panelWidth}m × ${panelHeight}m`, {
						permanent: false,
						direction: 'center'
					});

					polygon.panels.push(panel);
				}
			}
		}
	}

	function redrawPanels() {
		// Only redraw panels for all polygons, don't touch the polygon coordinates
		roofPolygons.forEach((polygon) => {
			// Remove existing panels
			if (polygon.panels) {
				polygon.panels.forEach((panel) => {
					if (panel && map.hasLayer(panel)) {
						map.removeLayer(panel);
					}
				});
				polygon.panels = [];
			}
			// Regenerate panels using the stored polygon coordinates (which remain fixed)
			generatePanels(polygon);
		});
	}

	function getPolygonBounds(points) {
		let minLat = points[0][0],
			maxLat = points[0][0];
		let minLng = points[0][1],
			maxLng = points[0][1];

		points.forEach((point) => {
			minLat = Math.min(minLat, point[0]);
			maxLat = Math.max(maxLat, point[0]);
			minLng = Math.min(minLng, point[1]);
			maxLng = Math.max(maxLng, point[1]);
		});

		return {
			north: maxLat,
			south: minLat,
			east: maxLng,
			west: minLng,
			center: {
				lat: (minLat + maxLat) / 2,
				lng: (minLng + maxLng) / 2
			}
		};
	}

	function isPointInPolygon(point, polygon) {
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

	function calculatePolygonArea(points) {
		if (points.length < 3) return 0;

		const toRadians = (deg) => deg * (Math.PI / 180);
		const earthRadius = 6371000; // Earth radius in meters

		let area = 0;
		const n = points.length;

		for (let i = 0; i < n; i++) {
			const j = (i + 1) % n;
			const lat1 = toRadians(points[i][0]);
			const lon1 = toRadians(points[i][1]);
			const lat2 = toRadians(points[j][0]);
			const lon2 = toRadians(points[j][1]);

			area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
		}

		area = Math.abs((area * earthRadius * earthRadius) / 2);
		return area;
	}

	function clearAllPolygons() {
		if (!map) return;

		roofPolygons.forEach((polygon) => {
			// Remove polygon
			if (polygon.leafletPolygon && map.hasLayer(polygon.leafletPolygon)) {
				map.removeLayer(polygon.leafletPolygon);
			}
			// Remove panels
			if (polygon.panels) {
				polygon.panels.forEach((panel) => {
					if (panel && map.hasLayer(panel)) {
						map.removeLayer(panel);
					}
				});
			}
		});
		roofPolygons = [];
	}

	// Watch for panel setting changes and redraw panels
	$effect(() => {
		if (mapInitialized && roofPolygons.length > 0) {
			// Small delay to batch rapid changes
			const timeout = setTimeout(() => {
				redrawPanels();
			}, 100);
			return () => clearTimeout(timeout);
		}
	});

	globalThis.removePolygon = function (index) {
		const polygon = roofPolygons[index];
		if (polygon && map) {
			// Remove polygon
			if (polygon.leafletPolygon && map.hasLayer(polygon.leafletPolygon)) {
				map.removeLayer(polygon.leafletPolygon);
			}
			// Remove panels
			if (polygon.panels) {
				polygon.panels.forEach((panel) => {
					if (panel && map.hasLayer(panel)) {
						map.removeLayer(panel);
					}
				});
			}
		}
		roofPolygons.splice(index, 1);
		roofPolygons = [...roofPolygons]; // Trigger reactivity
	};
</script>

<!-- Main Container -->
<div class="bg-base-100 flex h-screen">
	<!-- Sidebar -->
	<aside class="bg-base-200/50 border-base-300 flex w-80 flex-col border-r backdrop-blur-sm">
		<!-- Search -->
		<div class="border-base-300 border-b p-4">
			<div class="form-control relative">
				<div class="input-group">
					<input
						type="text"
						placeholder="Search location..."
						class="input input-bordered focus:border-primary flex-1"
						bind:value={searchAddress}
						oninput={handleSearchInput}
						onfocus={() => searchAddress.length >= 3 && searchPreview()}
						onblur={hideSearchResults}
						onkeydown={(e) => e.key === 'Enter' && searchLocation()}
						disabled={!mapInitialized}
					/>
					<button
						class="btn btn-primary"
						onclick={() => searchLocation()}
						disabled={isSearching || !mapInitialized}
					>
						{#if isSearching}
							<span class="loading loading-spinner loading-xs"></span>
						{:else}
							<IconSearch class="h-4 w-4" />
						{/if}
					</button>
				</div>

				<!-- Search Dropdown -->
				{#if showSearchResults && searchResults.length > 0}
					<div class="absolute top-full right-0 left-0 z-50 mt-1">
						<ul
							class="menu bg-base-100 rounded-box border-base-300 max-h-60 overflow-auto border shadow-lg"
						>
							{#each searchResults as result}
								<li>
									<button
										class="justify-start p-3 text-sm"
										onmousedown={() => selectSearchResult(result)}
									>
										<div class="flex flex-col items-start">
											<div class="w-full truncate font-medium">
												{result.display_name.split(',')[0]}
											</div>
											<div class="w-full truncate text-xs opacity-60">
												{result.display_name}
											</div>
										</div>
									</button>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		</div>

		<!-- Map Layer Toggle -->
		<div class="border-base-300 border-b p-4">
			<div class="flex">
				<button
					class="btn btn-sm flex-1 {currentMapLayer === 'satellite'
						? 'btn-primary'
						: 'btn-outline'}"
					onclick={switchMapLayer}
					disabled={!mapInitialized}
				>
					Satellite
				</button>
				<button
					class="btn btn-sm ml-2 flex-1 {currentMapLayer === 'street'
						? 'btn-primary'
						: 'btn-outline'}"
					onclick={switchMapLayer}
					disabled={!mapInitialized}
				>
					Street
				</button>
			</div>
		</div>

		<!-- Drawing Tools -->
		<div class="border-base-300 border-b p-4">
			<div class="mb-3 flex gap-2">
				{#if !isDrawing}
					<button
						class="btn btn-primary btn-sm flex-1"
						onclick={startDrawing}
						disabled={!mapInitialized}
					>
						<IconPencil class="h-4 w-4" />
						Draw Roof
					</button>
				{:else}
					<button class="btn btn-success btn-sm" onclick={finishPolygon}>
						<IconCheck class="h-4 w-4" />
						Finish ({currentPolygon?.points?.length || 0} points)
					</button>
					<button class="btn btn-warning btn-sm" onclick={stopDrawing}>
						<IconX class="h-4 w-4" />
						Cancel
					</button>
				{/if}
			</div>

			{#if roofPolygons.length > 0}
				<button class="btn btn-error btn-sm w-full" onclick={clearAllPolygons}>
					<IconTrash class="h-4 w-4" />
					Clear All
				</button>
			{/if}

			{#if isDrawing}
				<div class="text-base-content/60 mt-2 text-xs">
					Click on the map to add points. Need at least 3 points to finish.
				</div>
			{/if}
		</div>

		<!-- Panel Settings -->
		<div class="border-base-300 border-b p-4">
			<h3 class="mb-3 text-sm font-semibold">Panel Settings</h3>

			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<span class="w-16 text-xs">Width</span>
					<input
						type="number"
						step="0.01"
						min="0.1"
						max="5"
						class="input input-bordered input-xs flex-1"
						bind:value={panelWidth}
					/>
					<span class="text-xs">m</span>
				</div>
				<div class="flex items-center gap-2">
					<span class="w-16 text-xs">Height</span>
					<input
						type="number"
						step="0.01"
						min="0.1"
						max="5"
						class="input input-bordered input-xs flex-1"
						bind:value={panelHeight}
					/>
					<span class="text-xs">m</span>
				</div>
				<div class="flex items-center gap-2">
					<span class="w-16 text-xs">Spacing</span>
					<input
						type="number"
						step="0.01"
						min="0"
						max="1"
						class="input input-bordered input-xs flex-1"
						bind:value={panelSpacing}
					/>
					<span class="text-xs">m</span>
				</div>
			</div>
		</div>

		<!-- Results -->
		<div class="flex-1 overflow-auto p-4">
			{#if totalRoofArea > 0}
				<div class="grid grid-cols-2 gap-3">
					<div class="bg-base-100 rounded-lg p-3 text-center">
						<div class="text-primary text-xl font-bold">{totalRoofArea.toFixed(0)}</div>
						<div class="text-base-content/60 text-xs">m² roof</div>
					</div>
					<div class="bg-base-100 rounded-lg p-3 text-center">
						<div class="text-secondary text-xl font-bold">{estimatedPanels}</div>
						<div class="text-base-content/60 text-xs">panels</div>
					</div>
					<div class="bg-base-100 rounded-lg p-3 text-center">
						<div class="text-accent text-xl font-bold">{totalPanelArea.toFixed(0)}</div>
						<div class="text-base-content/60 text-xs">m² solar</div>
					</div>
					<div class="bg-base-100 rounded-lg p-3 text-center">
						<div class="text-success text-xl font-bold">{coveragePercentage.toFixed(0)}%</div>
						<div class="text-base-content/60 text-xs">coverage</div>
					</div>
				</div>

				{#if roofPolygons.length > 0}
					<div class="mt-4">
						<h4 class="mb-2 text-sm font-medium">Roof Areas</h4>
						<div class="space-y-1">
							{#each roofPolygons as polygon, index}
								<div class="bg-base-100 flex items-center justify-between rounded p-2 text-xs">
									<div>
										<span class="font-medium">Roof {index + 1}</span><br />
										<span class="text-base-content/60">
											{polygon.area.toFixed(1)} m² • {Math.floor(polygon.area / panelWithSpacing)} panels
										</span>
									</div>
									<button
										class="btn btn-ghost btn-xs text-error"
										onclick={() => globalThis.removePolygon(index)}
									>
										<IconTrash class="h-3 w-3" />
									</button>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{:else}
				<div class="text-base-content/40 py-8 text-center">
					<IconSun class="mx-auto mb-2 h-12 w-12 opacity-40" />
					<p class="text-sm">Draw roof areas to calculate solar potential</p>
					<p class="mt-1 text-xs opacity-60">Click "Draw Roof" and click points on the map</p>
				</div>
			{/if}
		</div>
	</aside>

	<!-- Map Container -->
	<main class="relative flex-1">
		<div id="map" class="h-full w-full"></div>

		<!-- Loading Overlay -->
		{#if !mapInitialized}
			<div class="bg-base-100 absolute inset-0 flex items-center justify-center">
				<div class="text-center">
					<span class="loading loading-spinner loading-lg text-primary"></span>
					<p class="text-base-content/60 mt-2 text-sm">Loading map...</p>
				</div>
			</div>
		{/if}
	</main>
</div>

<style>
	:global(#map) {
		height: 100%;
		width: 100%;
		z-index: 1;
	}

	:global(.leaflet-container) {
		font-family: inherit;
	}

	:global(.leaflet-popup-content) {
		font-family: inherit;
	}

	:global(.leaflet-control-attribution) {
		font-size: 10px;
	}

	:global(.leaflet-tooltip) {
		font-family: inherit;
		font-size: 11px;
	}
</style>
