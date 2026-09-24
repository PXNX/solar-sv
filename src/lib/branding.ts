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

/** Reads an image file and returns it as a PNG data URL no larger than the given box. */
export function imageFileToDataUrl(file: File, maxWidth = 600, maxHeight = 300): Promise<string> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			const scale = Math.min(1, maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);
			const canvas = document.createElement('canvas');
			canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
			canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
			canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
			resolve(canvas.toDataURL('image/png'));
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Unsupported image'));
		};
		img.src = url;
	});
}
