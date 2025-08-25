<script lang="ts">
	import type { Roof, PanelConfig, SearchResult, SolarAnalysis } from '$lib/types';

	import AddressSearch from './AddressSearch.svelte';
	import PanelSettings from './PanelSettings.svelte';
	import SolarResults from './SolarResults.svelte';
	import Instructions from './Instructions.svelte';
	import RoofSection from './RoofSection.svelte';

	interface Props {
		searchQuery: string;
		searchResults: SearchResult[];
		isSearching: boolean;
		currentRoof: Roof | null;
		panelConfig: PanelConfig;
		solarAnalysis: SolarAnalysis | null;
		isDrawingRoof: boolean;
		onSearchQueryUpdate: (query: string) => void;
		onSearchAddress: () => Promise<void>;
		onAddressSelect: (result: SearchResult) => void;
		onStartDrawing: () => void;
		onClearRoof: () => void;
		onPanelConfigUpdate: (updates: Partial<PanelConfig>) => void;
	}

	let {
		searchQuery,
		searchResults,
		isSearching,
		currentRoof,
		panelConfig,
		solarAnalysis,
		isDrawingRoof,
		onSearchQueryUpdate,
		onSearchAddress,
		onAddressSelect,
		onStartDrawing,
		onClearRoof,
		onPanelConfigUpdate
	}: Props = $props();
</script>

<div class="bg-base-200 w-full space-y-4 overflow-y-auto p-4 lg:w-80">
	<AddressSearch
		{searchQuery}
		{searchResults}
		{isSearching}
		{onSearchQueryUpdate}
		{onSearchAddress}
		{onAddressSelect}
	/>

	<RoofSection {currentRoof} {isDrawingRoof} {onStartDrawing} {onClearRoof} />

	<PanelSettings {panelConfig} {onPanelConfigUpdate} />

	<SolarResults {currentRoof} {solarAnalysis} />

	<Instructions />
</div>
