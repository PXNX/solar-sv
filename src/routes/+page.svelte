<!-- SolarPanelPlanner.svelte -->
<script>
	import { onMount, tick } from 'svelte';

	// Svelte 5 runes
	let map = $state(null);
	let leaflet = $state(null);
	let mapContainer = $state(null);
	let searchAddress = $state('');
	let searchResults = $state([]);
	let showSearchResults = $state(false);
	let isSearching = $state(false);
	let roofPolygons = $state([]);
	let currentPolygon = $state(null);
	let isDrawing = $state(false);
	let panelWidth = $state(1.65); // meters
	let panelHeight = $state(1.0); // meters
	let panelSpacing = $state(0.1); // meters between panels
	let searchTimeout = $state(null);
	let mapInitialized = $state(false);

	// Calculated values
	let totalRoofArea = $derived(roofPolygons.reduce((sum, polygon) => sum + polygon.area, 0));

	let panelArea = $derived(panelWidth * panelHeight);
	let panelWithSpacing = $derived((panelWidth + panelSpacing) * (panelHeight + panelSpacing));
	let estimatedPanels = $derived(Math.floor(totalRoofArea / panelWithSpacing));
	let totalPanelArea = $derived(estimatedPanels * panelArea);
	let coveragePercentage = $derived(totalRoofArea > 0 ? (totalPanelArea / totalRoofArea) * 100 : 0);

	onMount(async () => {
		try {
			// Add Leaflet CSS - use the global version for 2.0.0-alpha.1
			const leafletCSS = document.createElement('link');
			leafletCSS.rel = 'stylesheet';
			leafletCSS.href = 'https://unpkg.com/leaflet@2.0.0-alpha.1/dist/leaflet.css';
			document.head.appendChild(leafletCSS);

			// Wait for CSS to load
			await new Promise((resolve) => {
				leafletCSS.onload = resolve;
				leafletCSS.onerror = resolve; // Continue even if CSS fails
			});

			// Use the global version of Leaflet 2.0 alpha for backward compatibility
			const leafletScript = document.createElement('script');
			leafletScript.src = 'https://unpkg.com/leaflet@2.0.0-alpha.1/dist/leaflet-global.js';
			document.head.appendChild(leafletScript);

			await new Promise((resolve, reject) => {
				leafletScript.onload = resolve;
				leafletScript.onerror = reject;
			});

			// Wait for next tick to ensure DOM is ready
			await tick();

			leaflet = window.L;

			if (!leaflet) {
				throw new Error('Leaflet failed to load');
			}

			// Ensure the map container exists and has dimensions
			const mapElement = document.getElementById('map');
			if (!mapElement) {
				throw new Error('Map container not found');
			}

			// Add explicit dimensions to prevent size issues
			mapElement.style.height = '100%';
			mapElement.style.width = '100%';

			// Initialize map
			map = leaflet.map('map', {
				center: [52.520008, 13.404954], // Berlin default
				zoom: 13,
				zoomControl: true,
				attributionControl: true
			});

			// Add satellite imagery as default
			const satellite = leaflet
				.tileLayer(
					'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
					{
						attribution: 'Tiles © Esri',
						maxZoom: 20
					}
				)
				.addTo(map);

			// Add street layer
			const street = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '© OpenStreetMap contributors',
				maxZoom: 19
			});

			const baseMaps = {
				Satellite: satellite,
				Street: street
			};

			leaflet.control.layers(baseMaps).addTo(map);

			// Add drawing functionality
			map.on('click', handleMapClick);

			mapInitialized = true;

			// Force map to resize in case container wasn't properly sized
			setTimeout(() => {
				if (map) {
					map.invalidateSize();
				}
			}, 100);
		} catch (error) {
			console.error('Failed to initialize map:', error);
			// Fallback: try with regular Leaflet if global version fails
			try {
				const fallbackScript = document.createElement('script');
				fallbackScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
				document.head.appendChild(fallbackScript);

				await new Promise((resolve) => {
					fallbackScript.onload = resolve;
				});

				leaflet = window.L;
				initializeMapFallback();
			} catch (fallbackError) {
				console.error('Fallback map initialization also failed:', fallbackError);
			}
		}
	});

	function initializeMapFallback() {
		// Fallback initialization with Leaflet 1.9.4
		const mapElement = document.getElementById('map');
		if (!mapElement || !leaflet) return;

		mapElement.style.height = '100%';
		mapElement.style.width = '100%';

		map = leaflet.map('map').setView([52.520008, 13.404954], 13);

		leaflet
			.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '© OpenStreetMap contributors',
				maxZoom: 19
			})
			.addTo(map);

		map.on('click', handleMapClick);
		mapInitialized = true;

		setTimeout(() => {
			if (map) {
				map.invalidateSize();
			}
		}, 100);
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

				// Add a marker for the searched location
				if (window.searchMarker) {
					map.removeLayer(window.searchMarker);
				}
				window.searchMarker = leaflet
					.marker([lat, lon])
					.addTo(map)
					.bindPopup(`📍 ${data[0].display_name}`)
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
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}
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
		currentPolygon = {
			points: [],
			leafletPolygon: null,
			area: 0
		};
		map.getContainer().style.cursor = 'crosshair';
	}

	function stopDrawing() {
		if (!map) return;
		isDrawing = false;
		currentPolygon = null;
		map.getContainer().style.cursor = '';
	}

	function handleMapClick(e) {
		if (!isDrawing || !currentPolygon) return;

		currentPolygon.points.push([e.latlng.lat, e.latlng.lng]);

		if (currentPolygon.leafletPolygon) {
			map.removeLayer(currentPolygon.leafletPolygon);
		}

		if (currentPolygon.points.length >= 2) {
			currentPolygon.leafletPolygon = leaflet
				.polygon(currentPolygon.points, {
					color: 'blue',
					fillColor: 'rgba(0, 100, 255, 0.3)',
					weight: 2
				})
				.addTo(map);
		}
	}

	function finishPolygon() {
		if (!currentPolygon || currentPolygon.points.length < 3 || !leaflet) return;

		// Calculate area using Shoelace formula
		const area = calculatePolygonArea(currentPolygon.points);
		currentPolygon.area = area;

		// Style the finished polygon
		currentPolygon.leafletPolygon.setStyle({
			color: 'green',
			fillColor: 'rgba(0, 255, 0, 0.3)'
		});

		// Add popup with area info
		currentPolygon.leafletPolygon.bindPopup(`
      <div class="text-sm">
        <strong>Roof Area:</strong> ${area.toFixed(2)} m²<br>
        <strong>Est. Panels:</strong> ${Math.floor(area / panelWithSpacing)}<br>
        <button onclick="removePolygon(${roofPolygons.length})" class="btn btn-xs btn-error mt-1">Remove</button>
      </div>
    `);

		roofPolygons.push(currentPolygon);
		stopDrawing();
	}

	function calculatePolygonArea(points) {
		if (points.length < 3) return 0;

		// Convert lat/lng to approximate meters using Web Mercator projection
		const toRadians = (deg) => deg * (Math.PI / 180);
		const earthRadius = 6371000; // meters

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
			if (polygon.leafletPolygon) {
				map.removeLayer(polygon.leafletPolygon);
			}
		});
		roofPolygons = [];
	}

	// Make removePolygon available globally for popup buttons
	globalThis.removePolygon = function (index) {
		const polygon = roofPolygons[index];
		if (polygon && polygon.leafletPolygon && map) {
			map.removeLayer(polygon.leafletPolygon);
		}
		roofPolygons.splice(index, 1);
		roofPolygons = roofPolygons; // Trigger reactivity
	};
</script>

<div class="bg-base-100 min-h-screen">
	<!-- Header -->
	<div class="navbar bg-primary text-primary-content">
		<div class="flex-1">
			<h1 class="text-xl font-bold">Solar Panel Roof Planner</h1>
		</div>
	</div>

	<div class="flex h-screen flex-col lg:flex-row">
		<!-- Control Panel -->
		<div class="bg-base-200 w-full overflow-y-auto p-4 lg:w-80">
			<!-- Map Status -->
			{#if !mapInitialized}
				<div class="alert alert-info mb-4">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6 shrink-0 stroke-current"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>Loading map...</span>
				</div>
			{/if}

			<!-- Address Search -->
			<div class="card bg-base-100 mb-4 shadow-xl">
				<div class="card-body">
					<h2 class="card-title">Search Location</h2>
					<div class="form-control relative">
						<div class="input-group">
							<input
								type="text"
								placeholder="Enter address..."
								class="input input-bordered flex-1"
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
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-4 w-4"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
										/>
									</svg>
								{/if}
							</button>
						</div>

						<!-- Search Results Dropdown -->
						{#if showSearchResults && searchResults.length > 0}
							<div class="absolute top-full right-0 left-0 z-50 mt-1">
								<ul
									class="menu bg-base-100 rounded-box border-base-300 max-h-60 overflow-y-auto border shadow-lg"
								>
									{#each searchResults as result}
										<li>
											<button
												class="hover:bg-base-200 p-2 text-left text-sm"
												onmousedown={() => selectSearchResult(result)}
											>
												<div>
													<div class="truncate font-medium">
														{result.display_name.split(',')[0]}
													</div>
													<div class="truncate text-xs opacity-60">{result.display_name}</div>
												</div>
											</button>
										</li>
									{/each}
								</ul>
							</div>
						{/if}
					</div>

					{#if searchAddress && !isSearching}
						<div class="mt-2 text-xs opacity-60">
							Press Enter to search or select from dropdown suggestions
						</div>
					{/if}
				</div>
			</div>

			<!-- Drawing Controls -->
			<div class="card bg-base-100 mb-4 shadow-xl">
				<div class="card-body">
					<h2 class="card-title">Draw Roof Polygons</h2>
					<div class="mb-2 flex gap-2">
						{#if !isDrawing}
							<button
								class="btn btn-secondary btn-sm"
								onclick={startDrawing}
								disabled={!mapInitialized}
							>
								Start Drawing
							</button>
						{:else}
							<button class="btn btn-success btn-sm" onclick={finishPolygon}>
								Finish Polygon
							</button>
							<button class="btn btn-warning btn-sm" onclick={stopDrawing}> Cancel </button>
						{/if}
					</div>
					{#if roofPolygons.length > 0}
						<button class="btn btn-error btn-sm" onclick={clearAllPolygons}> Clear All </button>
					{/if}
					{#if isDrawing}
						<div class="alert alert-info">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-6 w-6 shrink-0 stroke-current"
								fill="none"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<span>Click on the map to add points to your roof polygon</span>
						</div>
					{/if}
				</div>
			</div>

			<!-- Panel Configuration -->
			<div class="card bg-base-100 mb-4 shadow-xl">
				<div class="card-body">
					<h2 class="card-title">Panel Configuration</h2>
					<div class="form-control">
						<label class="label">
							<span class="label-text">Panel Width (m)</span>
						</label>
						<input
							type="number"
							step="0.01"
							class="input input-bordered input-sm"
							bind:value={panelWidth}
						/>
					</div>
					<div class="form-control">
						<label class="label">
							<span class="label-text">Panel Height (m)</span>
						</label>
						<input
							type="number"
							step="0.01"
							class="input input-bordered input-sm"
							bind:value={panelHeight}
						/>
					</div>
					<div class="form-control">
						<label class="label">
							<span class="label-text">Panel Spacing (m)</span>
						</label>
						<input
							type="number"
							step="0.01"
							class="input input-bordered input-sm"
							bind:value={panelSpacing}
						/>
					</div>
				</div>
			</div>

			<!-- Results -->
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h2 class="card-title">Solar Panel Summary</h2>
					<div class="stats stats-vertical shadow">
						<div class="stat">
							<div class="stat-title">Total Roof Area</div>
							<div class="stat-value text-lg">{totalRoofArea.toFixed(2)} m²</div>
						</div>
						<div class="stat">
							<div class="stat-title">Estimated Panels</div>
							<div class="stat-value text-lg">{estimatedPanels}</div>
						</div>
						<div class="stat">
							<div class="stat-title">Panel Coverage Area</div>
							<div class="stat-value text-lg">{totalPanelArea.toFixed(2)} m²</div>
						</div>
						<div class="stat">
							<div class="stat-title">Coverage Percentage</div>
							<div class="stat-value text-lg">{coveragePercentage.toFixed(1)}%</div>
						</div>
					</div>

					{#if estimatedPanels > 0}
						<div class="mt-4">
							<div class="text-sm opacity-70">
								Panel size: {panelWidth}m × {panelHeight}m = {panelArea.toFixed(2)} m² each
							</div>
							<div class="text-sm opacity-70">
								With spacing: {(panelWidth + panelSpacing).toFixed(2)}m × {(
									panelHeight + panelSpacing
								).toFixed(2)}m per panel
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Map -->
		<div class="relative flex-1">
			<div id="map" class="h-full w-full"></div>
			{#if !mapInitialized}
				<div class="bg-base-200 bg-opacity-75 absolute inset-0 flex items-center justify-center">
					<span class="loading loading-spinner loading-lg"></span>
				</div>
			{/if}
		</div>
	</div>
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

	/* Ensure search dropdown appears above map */
	.relative {
		position: relative;
	}

	/* Fix for leaflet attribution position */
	:global(.leaflet-control-attribution) {
		font-size: 10px;
	}
</style>
