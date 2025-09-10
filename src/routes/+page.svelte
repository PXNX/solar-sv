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
	import IconMapPin from '~icons/heroicons/map-pin';
	import IconClock from '~icons/heroicons/clock';

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
	// CHANGED: More realistic panel dimensions (typical residential solar panel)
	let panelWidth = $state(2.0); // Standard panel width
	let panelHeight = $state(1.0); // Standard panel height
	let panelSpacing = $state(0.05); // Reduced spacing for realistic installation
	let costPerPanel = $state(500);
	let searchTimeout = $state(null);
	let mapInitialized = $state(false);
	let currentMapLayer = $state('satellite');
	let satelliteLayer = $state(null);
	let streetLayer = $state(null);
	let tempMarkers = $state([]);
	let showElevationDialog = $state(false);
	let currentElevationAngle = $state(30);
	let currentAddress = $state('');
	let roofHistory = $state([]);
	let draggedPointIndex = $state(null);
	let isDraggingPoint = $state(false);

	// Calculated values
	let totalRoofArea = $derived(
		roofPolygons.reduce((sum, polygon) => sum + polygon.effectiveArea, 0)
	);
	let panelArea = $derived(panelWidth * panelHeight);
	let panelWithSpacing = $derived((panelWidth + panelSpacing) * (panelHeight + panelSpacing));
	let estimatedPanels = $derived(Math.floor(totalRoofArea / panelWithSpacing));
	let totalPanelArea = $derived(estimatedPanels * panelArea);
	let coveragePercentage = $derived(totalRoofArea > 0 ? (totalPanelArea / totalRoofArea) * 100 : 0);
	let totalCost = $derived(estimatedPanels * costPerPanel);

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
			loadRoofHistory();
		} catch (error) {
			console.error('Failed to initialize map:', error);
		}
	});

	function loadRoofHistory() {
		const stored = localStorage.getItem('solarPanelRoofHistory');
		if (stored) {
			try {
				roofHistory = JSON.parse(stored);
			} catch (error) {
				console.error('Failed to load roof history:', error);
				roofHistory = [];
			}
		}
	}

	function saveRoofHistory() {
		try {
			localStorage.setItem('solarPanelRoofHistory', JSON.stringify(roofHistory));
		} catch (error) {
			console.error('Failed to save roof history:', error);
		}
	}

	function addToHistory(address) {
		if (!address) return;

		const existing = roofHistory.findIndex((item) => item.address === address);
		if (existing !== -1) {
			roofHistory.splice(existing, 1);
		}

		roofHistory.unshift({
			address,
			timestamp: Date.now(),
			date: new Date().toLocaleDateString()
		});

		// Keep only last 10 addresses
		if (roofHistory.length > 10) {
			roofHistory = roofHistory.slice(0, 10);
		}

		saveRoofHistory();
	}

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
		map.on('mousemove', handleMouseMove);
		map.on('mouseup', handleMouseUp);

		// Handle zoom events to only redraw panels, not move polygons
		map.on('zoomend', () => {
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
				currentAddress = data[0].display_name;

				if (window.searchMarker) {
					map.removeLayer(window.searchMarker);
				}
				window.searchMarker = leaflet
					.marker([lat, lon])
					.addTo(map)
					.bindPopup(`${data[0].display_name}`)
					.openPopup();

				addToHistory(data[0].display_name);
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

	function selectFromHistory(historyItem) {
		searchAddress = historyItem.address;
		searchLocation(historyItem.address);
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
			area: 0,
			effectiveArea: 0,
			elevationAngle: 30,
			panels: [],
			address: currentAddress
		};
		tempMarkers = [];
		map.getContainer().style.cursor = 'crosshair';
	}

	function stopDrawing() {
		if (!map) return;
		isDrawing = false;
		isDraggingPoint = false;
		draggedPointIndex = null;

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
		if (!isDrawing || !currentPolygon || !leaflet || isDraggingPoint) return;

		// Get precise click coordinates
		const lat = parseFloat(e.latlng.lat.toFixed(8));
		const lng = parseFloat(e.latlng.lng.toFixed(8));

		currentPolygon.points.push([lat, lng]);

		// Clean up previous temporary polygon
		if (currentPolygon.leafletPolygon && map.hasLayer(currentPolygon.leafletPolygon)) {
			map.removeLayer(currentPolygon.leafletPolygon);
		}

		// Clean up old markers
		tempMarkers.forEach((marker) => {
			if (marker && map.hasLayer(marker)) {
				map.removeLayer(marker);
			}
		});
		tempMarkers = [];

		// Add markers for all points - NO DRAGGING CAPABILITY
		currentPolygon.points.forEach((point, index) => {
			const marker = leaflet
				.circleMarker([point[0], point[1]], {
					color: '#3b82f6',
					fillColor: '#ffffff',
					fillOpacity: 1,
					radius: 6,
					weight: 3,
					className: 'polygon-point'
				})
				.addTo(map);

			// No drag handlers - points are fixed once placed

			tempMarkers.push(marker);
		});

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

	function handleMouseMove(e) {
		// No dragging functionality - this function is now simplified
		return;
	}

	function handleMouseUp(e) {
		// No dragging functionality - this function is now simplified
		return;
	}

	function getClickedPointIndex(clickLatLng) {
		// No longer needed since dragging is disabled
		return -1;
	}

	function finishPolygon() {
		if (!currentPolygon || currentPolygon.points.length < 3 || !leaflet) return;
		showElevationDialog = true;
	}

	function confirmPolygon() {
		if (!currentPolygon) return;

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

		// Calculate areas
		const area = calculatePolygonArea(currentPolygon.points);
		currentPolygon.area = area;
		currentPolygon.elevationAngle = currentElevationAngle;

		// Calculate effective area considering roof angle
		const angleInRadians = (currentElevationAngle * Math.PI) / 180;
		currentPolygon.effectiveArea = area * Math.cos(angleInRadians);

		// Create final polygon with proper styling
		const fixedPoints = currentPolygon.points.map((point) => [
			parseFloat(point[0].toFixed(8)),
			parseFloat(point[1].toFixed(8))
		]);

		currentPolygon.points = fixedPoints;
		currentPolygon.address = currentAddress;

		const polygonIndex = roofPolygons.length; // Get the index before adding

		currentPolygon.leafletPolygon = leaflet
			.polygon(fixedPoints, {
				color: '#10b981',
				fillColor: 'rgba(16, 185, 129, 0.2)',
				weight: 2,
				opacity: 0.9,
				fillOpacity: 0.2
			})
			.addTo(map);

		// CHANGED: Updated popup content and tooltip behavior
		const panelCount = Math.floor(currentPolygon.effectiveArea / panelWithSpacing);
		const popupContent = `
			<div style="font-size: 12px; font-family: inherit;">
				<strong>Roof Area:</strong> ${area.toFixed(2)} m²<br>
				<strong>Effective Area:</strong> ${currentPolygon.effectiveArea.toFixed(2)} m²<br>
				<strong>Elevation Angle:</strong> ${currentElevationAngle}°<br>
				<strong>Estimated Panels:</strong> ${panelCount}<br>
				<strong>Address:</strong> ${currentAddress.split(',')[0] || 'Unknown'}<br>
				<button onclick="removePolygon(${polygonIndex})" style="margin-top: 4px; padding: 2px 8px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Remove</button>
			</div>
		`;

		// Add popup and tooltip to polygon
		currentPolygon.leafletPolygon.bindPopup(popupContent);

		// CHANGED: Add persistent tooltip for polygon info
		currentPolygon.leafletPolygon.bindTooltip(
			`
			<div style="font-size: 11px;">
				<strong>Roof ${polygonIndex + 1}</strong><br>
				${area.toFixed(1)} m² • ${panelCount} panels<br>
				${currentElevationAngle}° angle
			</div>
		`,
			{
				permanent: false,
				direction: 'center',
				className: 'roof-tooltip'
			}
		);

		// Generate and draw panels based on roof orientation
		generatePanelsWithOrientation(currentPolygon, polygonIndex);

		// Add to roof polygons array
		roofPolygons.push({ ...currentPolygon });

		// Reset state
		isDrawing = false;
		currentPolygon = null;
		showElevationDialog = false;
		currentElevationAngle = 30;
		isDraggingPoint = false;
		draggedPointIndex = null;
		map.getContainer().style.cursor = '';
	}

	function getRoofOrientation(points) {
		// Use the direction of the first two points to determine panel orientation
		if (points.length < 2) return { angle: 0, orientation: 'horizontal' };

		// Calculate the vector from first to second point
		const vector = [
			points[1][0] - points[0][0], // lat difference
			points[1][1] - points[0][1] // lng difference
		];

		// Calculate angle in radians, then convert to degrees
		const angleRad = Math.atan2(vector[1], vector[0]);
		const angleDeg = angleRad * (180 / Math.PI);

		return {
			angle: angleDeg,
			orientation:
				Math.abs(angleDeg) % 180 > 45 && Math.abs(angleDeg) % 180 < 135 ? 'vertical' : 'horizontal'
		};
	}

	// CHANGED: Completely rewritten panel generation for realistic appearance
	function generatePanelsWithOrientation(polygon, polygonIndex) {
		if (!polygon || !polygon.points || polygon.points.length < 3) return;

		polygon.panels = [];
		const bounds = getPolygonBounds(polygon.points);

		// Get the exact angle from the first two points
		const roofInfo = getRoofOrientation(polygon.points);
		const alignmentAngle = roofInfo.angle;

		// Convert panel dimensions from meters to degrees
		const metersToLat = 1 / 111320;
		const metersToLng = 1 / (111320 * Math.cos((bounds.center.lat * Math.PI) / 180));

		// Calculate panel dimensions in coordinate space
		let panelLatSize, panelLngSize;

		// Convert angle to radians for calculations
		const angleRad = alignmentAngle * (Math.PI / 180);

		// For better alignment, we'll use the angle to determine the primary axis
		// If the angle is more vertical (closer to 90° or -90°), use vertical orientation
		const normalizedAngle = Math.abs(alignmentAngle) % 180;
		const useVerticalOrientation = normalizedAngle > 45 && normalizedAngle < 135;

		if (useVerticalOrientation) {
			// Panels oriented more vertically (portrait)
			panelLatSize = panelHeight * metersToLat;
			panelLngSize = panelWidth * metersToLng;
		} else {
			// Panels oriented more horizontally (landscape)
			panelLatSize = panelWidth * metersToLat;
			panelLngSize = panelHeight * metersToLng;
		}

		const spacingLatSize = panelSpacing * metersToLat;
		const spacingLngSize = panelSpacing * metersToLng;

		// Create a grid aligned with the first edge direction
		// We'll create a rotated grid that follows the first edge alignment

		// Calculate the step vectors for the grid based on the alignment angle
		const cosAngle = Math.cos(angleRad);
		const sinAngle = Math.sin(angleRad);

		// Primary direction (along the first edge)
		const primaryStepLat = (panelLatSize + spacingLatSize) * cosAngle;
		const primaryStepLng = (panelLngSize + spacingLngSize) * sinAngle;

		// Secondary direction (perpendicular to first edge)
		const secondaryStepLat = -(panelLngSize + spacingLngSize) * sinAngle;
		const secondaryStepLng = (panelLatSize + spacingLatSize) * cosAngle;

		// Start from the polygon center and work outward
		const startLat = bounds.center.lat;
		const startLng = bounds.center.lng;

		// Determine grid extents based on polygon bounds
		const maxGridSize = Math.max(bounds.north - bounds.south, bounds.east - bounds.west);
		const gridSteps = Math.ceil(maxGridSize / Math.min(panelLatSize, panelLngSize)) + 2;

		// Generate grid points in both directions from center
		for (let i = -gridSteps; i <= gridSteps; i++) {
			for (let j = -gridSteps; j <= gridSteps; j++) {
				// Calculate panel center position
				const panelCenterLat = startLat + i * primaryStepLat + j * secondaryStepLat;
				const panelCenterLng = startLng + i * primaryStepLng + j * secondaryStepLng;

				// Calculate panel corners rotated according to the first edge angle
				const halfLatSize = panelLatSize / 2;
				const halfLngSize = panelLngSize / 2;

				// Rotate the panel rectangle around its center
				const panelCorners = [
					[
						panelCenterLat + (-halfLatSize * cosAngle - -halfLngSize * sinAngle),
						panelCenterLng + (-halfLatSize * sinAngle + -halfLngSize * cosAngle)
					],
					[
						panelCenterLat + (halfLatSize * cosAngle - -halfLngSize * sinAngle),
						panelCenterLng + (halfLatSize * sinAngle + -halfLngSize * cosAngle)
					],
					[
						panelCenterLat + (halfLatSize * cosAngle - halfLngSize * sinAngle),
						panelCenterLng + (halfLatSize * sinAngle + halfLngSize * cosAngle)
					],
					[
						panelCenterLat + (-halfLatSize * cosAngle - halfLngSize * sinAngle),
						panelCenterLng + (-halfLatSize * sinAngle + halfLngSize * cosAngle)
					]
				];

				// Check if panel center is within bounds (rough filter)
				if (
					panelCenterLat < bounds.south - panelLatSize ||
					panelCenterLat > bounds.north + panelLatSize ||
					panelCenterLng < bounds.west - panelLngSize ||
					panelCenterLng > bounds.east + panelLngSize
				) {
					continue;
				}

				// Check if all corners are inside the polygon
				const allCornersInside = panelCorners.every((corner) =>
					isPointInPolygon(corner, polygon.points)
				);

				// Also check that the panel center is inside (additional safety check)
				const centerInside = isPointInPolygon([panelCenterLat, panelCenterLng], polygon.points);

				if (allCornersInside && centerInside) {
					// CHANGED: Create realistic solar panel appearance with multiple elements

					// Main panel body (dark blue/black)
					const panel = leaflet
						.polygon(panelCorners, {
							color: '#1a1a2e',
							fillColor: '#16213e',
							weight: 1,
							opacity: 1,
							fillOpacity: 0.9,
							className: 'solar-panel'
						})
						.addTo(map);

					// Add solar cell grid lines to make it look realistic
					const cellGridLines = createSolarCellGrid(
						panelCorners,
						panelCenterLat,
						panelCenterLng,
						cosAngle,
						sinAngle,
						halfLatSize,
						halfLngSize
					);
					cellGridLines.forEach((line) => {
						const gridLine = leaflet
							.polyline(line, {
								color: '#0f172a',
								weight: 0.5,
								opacity: 0.8
							})
							.addTo(map);
						polygon.panels.push(gridLine);
					});

					// Add silver frame around the panel
					const frame = leaflet
						.polygon(panelCorners, {
							color: '#94a3b8',
							fillColor: 'transparent',
							weight: 2,
							opacity: 0.9,
							fillOpacity: 0,
							className: 'solar-panel-frame'
						})
						.addTo(map);

					// Bind tooltip with roof information
					panel.bindTooltip(
						`
					<div style="font-size: 11px;">
						<strong>Solar Panel</strong><br>
						${panelWidth}m × ${panelHeight}m<br>
						Roof ${polygonIndex + 1} • ${polygon.elevationAngle}° angle
					</div>
				`,
						{
							permanent: false,
							direction: 'center',
							className: 'panel-tooltip'
						}
					);

					polygon.panels.push(panel);
					polygon.panels.push(frame);
				}
			}
		}
	}

	// CHANGED: New function to create realistic solar cell grid
	function createSolarCellGrid(
		panelCorners,
		centerLat,
		centerLng,
		cosAngle,
		sinAngle,
		halfLatSize,
		halfLngSize
	) {
		const gridLines = [];

		// Create a 6x10 grid of solar cells (typical for a residential panel)
		const cellsWidth = 6;
		const cellsHeight = 10;

		// Calculate cell dimensions
		const cellLatSize = (halfLatSize * 2) / cellsHeight;
		const cellLngSize = (halfLngSize * 2) / cellsWidth;

		// Vertical grid lines
		for (let i = 1; i < cellsWidth; i++) {
			const offsetLng = -halfLngSize + i * cellLngSize;
			const startLat = centerLat + (-halfLatSize * cosAngle - offsetLng * sinAngle);
			const startLng = centerLng + (-halfLatSize * sinAngle + offsetLng * cosAngle);
			const endLat = centerLat + (halfLatSize * cosAngle - offsetLng * sinAngle);
			const endLng = centerLng + (halfLatSize * sinAngle + offsetLng * cosAngle);

			gridLines.push([
				[startLat, startLng],
				[endLat, endLng]
			]);
		}

		// Horizontal grid lines
		for (let i = 1; i < cellsHeight; i++) {
			const offsetLat = -halfLatSize + i * cellLatSize;
			const startLat = centerLat + (offsetLat * cosAngle - -halfLngSize * sinAngle);
			const startLng = centerLng + (offsetLat * sinAngle + -halfLngSize * cosAngle);
			const endLat = centerLat + (offsetLat * cosAngle - halfLngSize * sinAngle);
			const endLng = centerLng + (offsetLat * sinAngle + halfLngSize * cosAngle);

			gridLines.push([
				[startLat, startLng],
				[endLat, endLng]
			]);
		}

		return gridLines;
	}

	function redrawPanels() {
		roofPolygons.forEach((polygon, index) => {
			if (polygon.panels) {
				polygon.panels.forEach((panel) => {
					if (panel && map.hasLayer(panel)) {
						map.removeLayer(panel);
					}
				});
				polygon.panels = [];
			}
			generatePanelsWithOrientation(polygon, index);
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
		const earthRadius = 6371000;

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
			if (polygon.leafletPolygon && map.hasLayer(polygon.leafletPolygon)) {
				map.removeLayer(polygon.leafletPolygon);
			}
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
			const timeout = setTimeout(() => {
				redrawPanels();
			}, 100);
			return () => clearTimeout(timeout);
		}
	});

	globalThis.removePolygon = function (index) {
		const polygon = roofPolygons[index];
		if (polygon && map) {
			if (polygon.leafletPolygon && map.hasLayer(polygon.leafletPolygon)) {
				map.removeLayer(polygon.leafletPolygon);
			}
			if (polygon.panels) {
				polygon.panels.forEach((panel) => {
					if (panel && map.hasLayer(panel)) {
						map.removeLayer(panel);
					}
				});
			}
		}
		roofPolygons.splice(index, 1);
		roofPolygons = [...roofPolygons];
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

		<!-- Address History -->
		{#if roofHistory.length > 0}
			<div class="border-base-300 border-b p-4">
				<h3 class="mb-2 flex items-center gap-2 text-sm font-semibold">
					<IconClock class="h-4 w-4" />
					Recent Addresses
				</h3>
				<div class="max-h-32 space-y-1 overflow-y-auto">
					{#each roofHistory as historyItem}
						<button
							class="btn btn-ghost btn-sm w-full justify-start text-left text-xs"
							onclick={() => selectFromHistory(historyItem)}
						>
							<IconMapPin class="h-3 w-3 flex-shrink-0" />
							<div class="truncate">
								<div class="font-medium">{historyItem.address.split(',')[0]}</div>
								<div class="text-xs opacity-60">{historyItem.date}</div>
							</div>
						</button>
					{/each}
				</div>
			</div>
		{/if}

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
						min="0.5"
						max="3"
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
						min="0.5"
						max="3"
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
				<div class="flex items-center gap-2">
					<span class="w-16 text-xs">Cost/Panel</span>
					<input
						type="number"
						step="10"
						min="0"
						class="input input-bordered input-xs flex-1"
						bind:value={costPerPanel}
					/>
					<span class="text-xs">€</span>
				</div>
			</div>
		</div>

		<!-- Results -->
		<div class="flex-1 overflow-auto p-4">
			{#if totalRoofArea > 0}
				<div class="grid grid-cols-2 gap-3">
					<div class="bg-base-100 rounded-lg p-3 text-center">
						<div class="text-primary text-xl font-bold">{totalRoofArea.toFixed(0)}</div>
						<div class="text-base-content/60 text-xs">m² effective</div>
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

				<!-- Cost Summary -->
				<div class="bg-base-100 mt-3 rounded-lg p-3">
					<div class="text-center">
						<div class="text-warning text-2xl font-bold">€{totalCost.toLocaleString()}</div>
						<div class="text-base-content/60 text-xs">Total estimated cost</div>
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
											{polygon.address ? polygon.address.split(',')[0] : 'Unknown'}<br />
											{polygon.area.toFixed(1)} m² • {polygon.elevationAngle}° angle<br />
											Effective: {polygon.effectiveArea.toFixed(1)} m² • {Math.floor(
												polygon.effectiveArea / panelWithSpacing
											)} panels
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

<!-- Elevation Angle Dialog -->
{#if showElevationDialog}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="bg-base-100 mx-4 max-w-md rounded-lg p-6 shadow-xl">
			<h3 class="mb-4 text-lg font-semibold">Set Roof Elevation Angle</h3>

			<div class="mb-6">
				<label class="label">
					<span class="label-text">Roof angle from horizontal (degrees)</span>
				</label>
				<input
					type="range"
					min="0"
					max="60"
					step="1"
					class="range range-primary w-full"
					bind:value={currentElevationAngle}
				/>
				<div class="mt-1 flex justify-between px-2 text-xs">
					<span>0° (flat)</span>
					<span class="font-semibold">{currentElevationAngle}°</span>
					<span>60° (steep)</span>
				</div>
			</div>

			<div class="bg-base-200 mb-6 rounded-lg p-3 text-sm">
				<p><strong>Angle Effect:</strong></p>
				<p>• Flat roof (0°): Full area available</p>
				<p>
					• Angled roof: Effective area = {(
						Math.cos((currentElevationAngle * Math.PI) / 180) * 100
					).toFixed(1)}% of actual
				</p>
				<p class="mt-2 text-xs opacity-70">
					Steep roofs have less horizontal space for panels due to their angled surface.
				</p>
			</div>

			<div class="flex justify-end gap-3">
				<button
					class="btn btn-ghost"
					onclick={() => {
						showElevationDialog = false;
						stopDrawing();
					}}
				>
					Cancel
				</button>
				<button class="btn btn-primary" onclick={confirmPolygon}> Confirm Roof </button>
			</div>
		</div>
	</div>
{/if}

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

	/* CHANGED: Updated polygon point styles - no dragging capability */
	:global(.polygon-point) {
		cursor: default !important;
	}

	:global(.polygon-point:hover) {
		cursor: default !important;
		transform: scale(1.1);
		transition: transform 0.2s ease;
	}

	/* CHANGED: Custom tooltip styling for roof information */
	:global(.roof-tooltip) {
		background-color: rgba(0, 0, 0, 0.8) !important;
		color: white !important;
		border: none !important;
		border-radius: 4px !important;
		padding: 4px 8px !important;
	}

	:global(.roof-tooltip::before) {
		border-top-color: rgba(0, 0, 0, 0.8) !important;
	}

	/* CHANGED: New realistic solar panel styling */
	:global(.solar-panel) {
		transition: all 0.2s ease;
	}

	:global(.solar-panel:hover) {
		filter: brightness(1.1);
	}

	:global(.solar-panel-frame) {
		pointer-events: none;
	}

	/* CHANGED: Panel tooltip styling */
	:global(.panel-tooltip) {
		background-color: rgba(20, 33, 61, 0.95) !important;
		color: white !important;
		border: 1px solid #94a3b8 !important;
		border-radius: 4px !important;
		padding: 6px 10px !important;
		font-size: 11px !important;
	}

	:global(.panel-tooltip::before) {
		border-top-color: rgba(20, 33, 61, 0.95) !important;
	}

	/* Ensure panels render above roof polygons but below controls */
	:global(.leaflet-overlay-pane svg) {
		pointer-events: auto;
	}

	:global(.leaflet-overlay-pane .solar-panel) {
		z-index: 100;
	}

	:global(.leaflet-overlay-pane .solar-panel-frame) {
		z-index: 101;
	}
</style>
