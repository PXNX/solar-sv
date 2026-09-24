<script lang="ts" module>
	export interface ResolvedAddress {
		address: string;
		location: [number, number];
	}
</script>

<script lang="ts">
	import FluentLocation24Regular from '~icons/fluent/location-24-regular';
	import { getLocale } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages';

	interface NominatimResult {
		display_name: string;
		lat: string;
		lon: string;
		address?: Record<string, string>;
	}

	interface Props {
		value: string;
		onresolve: (result: ResolvedAddress) => void;
		placeholder?: string;
		autofocus?: boolean;
	}

	let { value = $bindable(), onresolve, placeholder, autofocus = false }: Props = $props();

	let results = $state<NominatimResult[]>([]);
	let open = $state(false);
	let loading = $state(false);
	let notFound = $state(false);
	let timer: ReturnType<typeof setTimeout>;

	/** "Königstraße 1, 70173 Stuttgart" instead of Nominatim's full administrative chain. */
	function formatAddress(result: NominatimResult): string {
		const a = result.address;
		if (!a) return result.display_name;
		const street = [a.road ?? a.pedestrian ?? a.hamlet, a.house_number].filter(Boolean).join(' ');
		const town = [a.postcode, a.city ?? a.town ?? a.village ?? a.municipality]
			.filter(Boolean)
			.join(' ');
		return [street, town].filter(Boolean).join(', ') || result.display_name;
	}

	async function search(query: string): Promise<NominatimResult[]> {
		if (!query.trim()) return [];
		loading = true;
		try {
			const params = new URLSearchParams({
				format: 'jsonv2',
				addressdetails: '1',
				limit: '5',
				'accept-language': getLocale(),
				q: query
			});
			const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
			return response.ok ? await response.json() : [];
		} catch (error) {
			console.error('Address lookup failed:', error);
			return [];
		} finally {
			loading = false;
		}
	}

	function handleInput() {
		notFound = false;
		clearTimeout(timer);
		timer = setTimeout(async () => {
			results = await search(value);
			open = results.length > 0;
		}, 350);
	}

	function choose(result: NominatimResult) {
		value = formatAddress(result);
		open = false;
		onresolve({ address: value, location: [parseFloat(result.lat), parseFloat(result.lon)] });
	}

	async function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
		if (e.key !== 'Enter') return;
		e.preventDefault();
		clearTimeout(timer);
		const found = results.length > 0 && open ? results : await search(value);
		if (found.length > 0) choose(found[0]);
		else notFound = true;
	}
</script>

<div class="relative">
	<FluentLocation24Regular
		class="text-base-content/50 pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
	/>
	<!-- svelte-ignore a11y_autofocus -->
	<input
		type="text"
		{placeholder}
		{autofocus}
		autocomplete="street-address"
		class="field-control w-full rounded-full py-2 pr-10 pl-10 text-sm"
		bind:value
		oninput={handleInput}
		onkeydown={handleKeydown}
		onfocus={() => (open = results.length > 0)}
		onblur={() => setTimeout(() => (open = false), 150)}
	/>
	{#if loading}
		<span
			class="loading loading-xs loading-spinner text-primary absolute top-1/2 right-3.5 -translate-y-1/2"
		></span>
	{/if}

	{#if open}
		<div
			class="panel fade_in bg-base-100! absolute top-full z-50 mt-2 max-h-56 w-full overflow-y-auto p-1"
		>
			{#each results as result (result.lat + result.lon)}
				<button
					type="button"
					class="flinch text-base-content/80 hover:bg-primary/10 hover:text-base-content w-full rounded-xl px-3 py-2 text-left text-xs"
					onclick={() => choose(result)}
				>
					<span class="text-base-content block font-medium">{formatAddress(result)}</span>
					<span class="text-base-content/55 block truncate">{result.display_name}</span>
				</button>
			{/each}
		</div>
	{/if}
	{#if notFound}
		<p class="field-hint text-red-300!">{m.address_not_found()}</p>
	{/if}
</div>
