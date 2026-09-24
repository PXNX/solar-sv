<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import { buttonClass, type ButtonShape, type ButtonSize, type ButtonVariant } from './styles';

	interface Props extends Omit<HTMLButtonAttributes & HTMLAnchorAttributes, 'class'> {
		variant?: ButtonVariant;
		size?: ButtonSize;
		shape?: ButtonShape;
		/** Renders an <a> instead of a <button>. */
		href?: string;
		block?: boolean;
		grow?: boolean;
		loading?: boolean;
		icon?: Component;
		iconRight?: Component;
		class?: string;
		children?: Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		shape = 'default',
		href,
		block = false,
		grow = false,
		loading = false,
		icon: Icon,
		iconRight: IconRight,
		class: className = '',
		disabled = false,
		children,
		...rest
	}: Props = $props();

	const classes = $derived(buttonClass({ variant, size, shape, block, grow, class: className }));
	const iconSize = $derived(size === 'xs' ? 'size-3.5' : size === 'lg' ? 'size-6' : 'size-5');
</script>

{#snippet content()}
	{#if loading}
		<span class="loading loading-spinner loading-sm"></span>
	{:else if Icon}
		<Icon class={iconSize} />
	{/if}
	{#if children}{@render children()}{/if}
	{#if IconRight && !loading}
		<IconRight class={iconSize} />
	{/if}
{/snippet}

{#if href}
	<!-- Callers pass hrefs already built with resolve() from $app/paths. -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a
		{...rest}
		{href}
		class={classes}
		class:btn-disabled={disabled || loading}
		aria-disabled={disabled || loading ? 'true' : undefined}
		tabindex={disabled || loading ? -1 : undefined}
	>
		{@render content()}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
	<button {...rest} class={classes} disabled={disabled || loading}>
		{@render content()}
	</button>
{/if}
