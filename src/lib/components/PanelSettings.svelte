<!-- src/lib/components/PanelSettings.svelte -->
<script lang="ts">
	import type { PanelConfig } from '$lib/types';

	interface Props {
		panelConfig: PanelConfig;
		onPanelConfigUpdate: (updates: Partial<PanelConfig>) => void;
	}

	let { panelConfig, onPanelConfigUpdate }: Props = $props();

	function updateWidth(event: Event) {
		const target = event.target as HTMLInputElement;
		const value = parseFloat(target.value);
		if (!isNaN(value) && value > 0) {
			onPanelConfigUpdate({ width: value });
		}
	}

	function updateHeight(event: Event) {
		const target = event.target as HTMLInputElement;
		const value = parseFloat(target.value);
		if (!isNaN(value) && value > 0) {
			onPanelConfigUpdate({ height: value });
		}
	}

	function updateSpacing(event: Event) {
		const target = event.target as HTMLInputElement;
		const value = parseFloat(target.value);
		if (!isNaN(value) && value >= 0) {
			onPanelConfigUpdate({ spacing: value });
		}
	}

	function updateRoofCoverage(event: Event) {
		const target = event.target as HTMLInputElement;
		const value = parseFloat(target.value) / 100;
		if (!isNaN(value) && value >= 0 && value <= 1) {
			onPanelConfigUpdate({ roofCoverage: value });
		}
	}

	// Calculated values
	const panelArea = $derived(panelConfig.width * panelConfig.height);
	const effectiveArea = $derived(
		(panelConfig.width + panelConfig.spacing) * (panelConfig.height + panelConfig.spacing)
	);
</script>

<div class="card bg-base-100 shadow-sm">
	<div class="card-body p-4">
		<h2 class="card-title mb-3 text-lg">⚙️ Panel Configuration</h2>

		<div class="space-y-4">
			<!-- Panel Dimensions -->
			<div class="form-control">
				<label class="label" for="panel-width">
					<span class="label-text font-medium">Panel Width (m)</span>
				</label>
				<input
					id="panel-width"
					type="number"
					class="input input-bordered input-sm"
					value={panelConfig.width}
					min="0.1"
					max="5"
					step="0.1"
					onchange={updateWidth}
				/>
			</div>

			<div class="form-control">
				<label class="label" for="panel-height">
					<span class="label-text font-medium">Panel Height (m)</span>
				</label>
				<input
					id="panel-height"
					type="number"
					class="input input-bordered input-sm"
					value={panelConfig.height}
					min="0.1"
					max="3"
					step="0.1"
					onchange={updateHeight}
				/>
			</div>

			<!-- Spacing -->
			<div class="form-control">
				<label class="label" for="panel-spacing">
					<span class="label-text font-medium">Panel Spacing (m)</span>
				</label>
				<input
					id="panel-spacing"
					type="number"
					class="input input-bordered input-sm"
					value={panelConfig.spacing}
					min="0"
					max="1"
					step="0.05"
					onchange={updateSpacing}
				/>
				<label class="label">
					<span class="label-text-alt text-xs">Gap between panels for maintenance</span>
				</label>
			</div>

			<!-- Roof Coverage -->
			<div class="form-control">
				<label class="label" for="roof-coverage">
					<span class="label-text font-medium">Roof Coverage (%)</span>
				</label>
				<input
					id="roof-coverage"
					type="range"
					class="range range-primary range-sm"
					value={panelConfig.roofCoverage * 100}
					min="10"
					max="100"
					step="5"
					onchange={updateRoofCoverage}
				/>
				<div class="text-base-content/60 flex w-full justify-between px-2 text-xs">
					<span>10%</span>
					<span class="font-medium">{Math.round(panelConfig.roofCoverage * 100)}%</span>
					<span>100%</span>
				</div>
				<label class="label">
					<span class="label-text-alt text-xs">Usable roof area (excludes edges, obstacles)</span>
				</label>
			</div>

			<!-- Panel Stats -->
			<div class="divider my-2"></div>

			<div class="stats stats-vertical w-full shadow">
				<div class="stat py-2">
					<div class="stat-title text-xs">Panel Surface Area</div>
					<div class="stat-value text-sm">{panelArea.toFixed(2)} m²</div>
				</div>
				<div class="stat py-2">
					<div class="stat-title text-xs">Space Required per Panel</div>
					<div class="stat-value text-sm">{effectiveArea.toFixed(2)} m²</div>
					<div class="stat-desc text-xs">Including spacing</div>
				</div>
			</div>

			<!-- Common Presets -->
			<div class="divider my-2"></div>

			<div class="form-control">
				<label class="label">
					<span class="label-text text-xs font-medium">Common Panel Sizes</span>
				</label>
				<div class="flex flex-wrap gap-1">
					<button
						class="btn btn-outline btn-xs"
						onclick={() => onPanelConfigUpdate({ width: 2.0, height: 1.0 })}
					>
						2.0×1.0m
					</button>
					<button
						class="btn btn-outline btn-xs"
						onclick={() => onPanelConfigUpdate({ width: 1.65, height: 1.0 })}
					>
						1.65×1.0m
					</button>
					<button
						class="btn btn-outline btn-xs"
						onclick={() => onPanelConfigUpdate({ width: 2.1, height: 1.05 })}
					>
						2.1×1.05m
					</button>
				</div>
			</div>
		</div>
	</div>
</div>
