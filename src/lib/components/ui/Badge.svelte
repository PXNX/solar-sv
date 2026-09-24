<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { badgeClass, type BadgeSize, type BadgeTone } from './styles';

	interface Props {
		tone?: BadgeTone;
		size?: BadgeSize;
		icon?: Component;
		class?: string;
		children: Snippet;
	}

	let {
		tone = 'neutral',
		size = 'sm',
		icon: Icon,
		class: className = '',
		children
	}: Props = $props();

	const iconSize = $derived(size === 'xs' ? 'size-3' : 'size-3.5');
</script>

<span class={badgeClass({ tone, size, class: `gap-1 ${className}` })}>
	{#if Icon}
		<Icon class={iconSize} />
	{/if}
	{@render children()}
</span>
