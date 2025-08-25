<!-- src/lib/components/Instructions.svelte -->
<script lang="ts">
	let isExpanded = $state(false);

	function toggleExpanded() {
		isExpanded = !isExpanded;
	}
</script>

<div class="card bg-base-100 shadow-sm">
	<div class="card-body p-4">
		<div class="mb-2 flex items-center justify-between">
			<h2 class="card-title text-lg">📖 How to Use</h2>
			<button class="btn btn-ghost btn-xs" onclick={toggleExpanded}>
				{#if isExpanded}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 15l7-7 7 7"
						/>
					</svg>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 9l-7 7-7-7"
						/>
					</svg>
				{/if}
			</button>
		</div>

		{#if isExpanded}
			<div class="space-y-3 text-sm">
				<div class="steps steps-vertical">
					<div class="step step-primary">
						<div class="ml-4 text-left">
							<div class="font-medium">Find Your Location</div>
							<div class="text-base-content/60 text-xs">
								Search for your address to navigate to your building
							</div>
						</div>
					</div>

					<div class="step step-primary">
						<div class="ml-4 text-left">
							<div class="font-medium">Draw Roof Outline</div>
							<div class="text-base-content/60 text-xs">
								Click "Draw Roof Outline" and trace your roof on the map
							</div>
						</div>
					</div>

					<div class="step step-primary">
						<div class="ml-4 text-left">
							<div class="font-medium">Configure Panels</div>
							<div class="text-base-content/60 text-xs">
								Adjust panel dimensions and spacing to match your needs
							</div>
						</div>
					</div>

					<div class="step step-primary">
						<div class="ml-4 text-left">
							<div class="font-medium">View Results</div>
							<div class="text-base-content/60 text-xs">
								See how many panels fit and estimated power output
							</div>
						</div>
					</div>
				</div>

				<div class="divider my-3"></div>

				<div class="space-y-2">
					<div class="text-sm font-medium">💡 Tips:</div>
					<ul class="text-base-content/70 ml-4 space-y-1 text-xs">
						<li>• Double-click to finish drawing a roof outline</li>
						<li>• Use the edit tools on the map to modify your roof shape</li>
						<li>• Adjust roof coverage to account for obstacles like chimneys</li>
						<li>• Try different panel sizes to optimize your layout</li>
						<li>• Results are estimates - consult professionals for final planning</li>
					</ul>
				</div>

				<div class="divider my-3"></div>

				<div class="text-base-content/50 text-xs">
					<div class="mb-1 font-medium">About the Calculator:</div>
					<p>
						This tool provides rough estimates for solar panel planning. Actual installation should
						consider roof condition, local regulations, shading, optimal tilt angles, and electrical
						requirements.
					</p>
				</div>
			</div>
		{:else}
			<div class="text-base-content/60 text-sm">
				<div class="flex items-center gap-2">
					<span>1. Search address</span>
					<span>→</span>
					<span>2. Draw roof</span>
					<span>→</span>
					<span>3. Configure panels</span>
				</div>
				<div class="text-base-content/40 mt-1 text-xs">
					Click to expand for detailed instructions
				</div>
			</div>
		{/if}
	</div>
</div>
