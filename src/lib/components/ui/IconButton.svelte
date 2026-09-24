<script lang="ts">
	import type { Component } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { buttonClass, type ButtonSize, type ButtonVariant } from './styles';

	interface Props extends Omit<HTMLButtonAttributes, 'class'> {
		icon: Component;
		label: string;
		variant?: ButtonVariant;
		size?: ButtonSize;
		class?: string;
	}

	let {
		icon: Icon,
		label,
		variant = 'ghost',
		size = 'md',
		class: className = '',
		...rest
	}: Props = $props();

	const classes = $derived(buttonClass({ variant, size, shape: 'circle', class: className }));
	const iconSize = $derived(size === 'xs' ? 'size-3.5' : size === 'lg' ? 'size-6' : 'size-4');
</script>

<button {...rest} class={classes} aria-label={label} title={label}>
	<Icon class={iconSize} />
</button>
