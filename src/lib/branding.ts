import { createPersistentState } from '$lib/utils/storeutils';

export interface Branding {
	companyName: string;
	consultant: string;
	email: string;
	phone: string;
	website: string;
	/** PNG data URL, already scaled down. */
	logo: string | null;
}

export interface Customer {
	name: string;
	address: string;
	location: [lat: number, lng: number] | null;
}

export const DEFAULT_BRANDING: Branding = {
	companyName: '',
	consultant: '',
	email: '',
	phone: '',
	website: '',
	logo: null
};

export const DEFAULT_CUSTOMER: Customer = { name: '', address: '', location: null };

export function persistedBranding() {
	return createPersistentState<Branding>(
		'solar-branding',
		DEFAULT_BRANDING,
		JSON.stringify,
		(v) => ({
			...DEFAULT_BRANDING,
			...JSON.parse(v)
		})
	);
}

export interface CropRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Cuts `crop` (natural image pixels) out of `image` as a PNG data URL no larger than the box. */
export function cropToDataUrl(
	image: HTMLImageElement,
	crop: CropRect,
	maxWidth = 600,
	maxHeight = 300
): string {
	const scale = Math.min(1, maxWidth / crop.width, maxHeight / crop.height);
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(crop.width * scale));
	canvas.height = Math.max(1, Math.round(crop.height * scale));
	canvas
		.getContext('2d')
		?.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
	return canvas.toDataURL('image/png');
}
