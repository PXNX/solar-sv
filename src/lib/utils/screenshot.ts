import html2canvas from 'html2canvas-pro';

interface RenderOptions {
	/** CSS size to render; defaults to the element's current size. */
	width?: number;
	height?: number;
	scale?: number;
}

/**
 * Renders `element` to a canvas. Map tiles must be loaded with CORS for this to work.
 * With an explicit size the element may be larger than the viewport (e.g. on phones).
 */
export function renderElement(element: HTMLElement, options: RenderOptions = {}) {
	const width = options.width ?? element.offsetWidth;
	const height = options.height ?? element.offsetHeight;
	return html2canvas(element, {
		useCORS: true,
		scale: options.scale ?? (window.devicePixelRatio || 1),
		width,
		height,
		windowWidth: Math.max(width, window.innerWidth),
		windowHeight: Math.max(height, window.innerHeight),
		x: 0,
		y: 0,
		scrollX: 0,
		scrollY: 0,
		// Zoom buttons are noise in an exported plan; attribution and scale stay.
		ignoreElements: (el) => el.classList.contains('leaflet-control-zoom')
	});
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number) {
	return new Promise<Blob>((resolve, reject) =>
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))),
			type,
			quality
		)
	);
}

export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
