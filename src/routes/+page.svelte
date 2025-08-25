<script lang="ts">
	import type { Roof } from '$lib/types/Roof';
	import type { PanelConfig } from '$lib/types/PanelConfig';
	import type { SearchResult } from '$lib/types/SearchResult';

	// Components
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MapContainer from '$lib/components/MapContainer.svelte';
	import DrawingModeOverlay from '$lib/components/DrawingModeOverlay.svelte';

	// Utilities
	import { createPersistentState } from '$lib/utils/storeutils';
	import { calculatePolygonArea, calculateSolarPotential } from '$lib/utils/calculations';

	// --- Initial State Definitions ---
	const [initialPanelConfig, savePanelConfig] = createPersistentState<PanelConfig>('panelConfig', {
		width: 2.0,
		height: 1.0,
		spacing: 0.1,
		roofCoverage: 0.8
	});

	const [initialCurrentRoof, saveCurrentRoof] = createPersistentState<Roof | null>(
		'currentRoof',
		null
	);

	// --- Reactive State ($state, $derived) ---
	let panelConfig = $state<PanelConfig>(initialPanelConfig);
	let currentRoof = $state<Roof | null>(initialCurrentRoof);
	let searchQuery = $state('');
	let searchResults = $state<SearchResult[]>([]);
	let isSearching = $state(false);
	let isDrawingRoof = $state(false);

	// Derived calculations
	const solarAnalysis = $derived(() => {
		if (!currentRoof) return null;
		return calculateSolarPotential(currentRoof.area, panelConfig);
	});

	// --- Side Effects ($effect) ---
	$effect(() => {
		savePanelConfig(panelConfig);
	});

	$effect(() => {
		saveCurrentRoof(currentRoof);
	});

	// --- Functions ---

	// Address Search
	async function searchAddress(): Promise<void> {
		if (!searchQuery.trim()) return;

		isSearching = true;
		searchResults = [];

		try {
			const response = await fetch(
				`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`
			);
			const results = await response.json();
			searchResults = results.map((result: any) => ({
				display_name: result.display_name,
				lat: parseFloat(result.lat),
				lon: parseFloat(result.lon),
				importance: result.importance
			}));
		} catch (error) {
			console.error('Search error:', error);
		} finally {
			isSearching = false;
		}
	}

	function handleAddressSelect(result: SearchResult): void {
		searchResults = [];
		searchQuery = result.display_name.split(',')[0];
	}

	// Roof Management
	function handleStartDrawing(): void {
		if (currentRoof) {
			if (!confirm('This will replace your current roof. Continue?')) {
				return;
			}
			clearCurrentRoof();
		}
		isDrawingRoof = true;
	}

	function handleRoofDrawn(latlngs: L.LatLng[]): void {
		const area = calculatePolygonArea(latlngs);
		currentRoof = {
			id: Date.now(),
			latlngs: latlngs,
			area: area
		};
		isDrawingRoof = false;
	}

	function handleRoofEdited(latlngs: L.LatLng[]): void {
		if (currentRoof) {
			const area = calculatePolygonArea(latlngs);
			currentRoof = {
				...currentRoof,
				latlngs: latlngs,
				area: area
			};
		}
	}

	function clearCurrentRoof(): void {
		currentRoof = null;
		isDrawingRoof = false;
	}

	function handleCancelDrawing(): void {
		isDrawingRoof = false;
	}

	// Panel Configuration
	function updatePanelConfig(updates: Partial<PanelConfig>): void {
		panelConfig = { ...panelConfig, ...updates };
	}

	// Data Management
	function clearAllData(): void {
		if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
			clearCurrentRoof();
			try {
				localStorage.removeItem('panelConfig');
				localStorage.removeItem('currentRoof');
			} catch (error) {
				console.warn('Could not clear localStorage:', error);
			}
		}
	}
</script>

<svelte:head>
	<title>Solar Panel Roof Planner</title>
</svelte:head>

<div class="bg-base-100 min-h-screen">
	<!-- Header -->
	<div class="navbar bg-primary text-primary-content shadow-lg">
		<div class="flex-1">
			<h1 class="btn btn-ghost text-xl normal-case">☀️ Solar Panel Roof Planner</h1>
		</div>
		<div class="flex-none">
			<button class="btn btn-ghost btn-circle" onclick={clearAllData} title="Clear All Data">
				🗑️
			</button>
		</div>
	</div>

	<div class="flex h-[calc(100vh-4rem)] flex-col lg:flex-row">
		<!-- Sidebar -->
		<Sidebar
			{searchQuery}
			{searchResults}
			{isSearching}
			{currentRoof}
			{panelConfig}
			{solarAnalysis}
			{isDrawingRoof}
			onSearchQueryUpdate={(query) => (searchQuery = query)}
			onSearchAddress={searchAddress}
			onAddressSelect={handleAddressSelect}
			onStartDrawing={handleStartDrawing}
			onClearRoof={clearCurrentRoof}
			onPanelConfigUpdate={updatePanelConfig}
		/>

		<!-- Map Container -->
		<div class="relative flex-1">
			<MapContainer
				{currentRoof}
				{isDrawingRoof}
				{solarAnalysis}
				onRoofDrawn={handleRoofDrawn}
				onRoofEdited={handleRoofEdited}
				onRoofDeleted={clearCurrentRoof}
				onAddressSelect={handleAddressSelect}
			/>

			{#if isDrawingRoof}
				<DrawingModeOverlay onCancel={handleCancelDrawing} />
			{/if}
		</div>
	</div>
</div>
