<script lang="ts">
	import FluentCrop24Regular from '~icons/fluent/crop-24-regular';
	import FluentCheckmark24Regular from '~icons/fluent/checkmark-24-regular';
	import FluentArrowReset24Regular from '~icons/fluent/arrow-reset-24-regular';
	import { Button } from '$lib/components/ui';
	import { cropToDataUrl, type CropRect } from '$lib/branding';
	import { m } from '$lib/paraglide/messages';

	interface Props {
		/** Object URL of the picked file. */
		src: string;
		onapply: (dataUrl: string) => void;
		oncancel: () => void;
	}

	let { src, onapply, oncancel }: Props = $props();

	type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se';
	const HANDLES = ['nw', 'ne', 'sw', 'se'] as const;
	const MIN_SIZE = 16;

	let image: HTMLImageElement | undefined = $state();
	let natural = $state({ width: 0, height: 0 });
	let displayWidth = $state(1);
	/** Crop in natural image pixels. */
	let crop = $state<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
	let drag: { handle: Handle; startX: number; startY: number; start: CropRect } | null = null;

	const scale = $derived(natural.width > 0 ? displayWidth / natural.width : 1);

	function handleLoad() {
		if (!image) return;
		natural = { width: image.naturalWidth, height: image.naturalHeight };
		crop = { x: 0, y: 0, ...natural };
	}

	function startDrag(handle: Handle, event: PointerEvent) {
		event.preventDefault();
		event.stopPropagation();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		drag = { handle, startX: event.clientX, startY: event.clientY, start: { ...crop } };
	}

	function moveDrag(event: PointerEvent) {
		if (!drag) return;
		const dx = (event.clientX - drag.startX) / scale;
		const dy = (event.clientY - drag.startY) / scale;
		const { start, handle } = drag;

		if (handle === 'move') {
			crop = {
				...start,
				x: Math.min(Math.max(0, start.x + dx), natural.width - start.width),
				y: Math.min(Math.max(0, start.y + dy), natural.height - start.height)
			};
			return;
		}

		let left = start.x;
		let top = start.y;
		let right = start.x + start.width;
		let bottom = start.y + start.height;
		if (handle.includes('w')) left = Math.min(Math.max(0, left + dx), right - MIN_SIZE);
		if (handle.includes('e'))
			right = Math.max(Math.min(natural.width, right + dx), left + MIN_SIZE);
		if (handle.includes('n')) top = Math.min(Math.max(0, top + dy), bottom - MIN_SIZE);
		if (handle.includes('s'))
			bottom = Math.max(Math.min(natural.height, bottom + dy), top + MIN_SIZE);
		crop = { x: left, y: top, width: right - left, height: bottom - top };
	}

	function endDrag() {
		drag = null;
	}

	function nudge(event: KeyboardEvent) {
		const step = event.shiftKey ? 10 : 1;
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-step, 0],
			ArrowRight: [step, 0],
			ArrowUp: [0, -step],
			ArrowDown: [0, step]
		};
		const move = moves[event.key];
		if (!move) return;
		event.preventDefault();
		crop.x = Math.min(Math.max(0, crop.x + move[0]), natural.width - crop.width);
		crop.y = Math.min(Math.max(0, crop.y + move[1]), natural.height - crop.height);
	}

	function apply() {
		if (image) onapply(cropToDataUrl(image, crop));
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && oncancel()} />

<div
	class="fade_in bg-neutral/70 fixed inset-0 z-[3000] grid place-items-center overflow-y-auto p-4 backdrop-blur-sm"
	role="dialog"
	aria-modal="true"
	aria-labelledby="crop-title"
>
	<div class="panel bg-base-100! w-full max-w-xl p-5">
		<h2 id="crop-title" class="section-title mb-1">
			<FluentCrop24Regular class="size-5 text-rose-300" />
			{m.crop_title()}
		</h2>
		<p class="text-base-content/60 mb-4 text-sm">{m.crop_hint()}</p>

		<div class="checkerboard grid place-items-center rounded-2xl p-3">
			<div class="relative inline-block touch-none select-none" bind:clientWidth={displayWidth}>
				<img
					bind:this={image}
					{src}
					alt=""
					class="block max-h-[50svh] max-w-full"
					draggable="false"
					onload={handleLoad}
				/>
				{#if natural.width > 0}
					<!-- Everything outside the crop is dimmed by the box shadow. -->
					<div
						class="crop-box absolute cursor-move"
						style:left="{crop.x * scale}px"
						style:top="{crop.y * scale}px"
						style:width="{crop.width * scale}px"
						style:height="{crop.height * scale}px"
						role="slider"
						tabindex="0"
						aria-label={m.crop_title()}
						aria-valuenow={Math.round(crop.x)}
						data-testid="crop-box"
						onpointerdown={(e) => startDrag('move', e)}
						onpointermove={moveDrag}
						onpointerup={endDrag}
						onpointercancel={endDrag}
						onkeydown={nudge}
					>
						{#each HANDLES as handle (handle)}
							<span
								class="crop-handle crop-handle-{handle}"
								data-testid="crop-handle-{handle}"
								role="button"
								tabindex="-1"
								aria-label="{m.crop_title()} ({handle})"
								onpointerdown={(e) => startDrag(handle, e)}
								onpointermove={moveDrag}
								onpointerup={endDrag}
								onpointercancel={endDrag}
							></span>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<p class="text-base-content/55 mt-2 text-center text-xs tabular-nums" data-testid="crop-size">
			{Math.round(crop.width)} × {Math.round(crop.height)} px
		</p>

		<div class="mt-4 flex flex-wrap justify-end gap-2">
			<Button
				variant="ghost"
				icon={FluentArrowReset24Regular}
				onclick={() => (crop = { x: 0, y: 0, ...natural })}
			>
				{m.crop_reset()}
			</Button>
			<Button variant="subtle" onclick={oncancel}>{m.crop_cancel()}</Button>
			<Button icon={FluentCheckmark24Regular} disabled={natural.width === 0} onclick={apply}>
				{m.crop_apply()}
			</Button>
		</div>
	</div>
</div>

<style>
	.checkerboard {
		background-color: #fff;
		background-image:
			linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
			linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
			linear-gradient(-45deg, transparent 75%, #e5e7eb 75%);
		background-size: 16px 16px;
		background-position:
			0 0,
			0 8px,
			8px -8px,
			-8px 0;
	}

	.crop-box {
		outline: 2px solid var(--color-primary);
		box-shadow: 0 0 0 9999px rgb(14 29 47 / 0.55);
	}

	.crop-box:focus-visible {
		outline-color: #fff;
	}

	.crop-handle {
		position: absolute;
		width: 1rem;
		height: 1rem;
		border: 2px solid var(--color-primary-content);
		border-radius: 9999px;
		background: var(--color-primary);
	}

	.crop-handle-nw {
		top: -0.5rem;
		left: -0.5rem;
		cursor: nwse-resize;
	}

	.crop-handle-ne {
		top: -0.5rem;
		right: -0.5rem;
		cursor: nesw-resize;
	}

	.crop-handle-sw {
		bottom: -0.5rem;
		left: -0.5rem;
		cursor: nesw-resize;
	}

	.crop-handle-se {
		right: -0.5rem;
		bottom: -0.5rem;
		cursor: nwse-resize;
	}
</style>
