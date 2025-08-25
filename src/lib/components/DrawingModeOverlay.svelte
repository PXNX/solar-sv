<script lang="ts">
	interface Props {
		onCancel: () => void;
	}

	let { onCancel }: Props = $props();
</script>

<div class="absolute top-4 right-4 left-4 z-[1000]">
	<div class="alert alert-info shadow-lg">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			class="h-6 w-6 shrink-0 stroke-current"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
			></path>
		</svg>
		<div>
			<h3 class="font-bold">Drawing Mode Active</h3>
			<div class="text-sm">Click on the map to draw your roof outline. Double-click to finish.</div>
		</div>
		<button class="btn btn-sm" onclick={onCancel}>Cancel</button>
	</div>
</div>
