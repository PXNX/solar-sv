<script lang="ts">
	import FluentMoney24Regular from '~icons/fluent/money-24-regular';
	import FluentChevronDown24Regular from '~icons/fluent/chevron-down-24-regular';
	import FluentPerson24Regular from '~icons/fluent/person-24-regular';
	import { Button } from '$lib/components/ui';
	import { HOUSEHOLD_PRESETS, type Economics, type EconomicsResult } from '$lib/solar/economics';
	import { formatEuro, formatNumber } from '$lib/utils/format';
	import { m } from '$lib/paraglide/messages';

	interface Props {
		economics: Economics;
		result: EconomicsResult;
		/** True when at least one roof uses the offline estimate instead of PVGIS. */
		estimated: boolean;
	}

	let { economics = $bindable(), result, estimated }: Props = $props();

	const fields = [
		{ key: 'consumption', label: m.field_consumption, min: 0, max: 100000, step: 100 },
		{ key: 'electricityPrice', label: m.field_electricity_price, min: 0, max: 2, step: 0.01 },
		{ key: 'feedInTariff', label: m.field_feed_in, min: 0, max: 1, step: 0.001 },
		{ key: 'otherCostsPerKwp', label: m.field_other_costs, min: 0, max: 5000, step: 50 }
	] as const;

	const payback = $derived(
		Number.isFinite(result.payback)
			? m.years({ years: formatNumber(result.payback, 1) })
			: m.never()
	);

	const tiles = $derived([
		{
			id: 'production',
			label: m.result_production(),
			value: m.kwh_per_year({ value: formatNumber(result.production) }),
			tone: 'bg-amber-500/12 text-amber-300'
		},
		{
			id: 'autarky',
			label: m.result_autarky(),
			value: `${formatNumber(result.autarky * 100)} %`,
			tone: 'bg-emerald-500/12 text-emerald-300'
		},
		{
			id: 'self-consumption',
			label: m.result_self_consumption(),
			value: `${formatNumber(result.selfConsumption * 100)} %`,
			tone: 'bg-sky-500/12 text-sky-300'
		},
		{
			id: 'benefit',
			label: m.result_benefit(),
			value: formatEuro(result.annualBenefit, false),
			tone: 'bg-lime-500/12 text-lime-300'
		},
		{
			id: 'investment',
			label: m.result_investment(),
			value: formatEuro(result.investment, false),
			tone: 'bg-rose-500/12 text-rose-300'
		},
		{
			id: 'payback',
			label: m.result_payback(),
			value: payback,
			tone: 'bg-violet-500/15 text-violet-300'
		}
	]);
</script>

<details class="panel-muted group p-3">
	<summary class="flex cursor-pointer list-none items-center gap-2.5 select-none">
		<FluentMoney24Regular class="text-primary size-4" />
		<span class="flex-1">
			<span class="editorial-title text-base-content block text-base">{m.economics_title()}</span>
			<span class="text-base-content/55 block text-xs tabular-nums">
				{m.economics_summary({ kwh: formatNumber(result.production), years: payback })}
			</span>
		</span>
		<FluentChevronDown24Regular
			class="text-base-content/50 size-4 transition-transform group-open:rotate-180"
		/>
	</summary>

	<div class="mt-3">
		<span class="field-label">{m.household()}</span>
		<div class="flex gap-1">
			{#each HOUSEHOLD_PRESETS as kwh, i (kwh)}
				<Button
					size="xs"
					grow
					variant={economics.consumption === kwh ? 'soft-amber' : 'subtle'}
					title={m.household_option({ n: i + 1, kwh: formatNumber(kwh) })}
					aria-label={m.household_option({ n: i + 1, kwh: formatNumber(kwh) })}
					onclick={() => (economics.consumption = kwh)}
				>
					{i + 1}<FluentPerson24Regular class="-ml-1 size-3.5" />
				</Button>
			{/each}
		</div>
		<p class="field-hint">{m.household_hint()}</p>
	</div>

	<div class="mt-3 grid grid-cols-2 gap-x-2 gap-y-3">
		{#each fields as field (field.key)}
			<label class="block">
				<span class="field-label">{field.label()}</span>
				<input
					type="number"
					class="field-control w-full rounded-full px-3 py-1.5 text-sm tabular-nums"
					min={field.min}
					max={field.max}
					step={field.step}
					bind:value={economics[field.key]}
				/>
			</label>
		{/each}
	</div>
	<p class="field-hint">{m.other_costs_hint()}</p>

	<label class="mt-3 flex cursor-pointer items-center justify-between gap-2">
		<span class="field-label mb-0!">{m.battery()}</span>
		<input
			type="checkbox"
			class="toggle toggle-sm toggle-primary"
			bind:checked={economics.battery.enabled}
		/>
	</label>
	{#if economics.battery.enabled}
		<div class="fade_in mt-2 grid grid-cols-2 gap-2">
			<label class="block">
				<span class="field-label">{m.field_battery_capacity()}</span>
				<input
					type="number"
					class="field-control w-full rounded-full px-3 py-1.5 text-sm tabular-nums"
					min="0"
					max="200"
					step="0.5"
					bind:value={economics.battery.capacity}
				/>
			</label>
			<label class="block">
				<span class="field-label">{m.field_battery_price()}</span>
				<input
					type="number"
					class="field-control w-full rounded-full px-3 py-1.5 text-sm tabular-nums"
					min="0"
					max="100000"
					step="100"
					bind:value={economics.battery.price}
				/>
			</label>
		</div>
	{/if}

	<div class="mt-4 grid grid-cols-2 gap-1.5 text-center">
		{#each tiles as tile (tile.label)}
			<div class="rounded-xl px-2 py-1.5 {tile.tone}" data-testid="economics-{tile.id}">
				<div class="text-sm font-semibold tabular-nums">{tile.value}</div>
				<div class="text-base-content/55 text-[0.65rem] tracking-wide uppercase">{tile.label}</div>
			</div>
		{/each}
		<div
			class="col-span-2 rounded-xl bg-linear-to-r from-amber-500/25 via-emerald-500/20 to-sky-500/25 px-2 py-2"
			data-testid="economics-lifetime"
		>
			<div
				class="editorial-title text-xl tabular-nums {result.lifetimeValue >= 0
					? 'text-emerald-300'
					: 'text-rose-300'}"
			>
				{formatEuro(result.lifetimeValue, false)}
			</div>
			<div class="text-base-content/60 text-[0.65rem] tracking-wide uppercase">
				{m.result_lifetime_value({ years: result.lifetimeYears })}
			</div>
		</div>
	</div>
	<p class="field-hint">
		{estimated ? m.yield_source_estimate() : m.yield_source_pvgis()} · {m.economics_hint()}
	</p>
</details>
