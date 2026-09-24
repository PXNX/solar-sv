import html2canvas from 'html2canvas-pro';

/** Renders `element` to a canvas. Map tiles must be loaded with CORS for this to work. */
export function renderElement(element: HTMLElement, scale = window.devicePixelRatio || 1) {
	return html2canvas(element, {
		useCORS: true,
		scale,
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
