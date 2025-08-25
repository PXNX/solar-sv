import html2canvas from 'html2canvas';
import domtoimage from 'dom-to-image';

export async function captureScreenshot(): Promise<void> {
	const element = document.getElementById('container');
	console.log(element);

	if (element) {
		const scale = 4;

		const style = {
			transform: 'scale(' + scale + ')',
			transformOrigin: 'top left',
			width: element.offsetWidth + 'px',
			height: element.offsetHeight + 'px'
		};

		domtoimage
			.toPng(element, {
				width: element.offsetWidth * scale,
				height: element.offsetHeight * scale,
				style: style
			})
			.then((dataUrl) => {
				const link = document.createElement('a') as HTMLAnchorElement;
				link.download = 'high-res.png';
				link.href = dataUrl;
				link.click();
			})
			.catch((error) => {
				console.error('dom-to-image error:', error);
			});
	}
}

export async function captureScreenshot3(): Promise<void> {
	// import the required library

	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');
	const video = document.createElement('video');

	try {
		const captureStream = await navigator.mediaDevices.getDisplayMedia();
		video.srcObject = captureStream;

		// Wait for video to load metadata and play
		await new Promise((resolve) => {
			video.onloadedmetadata = () => {
				video.play();
				resolve(true);
			};
		});

		// Set canvas size to match screen
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		// Draw the current frame from the video to the canvas
		context.drawImage(video, 0, 0, canvas.width, canvas.height);

		// Convert canvas to base64 PNG
		const base64 = canvas.toDataURL('image/png');

		// Download the image
		const link = document.createElement('a');
		link.href = base64;
		link.download = 'screenshot.png';
		link.click();

		// Stop the capture stream
		captureStream.getTracks().forEach((track) => track.stop());
	} catch (err) {
		console.error('Error: ' + err);
	}
}

export async function captureScreenshot2(): Promise<void> {
	try {
		// Get the main container
		const container = document.querySelector('#container') as HTMLElement;

		if (!container) {
			throw new Error('Container not found');
		}

		// Create a temporary style to fix oklch colors for html2canvas

		// Add temp class
		container.classList.add('temp-screenshot');

		const canvas = await html2canvas(container, {
			useCORS: true,
			allowTaint: true,
			scale: 2,
			logging: true,
			backgroundColor: '#ffffff',
			ignoreElements: (element) => {
				return (
					element.classList.contains('dropdown-content') ||
					element.classList.contains('modal') ||
					element.classList.contains('navbar')
				);
			}
		});

		// Clean up
		container.classList.remove('temp-screenshot');
		document.head.removeChild(style);

		// Download the screenshot
		canvas.toBlob((blob) => {
			if (blob) {
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `map-screenshot-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
			}
		}, 'image/png');
	} catch (error) {
		console.error('html2canvas failed:', error);
		alert("Screenshot capture failed. Please try using your browser's built-in screenshot tools.");
		throw error;
	}
}
