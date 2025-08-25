<script lang="ts">
	import { onMount } from 'svelte';

	import type { Roof, SolarAnalysis, SearchResult } from '$lib/types';

	interface Props {
		currentRoof: Roof | null;
		isDrawingRoof: boolean;
		solarAnalysis: SolarAnalysis | null;
		onRoofDrawn: (latlngs: L.LatLng[]) => void;
		onRoofEdited: (latlngs: L.LatLng[]) => void;
		onRoofDeleted: () => void;
		onAddressSelect: (result: SearchResult) => void;
	}

	let {
		currentRoof,
		isDrawingRoof,
		solarAnalysis,
		onRoofDrawn,
		onRoofEdited,
		onRoofDeleted
	}: Props = $props();

	let mapComponent: any;
	let map: L.Map;
	let drawnItems: L.FeatureGroup;
	let drawControl: L.Control.Draw;

	onMount(() => {
		if (mapComponent) {
			map = mapComponent.getMap();
			setupDrawControls();
		}
	});

	function setupDrawControls() {
		// Import Leaflet.draw
		import('leaflet-draw').then(() => {
			drawnItems = new L.FeatureGroup();
			map.addLayer(drawnItems);

			drawControl = new L.Control.Draw({
				edit: {
					featureGroup: drawnItems,
					remove: true
				},
				draw: {
					rectangle: false,
					circle: false,
					circlemarker: false,
					marker: false,
					polyline: false,
					polygon: {
						allowIntersection: false,
						drawError: {
							color: '#e1e100',
							message: '<strong>Error:</strong> Polygon edges cannot cross!'
						},
						shapeOptions: {
							color: '#ff7800',
							weight: 3,
							fillColor: '#ffaa00',
							fillOpacity: 0.6
						}
					}
				}
			});

			map.addControl(drawControl);

			// Event handlers
			map.on(L.Draw.Event.CREATED, handleDrawCreated);
			map.on(L.Draw.Event.EDITED, handleDrawEdited);
			map.on(L.Draw.Event.DELETED, handleDrawDeleted);

			// Restore current roof if exists
			if (currentRoof) {
				restoreCurrentRoof();
			}
		});
	}

	function handleDrawCreated(e: any) {
		const layer = e.layer;
		drawnItems.clearLayers(); // Only one roof at a time
		drawnItems.addLayer(layer);

		const latlngs = layer.getLatLngs()[0];
		onRoofDrawn(latlngs);
		updatePopup(layer);
	}

	function handleDrawEdited(e: any) {
		e.layers.eachLayer((layer: any) => {
			const latlngs = layer.getLatLngs()[0];
			onRoofEdited(latlngs);
			updatePopup(layer);
		});
	}

	function handleDrawDeleted() {
		onRoofDeleted();
	}

	function restoreCurrentRoof() {
		if (currentRoof && currentRoof.latlngs) {
			const polygon = L.polygon(currentRoof.latlngs, {
				color: '#ff7800',
				weight: 3,
				fillColor: '#ffaa00',
				fillOpacity: 0.6
			});

			drawnItems.addLayer(polygon);
			updatePopup(polygon);
		}
	}

	function updatePopup(layer: any) {
		if (!solarAnalysis) return;

		const popup = `
			<div class="text-sm p-2">
				<div class="font-bold text-primary mb-2">☀️ Solar Roof Analysis</div>
				<div><strong>Roof Area:</strong> ${solarAnalysis.roofArea.toFixed(1)} m²</div>
				<div><strong>Available Area:</strong> ${solarAnalysis.availableArea.toFixed(1)} m²</div>
				<div><strong>Panel Count:</strong> ${solarAnalysis.panelCount}</div>
				<div><strong>Panel Area:</strong> ${solarAnalysis.totalPanelArea.toFixed(1)} m²</div>
				<div><strong>Est. Power:</strong> ${solarAnalysis.estimatedPowerOutput.toFixed(1)} kW</div>
			</div>
		`;
		layer.bindPopup(popup);
	}

	// Reactive updates
	$effect(() => {
		if (drawnItems && currentRoof) {
			drawnItems.eachLayer((layer: any) => {
				updatePopup(layer);
			});
		}
	});

	$effect(() => {
		if (drawnItems && !currentRoof) {
			drawnItems.clearLayers();
		}
	});
</script>

<div class="h-full w-full">
	<Map
		bind:this={mapComponent}
		options={{
			center: [48.7758, 9.1829],
			zoom: 13
		}}
	>
		<TileLayer
			url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
			options={{
				attribution: '© OpenStreetMap contributors'
			}}
		/>
	</Map>
</div>
