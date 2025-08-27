<!-- SolarPanelPlanner.svelte -->
<script>
	import { onMount, tick } from 'svelte';

	import html2canvas from 'html2canvas';

	// Icons - only essential ones
	import IconSearch from '~icons/heroicons/magnifying-glass';
	import IconPencil from '~icons/heroicons/pencil';
	import IconCheck from '~icons/heroicons/check';
	import IconX from '~icons/heroicons/x-mark';
	import IconTrash from '~icons/heroicons/trash';
	import IconSun from '~icons/heroicons/sun';
	import IconCamera from '~icons/heroicons/camera';
	import IconDocumentArrowDown from '~icons/heroicons/document-arrow-down';

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
	let costPerPanel = $state(500); // New: Cost per panel in currency
	let searchTimeout = $state(null);
	let mapInitialized = $state(false);
	let currentMapLayer = $state('satellite');
	let satelliteLayer = $state(null);
	let streetLayer = $state(null);
	let tempMarkers = $state([]);
	let isExporting = $state(false);
	let showElevationDialog = $state(false);
	let currentElevationAngle = $state(30); // Default roof angle in degrees

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

			// Load jsPDF and html2canvas for export functionality
			await loadExportLibraries();

			initializeMap();
		} catch (error) {
			console.error('Failed to initialize map:', error);
		}
	});

	async function loadExportLibraries() {
		try {
			console.log('Loading export libraries...');

			// html2canvas is imported directly, just assign to window for compatibility
			if (!window.html2canvas) {
				window.html2canvas = html2canvas;
				console.log('html2canvas assigned to window object');
			}

			// Load jsPDF
			if (!window.jsPDF) {
				console.log('Loading jsPDF...');
				const jsPDFScript = document.createElement('script');
				jsPDFScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
				document.head.appendChild(jsPDFScript);

				await new Promise((resolve, reject) => {
					jsPDFScript.onload = () => {
						console.log('jsPDF loaded successfully');
						resolve();
					};
					jsPDFScript.onerror = (error) => {
						console.error('jsPDF failed to load:', error);
						reject(new Error('Failed to load jsPDF library'));
					};
				});
			}

			console.log('All export libraries ready');
		} catch (error) {
			console.error('Failed to load export libraries:', error);
			throw error;
		}
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
		currentPolygon = {
			points: [],
			leafletPolygon: null,
			area: 0,
			effectiveArea: 0,
			elevationAngle: 30,
			panels: []
		};
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

		// Show elevation dialog
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
		// cos(angle) gives the horizontal projection factor
		const angleInRadians = (currentElevationAngle * Math.PI) / 180;
		currentPolygon.effectiveArea = area * Math.cos(angleInRadians);

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

		// Add popup with elevation info
		const panelCount = Math.floor(currentPolygon.effectiveArea / panelWithSpacing);
		currentPolygon.leafletPolygon.bindPopup(`
			<div style="font-size: 12px; font-family: inherit;">
				<strong>Roof Area:</strong> ${area.toFixed(2)} m²<br>
				<strong>Effective Area:</strong> ${currentPolygon.effectiveArea.toFixed(2)} m²<br>
				<strong>Elevation Angle:</strong> ${currentElevationAngle}°<br>
				<strong>Estimated Panels:</strong> ${panelCount}<br>
				<button onclick="removePolygon(${roofPolygons.length})" style="margin-top: 4px; padding: 2px 8px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Remove</button>
			</div>
		`);

		// Generate and draw panels
		generatePanels(currentPolygon);

		// Add to roof polygons array
		roofPolygons.push({ ...currentPolygon });

		// Reset state
		isDrawing = false;
		currentPolygon = null;
		showElevationDialog = false;
		currentElevationAngle = 30;
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

	async function exportMapImage() {
		if (!map || !window.html2canvas) return;

		isExporting = true;
		try {
			const mapContainer = document.getElementById('map');
			const canvas = await window.html2canvas(mapContainer, {
				useCORS: true,
				allowTaint: true,
				height: mapContainer.offsetHeight,
				width: mapContainer.offsetWidth,
				backgroundColor: '#ffffff'
			});

			// Create download link
			const link = document.createElement('a');
			link.download = 'solar-panel-plan.png';
			link.href = canvas.toDataURL();
			link.click();
		} catch (error) {
			console.error('Export failed:', error);
		} finally {
			isExporting = false;
		}
	}

	async function exportPDF() {
		if (!map) {
			console.error('Map not initialized');
			return;
		}

		// Check if jsPDF is available
		if (!window.jsPDF) {
			console.error('jsPDF not loaded');
			alert('PDF library not loaded. Please refresh the page and try again.');
			return;
		}

		isExporting = true;

		try {
			console.log('Starting PDF export...');

			// Hide sidebar during capture
			const sidebar = document.querySelector('aside');
			const originalSidebarDisplay = sidebar?.style.display;
			if (sidebar) sidebar.style.display = 'none';

			// Capture the map using imported html2canvas directly
			const mapContainer = document.getElementById('map');
			console.log('Capturing map screenshot...');

			const canvas = await html2canvas(mapContainer, {
				useCORS: true,
				allowTaint: true,
				scale: 2,
				height: mapContainer.offsetHeight,
				width: mapContainer.offsetWidth,
				backgroundColor: '#ffffff',
				logging: false, // Set to true for debugging
				imageTimeout: 15000,
				removeContainer: false
			});

			console.log('Screenshot captured, creating PDF...');

			// Restore sidebar
			if (sidebar) sidebar.style.display = originalSidebarDisplay || '';

			const imgData = canvas.toDataURL('image/png', 0.95);

			// Create PDF
			const { jsPDF } = window.jsPDF;
			const pdf = new jsPDF({
				orientation: 'landscape',
				unit: 'mm',
				format: 'a4'
			});

			// PDF dimensions (A4 landscape: 297 x 210 mm)
			const pageWidth = pdf.internal.pageSize.getWidth();
			const pageHeight = pdf.internal.pageSize.getHeight();
			const margin = 15;

			// Add title
			pdf.setFontSize(24);
			pdf.setFont('helvetica', 'bold');
			pdf.text('Solar Panel Installation Plan', margin, 25);

			// Add date
			pdf.setFontSize(10);
			pdf.setFont('helvetica', 'normal');
			const currentDate = new Date().toLocaleDateString();
			pdf.text(`Generated on: ${currentDate}`, pageWidth - margin - 50, 15);

			// Calculate image dimensions
			const availableWidth = pageWidth - 2 * margin;
			const availableHeight = 120;

			const imgAspectRatio = canvas.width / canvas.height;
			let imgWidth = availableWidth;
			let imgHeight = imgWidth / imgAspectRatio;

			if (imgHeight > availableHeight) {
				imgHeight = availableHeight;
				imgWidth = imgHeight * imgAspectRatio;
			}

			const imgX = (pageWidth - imgWidth) / 2;
			const imgY = 35;

			// Add map image
			pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth, imgHeight, '', 'FAST');

			// Add summary data
			const summaryStartY = imgY + imgHeight + 15;

			pdf.setFontSize(16);
			pdf.setFont('helvetica', 'bold');
			pdf.text('Installation Summary', margin, summaryStartY);

			pdf.setFontSize(11);
			pdf.setFont('helvetica', 'normal');

			const leftColumnX = margin;
			const rightColumnX = pageWidth / 2 + 10;
			let currentY = summaryStartY + 10;

			// Summary data
			const leftColumnData = [
				`Total Roof Area: ${roofPolygons.reduce((sum, p) => sum + p.area, 0).toFixed(2)} m²`,
				`Effective Area: ${totalRoofArea.toFixed(2)} m²`,
				`Estimated Panels: ${estimatedPanels}`,
				`Panel Coverage: ${coveragePercentage.toFixed(1)}%`,
				`Total Panel Area: ${totalPanelArea.toFixed(2)} m²`
			];

			const rightColumnData = [
				`Panel Dimensions: ${panelWidth}m × ${panelHeight}m`,
				`Panel Spacing: ${panelSpacing}m`,
				`Cost per Panel: €${costPerPanel.toLocaleString()}`,
				`Total Estimated Cost: €${totalCost.toLocaleString()}`,
				`Number of Roof Areas: ${roofPolygons.length}`
			];

			// Add columns
			leftColumnData.forEach((line, index) => {
				pdf.text(line, leftColumnX, currentY + index * 6);
			});

			rightColumnData.forEach((line, index) => {
				pdf.text(line, rightColumnX, currentY + index * 6);
			});

			// Add individual roof details
			if (roofPolygons.length > 0) {
				const roofDetailsY = currentY + 40;

				pdf.setFontSize(14);
				pdf.setFont('helvetica', 'bold');
				pdf.text('Individual Roof Areas', margin, roofDetailsY);

				pdf.setFontSize(10);
				pdf.setFont('helvetica', 'normal');

				let detailY = roofDetailsY + 8;

				roofPolygons.forEach((polygon, index) => {
					const panelCount = Math.floor(polygon.effectiveArea / panelWithSpacing);
					const roofCost = panelCount * costPerPanel;

					pdf.text(`Roof ${index + 1}:`, margin, detailY);
					pdf.text(
						`${polygon.area.toFixed(2)} m² (${polygon.elevationAngle}°)`,
						margin + 25,
						detailY
					);
					pdf.text(`Effective: ${polygon.effectiveArea.toFixed(2)} m²`, margin + 75, detailY);
					pdf.text(`Panels: ${panelCount}`, margin + 130, detailY);
					pdf.text(`€${roofCost.toLocaleString()}`, margin + 165, detailY);

					detailY += 6;
				});
			}

			// Add footer
			pdf.setFontSize(8);
			pdf.setFont('helvetica', 'italic');
			pdf.text('Generated by Solar Panel Planner', margin, pageHeight - 10);

			// Generate filename
			const timestamp = new Date().toISOString().slice(0, 10);
			const filename = `solar-panel-plan-${timestamp}.pdf`;

			console.log('Saving PDF...');
			pdf.save(filename);

			console.log('PDF export completed successfully');
		} catch (error) {
			console.error('PDF export failed:', error);
			alert(`PDF export failed: ${error.message}`);
		} finally {
			isExporting = false;
		}
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
				<div class="mb-2 flex gap-2">
					<button class="btn btn-info btn-sm" onclick={exportMapImage} disabled={isExporting}>
						{#if isExporting}
							<span class="loading loading-spinner loading-xs"></span>
						{:else}
							<IconCamera class="h-4 w-4" />
						{/if}
						Export Image
					</button>
					<button class="btn btn-success btn-sm" onclick={exportPDF} disabled={isExporting}>
						{#if isExporting}
							<span class="loading loading-spinner loading-xs"></span>
						{:else}
							<IconDocumentArrowDown class="h-4 w-4" />
						{/if}
						Export PDF
					</button>
				</div>
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
</style>
