<script lang="ts">
	import FluentDelete24Regular from '~icons/fluent/delete-24-regular';
	import FluentArrowUp24Filled from '~icons/fluent/arrow-up-24-filled';
	import { IconButton } from '$lib/components/ui';
	import type { PanelSettings, Roof, RoofLayout } from '$lib/solar/layout';
	import { compassLabel, formatEuro, formatNumber } from '$lib/utils/format';
	import { m } from '$lib/paraglide/messages';

	interface Props {
		roof: Roof;
		/** 1-based number shown on the map and in exports. */
		number: number;
		/** Same colour as the roof outline on the map. */
		color: string;
		layout: RoofLayout;
		settings: PanelSettings;
		selected: boolean;
		onselect: () => void;
		ondelete: () => void;
	}

	let {
		roof = $bindable(),
		number,
		color,
		layout,
		settings,
		selected,
		onselect,
		ondelete
	}: Props = $props();

	const kwp = $derived((layout.panels.length * settings.watts) / 1000);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="roof-card panel-interactive fade_in relative overflow-hidden p-3 pl-4"
	class:roof-card-selected={selected}
	style:--roof-color={color}
	data-testid="roof-card"
	onclick={onselect}
>
	<span class="absolute inset-y-0 left-0 w-1.5" style:background-color={color}></span>

	<div class="mb-3 flex items-center gap-2">
		<span
			class="grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold text-[#0e1d2f]"
			style:background-color={color}
		>
			{number}
		</span>
		<input
			class="editorial-title text-base-content focus:bg-base-300 min-w-0 flex-1 rounded-md bg-transparent px-1 text-base outline-none"
			bind:value={roof.name}
			aria-label={m.roof_name_label()}
		/>
		<span
			class="badge badge-sm gap-1 rounded-full border-0 font-medium"
			data-testid="roof-facing"
			style:background-color="color-mix(in oklab, {color} 22%, transparent)"
			style:color
		>
			<FluentArrowUp24Filled class="size-3" style="transform: rotate({layout.azimuth}deg)" />
			{compassLabel(layout.azimuth)}
			{layout.azimuth.toFixed(0)}°
		</span>
		<IconButton
			icon={FluentDelete24Regular}
			label={m.delete_roof()}
			size="xs"
			class="text-base-content/50 hover:bg-red-600/15 hover:text-red-300"
			onclick={(e) => {
				e.stopPropagation();
				ondelete();
			}}
		/>
	</div>

	<label class="mb-3 block">
		<span class="field-label justify-between">
			<span>{m.pitch()}</span>
			<span class="font-semibold tabular-nums" style:color>{roof.pitch}°</span>
		</span>
		<input
			type="range"
			min="0"
			max="60"
			step="1"
			bind:value={roof.pitch}
			class="range range-xs w-full"
			style:--range-fg={color}
			aria-label={m.pitch()}
		/>
	</label>

	<div class="grid grid-cols-3 gap-1.5 text-center">
		<div class="rounded-xl bg-sky-500/12 px-1 py-1.5">
			<div class="text-sm font-semibold text-sky-300 tabular-nums" data-testid="roof-modules">
				{layout.panels.length}
			</div>
			<div class="text-base-content/55 text-[0.65rem] tracking-wide uppercase">
				{m.stat_modules()}
			</div>
		</div>
		<div class="rounded-xl bg-amber-500/12 px-1 py-1.5">
			<div class="text-sm font-semibold text-amber-300 tabular-nums" data-testid="roof-kwp">
				{formatNumber(kwp, 1)}
			</div>
			<div class="text-base-content/55 text-[0.65rem] tracking-wide uppercase">{m.stat_kwp()}</div>
		</div>
		<div class="rounded-xl bg-emerald-500/12 px-1 py-1.5">
			<div class="text-sm font-semibold text-emerald-300 tabular-nums">
				{formatEuro(layout.panels.length * settings.cost)}
			</div>
			<div class="text-base-content/55 text-[0.65rem] tracking-wide uppercase">{m.stat_cost()}</div>
		</div>
	</div>

	<div class="text-base-content/55 mt-2 flex justify-between text-xs tabular-nums">
		<span data-testid="roof-area">
			{m.area_summary({
				plan: formatNumber(layout.planArea),
				roof: formatNumber(layout.roofArea)
			})}
		</span>
		<span>{m.coverage({ percent: formatNumber(layout.coverage * 100) })}</span>
	</div>
</div>

<style>
	.roof-card-selected {
		border-color: var(--roof-color) !important;
		background-color: color-mix(in oklab, var(--roof-color) 10%, var(--color-base-100)) !important;
		box-shadow:
			0 0 0 1px color-mix(in oklab, var(--roof-color) 40%, transparent),
			0 14px 32px rgba(2, 10, 21, 0.25);
	}
</style>
