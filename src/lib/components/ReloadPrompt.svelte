<script lang="ts">
	import { useRegisterSW } from 'virtual:pwa-register/svelte';
	import FluentArrowSync24Regular from '~icons/fluent/arrow-sync-24-regular';
	import FluentCloudCheckmark24Regular from '~icons/fluent/cloud-checkmark-24-regular';
	import { Button } from '$lib/components/ui';
	import { m } from '$lib/paraglide/messages';

	const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
		onRegisteredSW(_url, registration) {
			// Pick up new deployments of a long-running installed app.
			if (registration) setInterval(() => registration.update(), 60 * 60 * 1000);
		}
	});

	$effect(() => {
		if (!$offlineReady) return;
		const timer = setTimeout(() => offlineReady.set(false), 4000);
		return () => clearTimeout(timer);
	});
</script>

{#if $needRefresh || $offlineReady}
	<div
		class="panel fade_in fixed right-3 bottom-3 z-[3000] flex max-w-sm items-center gap-3 py-2 pr-2 pl-4 backdrop-blur-md"
		role="status"
	>
		{#if $needRefresh}
			<FluentArrowSync24Regular class="text-primary size-5 shrink-0" />
			<span class="text-base-content/85 text-sm">{m.pwa_update()}</span>
			<Button size="sm" variant="subtle" onclick={() => needRefresh.set(false)}>
				{m.pwa_later()}
			</Button>
			<Button size="sm" onclick={() => updateServiceWorker(true)}>{m.pwa_reload()}</Button>
		{:else}
			<FluentCloudCheckmark24Regular class="text-success size-5 shrink-0" />
			<span class="text-base-content/85 pr-2 text-sm">{m.pwa_offline_ready()}</span>
		{/if}
	</div>
{/if}
