<script lang="ts">
	import CookieBanner from '$lib/components/CookieBanner.svelte';
	import '../app.css';
	let { children } = $props();
</script>

<div class="100dvw 100dvh relative flex flex-row" style="font-family:'HP Simplified'">
	{@render children()}
</div>

<CookieBanner />
