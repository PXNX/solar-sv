<!-- src/lib/components/SolarResults.svelte -->
<script lang="ts">
	import type { Roof, SolarAnalysis } from '$lib/types';

	interface Props {
		currentRoof: Roof | null;
		solarAnalysis: SolarAnalysis | null;
	}

	let { currentRoof, solarAnalysis }: Props = $props();

	function formatArea(area: number): string {
		return `${area.toFixed(1)} m²`;
	}

	function formatPower(power: number): string {
		if (power >= 1000) {
			return `${(power / 1000).toFixed(1)} MW`;
		}
		return `${power.toFixed(1)} kW`;
	}

	function formatEfficiency(efficiency: number): string {
		return `${efficiency.toFixed(1)}%`;
	}

	function formatNumber(num: number): string {
		return new Intl.NumberFormat().format(Math.round(num));
	}
</script>

<div class="card bg-base-100 shadow-sm">
	<div class="card-body p-4">
		<h2 class="card-title mb-3 text-lg">☀️ Solar Analysis</h2>

		{#if !currentRoof}
			<div class="py-8 text-center">
				<div class="text-base-content/40">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="mx-auto mb-3 h-16 w-16 opacity-30"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
						/>
					</svg>
					<p class="text-sm">Draw a roof outline to see solar analysis</p>
				</div>
			</div>
		{:else if solarAnalysis}
			<div class="space-y-4">
				<!-- Key Metrics -->
				<div class="grid grid-cols-2 gap-2">
					<div class="stat bg-primary/10 rounded-lg p-3">
						<div class="stat-title text-xs">Panels</div>
						<div class="stat-value text-primary text-2xl">
							{formatNumber(solarAnalysis.panelCount)}
						</div>
					</div>
					<div class="stat bg-success/10 rounded-lg p-3">
						<div class="stat-title text-xs">Est. Power</div>
						<div class="stat-value text-success text-2xl">
							{formatPower(solarAnalysis.estimatedPowerOutput)}
						</div>
					</div>
				</div>

				<!-- Detailed Breakdown -->
				<div class="divider my-2"></div>

				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<span class="text-base-content/70 text-sm">Roof Area:</span>
						<span class="font-medium">{formatArea(solarAnalysis.roofArea)}</span>
					</div>

					<div class="flex items-center justify-between">
						<span class="text-base-content/70 text-sm">Available Area:</span>
						<span class="font-medium">{formatArea(solarAnalysis.availableArea)}</span>
					</div>

					<div class="flex items-center justify-between">
						<span class="text-base-content/70 text-sm">Panel Surface Area:</span>
						<span class="text-primary font-medium">{formatArea(solarAnalysis.totalPanelArea)}</span>
					</div>

					<div class="flex items-center justify-between">
						<span class="text-base-content/70 text-sm">Coverage Efficiency:</span>
						<span class="font-medium">{formatEfficiency(solarAnalysis.efficiency)}</span>
					</div>
				</div>

				<!-- Progress Bars -->
				<div class="divider my-2"></div>

				<div class="space-y-3">
					<div>
						<div class="mb-1 flex justify-between text-xs">
							<span>Roof Utilization</span>
							<span>{formatEfficiency(solarAnalysis.efficiency)}</span>
						</div>
						<progress
							class="progress progress-primary w-full"
							value={solarAnalysis.efficiency}
							max="100"
						></progress>
					</div>
				</div>

				<!-- Energy Estimates -->
				<div class="divider my-2"></div>

				<div class="alert alert-info text-sm">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4 shrink-0 stroke-current"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						></path>
					</svg>
					<div>
						<div class="text-xs font-bold">Estimated Annual Generation</div>
						<div class="text-xs">
							~{formatNumber(solarAnalysis.estimatedPowerOutput * 1000)} kWh/year
						</div>
						<div class="text-xs opacity-70">Based on 200W/m² average solar irradiance</div>
					</div>
				</div>

				<!-- Additional Info -->
				<div class="text-base-content/60 space-y-1 text-xs">
					<div>• Calculations are estimates based on panel area</div>
					<div>• Actual output depends on location, tilt, shading</div>
					<div>• Consider professional assessment for accurate planning</div>
				</div>
			</div>
		{/if}
	</div>
</div>
