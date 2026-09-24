<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import FluentArrowLeft24Regular from '~icons/fluent/arrow-left-24-regular';
	import FluentSearch24Regular from '~icons/fluent/search-24-regular';
	import FluentFolderOpen24Regular from '~icons/fluent/folder-open-24-regular';
	import FluentDelete24Regular from '~icons/fluent/delete-24-regular';
	import FluentHistory24Regular from '~icons/fluent/history-24-regular';
	import FluentLocation24Regular from '~icons/fluent/location-24-regular';
	import { Badge, Button, IconButton } from '$lib/components/ui';
	import { archive, persistedHistory, persistedProject, type Project } from '$lib/projects';
	import { DEFAULT_SETTINGS, layoutRoof, type PanelSettings } from '$lib/solar/layout';
	import { createPersistentState } from '$lib/utils/storeutils';
	import { formatDate, formatEuro, formatNumber } from '$lib/utils/format';
	import { m } from '$lib/paraglide/messages';

	const [storedHistory, saveHistory] = persistedHistory();
	let history = $state(storedHistory);
	let query = $state('');

	const [currentSettings, saveSettings] = createPersistentState<PanelSettings>(
		'solar-settings',
		DEFAULT_SETTINGS,
		JSON.stringify,
		(value) => ({ ...DEFAULT_SETTINGS, ...JSON.parse(value) })
	);

	function summary(project: Project) {
		const settings = project.settings ?? DEFAULT_SETTINGS;
		const panels = project.roofs.reduce(
			(sum, roof) => sum + layoutRoof(roof, settings).panels.length,
			0
		);
		return { panels, kwp: (panels * settings.watts) / 1000, cost: panels * settings.cost };
	}

	const filtered = $derived(
		history.filter((p) =>
			`${p.customer.name} ${p.customer.address}`.toLowerCase().includes(query.trim().toLowerCase())
		)
	);

	function open(project: Project) {
		// The customer currently in the planner is archived, not overwritten.
		const [current, saveProject] = persistedProject();
		const rest = history.filter((p) => p.id !== project.id);
		saveHistory(archive($state.snapshot(rest), current, currentSettings));
		if (project.settings) saveSettings(project.settings);
		saveProject({ ...$state.snapshot(project), updatedAt: Date.now() });
		localStorage.removeItem('solar-view');
		goto(resolve('/'));
	}

	function remove(project: Project) {
		if (!confirm(m.delete_confirm())) return;
		history = history.filter((p) => p.id !== project.id);
		saveHistory($state.snapshot(history));
	}
</script>

<svelte:head>
	<title>{m.history_title()} · {m.app_name()}</title>
</svelte:head>

<div class="ledger-grid min-h-svh">
	<header class="border-base-content/15 bg-neutral/95 sticky top-0 z-20 border-b backdrop-blur-md">
		<div class="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
			<Button
				href={resolve('/')}
				shape="circle"
				variant="subtle"
				size="sm"
				icon={FluentArrowLeft24Regular}
				aria-label={m.back_to_planner()}
				title={m.back_to_planner()}
			/>
			<h1 class="text-base-content flex-1 text-2xl">{m.history_title()}</h1>
			<Badge tone="neutral" size="sm">{history.length}</Badge>
		</div>
	</header>

	<main class="mx-auto max-w-3xl px-4 py-6">
		{#if history.length === 0}
			<div class="panel-muted fade_in mx-auto max-w-md p-12 text-center">
				<FluentHistory24Regular class="text-base-content/25 mx-auto size-10" />
				<h2 class="editorial-title text-base-content mt-4 text-lg">{m.history_empty()}</h2>
				<p class="text-base-content/60 mt-2 text-sm">{m.history_empty_hint()}</p>
			</div>
		{:else}
			<div class="relative mb-4">
				<FluentSearch24Regular
					class="text-base-content/50 pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
				/>
				<input
					type="search"
					placeholder={m.search_customers()}
					class="field-control w-full rounded-full py-2 pr-4 pl-10 text-sm"
					bind:value={query}
				/>
			</div>

			<ul class="space-y-2">
				{#each filtered as project (project.id)}
					{@const stats = summary(project)}
					<li class="panel-interactive fade_in flex flex-wrap items-center gap-4 p-4">
						<div class="min-w-0 flex-1">
							<h2 class="editorial-title text-base-content truncate text-lg">
								{project.customer.name || m.unnamed_customer()}
							</h2>
							{#if project.customer.address}
								<p class="text-base-content/65 flex items-center gap-1 truncate text-sm">
									<FluentLocation24Regular class="size-4 shrink-0" />
									{project.customer.address}
								</p>
							{/if}
							<p class="text-base-content/50 mt-1 text-xs">
								{m.history_updated({ date: formatDate(new Date(project.updatedAt)) })}
							</p>
						</div>
						<div class="flex flex-wrap gap-1">
							<Badge tone="neutral">{m.history_roofs({ count: project.roofs.length })}</Badge>
							<Badge tone="blue">{formatNumber(stats.panels)} {m.stat_modules()}</Badge>
							<Badge tone="amber">{formatNumber(stats.kwp, 1)} kWp</Badge>
							<Badge tone="neutral">{formatEuro(stats.cost)}</Badge>
						</div>
						<div class="flex items-center gap-1">
							<Button size="sm" icon={FluentFolderOpen24Regular} onclick={() => open(project)}>
								{m.open()}
							</Button>
							<IconButton
								icon={FluentDelete24Regular}
								label={m.delete()}
								variant="soft-red"
								size="sm"
								onclick={() => remove(project)}
							/>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</main>
</div>
