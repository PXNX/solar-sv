<script lang="ts">
	import type { Roof } from '$lib/types/Roof';

	interface Props {
		currentRoof: Roof | null;
		isDrawingRoof: boolean;
		onStartDrawing: () => void;
		onClearRoof: () => void;
	}

	let { currentRoof, isDrawingRoof, onStartDrawing, onClearRoof }: Props = $props();

	function formatArea(area: number): string {
		if (area < 1000) {
			return `${area.toFixed(1)} m²`;
		}
		return `${(area / 1000).toFixed(2)} km²`;
	}

	function handleStartDrawing() {
		onStartDrawing();
	}

	function handleClearRoof() {
		onClearRoof();
	}
</script>

<div class="card bg-base-100 shadow-sm">
	<div class="card-body p-4">
		<h2 class="card-title mb-3 text-lg">🏠 Roof Management</h2>

		{#if !currentRoof && !isDrawingRoof}
			<!-- No roof drawn yet -->
			<div class="py-4 text-center">
				<div class="text-base-content/60 mb-4">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="mx-auto mb-2 h-12 w-12 opacity-50"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m0 0h2M7 21V5a2 2 0 012-2h6a2 2 0 012 2v16"
						/>
					</svg>
					<p class="text-sm">No roof outline drawn</p>
				</div>
				<button class="btn btn-primary btn-sm" onclick={handleStartDrawing}>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="mr-1 h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 4v16m8-8H4"
						/>
					</svg>
					Draw Roof Outline
				</button>
			</div>
		{:else if isDrawingRoof}
			<!-- Currently drawing -->
			<div class="alert alert-info">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6 shrink-0 stroke-current"
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
					<h3 class="text-sm font-bold">Drawing in Progress</h3>
					<div class="text-xs">Click on the map to outline your roof</div>
				</div>
			</div>
		{:else if currentRoof}
			<!-- Roof exists -->
			<div class="space-y-3">
				<div class="stats stats-vertical w-full shadow">
					<div class="stat py-3">
						<div class="stat-title text-xs">Roof Area</div>
						<div class="stat-value text-lg">{formatArea(currentRoof.area)}</div>
						<div class="stat-desc text-xs">Total roof surface</div>
					</div>
				</div>

				<div class="divider my-2"></div>

				<div class="flex flex-col gap-2">
					<button class="btn btn-outline btn-sm" onclick={handleStartDrawing}>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="mr-1 h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
							/>
						</svg>
						Redraw Roof
					</button>

					<button class="btn btn-error btn-outline btn-sm" onclick={handleClearRoof}>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="mr-1 h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
							/>
						</svg>
						Clear Roof
					</button>
				</div>

				<div class="text-base-content/60 mt-2 text-xs">
					💡 Tip: Use the map's edit tools to modify your roof outline after drawing
				</div>
			</div>
		{/if}
	</div>
</div>
