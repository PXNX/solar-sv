<script lang="ts">
	import type { SearchResult } from '$lib/types';

	interface Props {
		searchQuery: string;
		searchResults: SearchResult[];
		isSearching: boolean;
		onSearchQueryUpdate: (query: string) => void;
		onSearchAddress: () => Promise<void>;
		onAddressSelect: (result: SearchResult) => void;
	}

	let {
		searchQuery,
		searchResults,
		isSearching,
		onSearchQueryUpdate,
		onSearchAddress,
		onAddressSelect
	}: Props = $props();

	function handleInputChange(event: Event) {
		const target = event.target as HTMLInputElement;
		onSearchQueryUpdate(target.value);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			onSearchAddress();
		}
	}

	function handleResultClick(result: SearchResult) {
		onAddressSelect(result);
	}
</script>

<div class="card bg-base-100 shadow-sm">
	<div class="card-body p-4">
		<h2 class="card-title mb-3 text-lg">🔍 Address Search</h2>

		<div class="form-control">
			<div class="input-group">
				<input
					type="text"
					placeholder="Enter address or location..."
					class="input input-bordered flex-1"
					value={searchQuery}
					oninput={handleInputChange}
					onkeydown={handleKeyDown}
					disabled={isSearching}
				/>
				<button
					class="btn btn-primary"
					onclick={onSearchAddress}
					disabled={isSearching || !searchQuery.trim()}
				>
					{#if isSearching}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						Search
					{/if}
				</button>
			</div>
		</div>

		{#if searchResults.length > 0}
			<div class="mt-3">
				<div class="text-base-content/70 mb-2 text-sm font-medium">Search Results:</div>
				<div class="max-h-48 space-y-1 overflow-y-auto">
					{#each searchResults as result}
						<button
							class="btn btn-ghost btn-sm h-auto min-h-0 w-full justify-start px-3 py-2 text-left normal-case"
							onclick={() => handleResultClick(result)}
						>
							<div class="flex flex-col items-start">
								<div class="w-full truncate text-sm font-medium">
									{result.display_name.split(',')[0]}
								</div>
								<div class="text-base-content/50 w-full truncate text-xs">
									{result.display_name.split(',').slice(1).join(',').trim()}
								</div>
							</div>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		{#if isSearching}
			<div class="mt-3">
				<div class="text-base-content/70 text-sm">Searching for locations...</div>
			</div>
		{/if}
	</div>
</div>
