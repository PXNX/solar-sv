import { getLocale } from '$lib/paraglide/runtime';
import { m } from '$lib/paraglide/messages';

export function formatEuro(value: number, compact = true): string {
	return new Intl.NumberFormat(getLocale(), {
		style: 'currency',
		currency: 'EUR',
		notation: compact ? 'compact' : 'standard',
		maximumFractionDigits: compact ? 1 : 0
	}).format(value);
}

export function formatNumber(value: number, fractionDigits = 0): string {
	return new Intl.NumberFormat(getLocale(), {
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits
	}).format(value);
}

export function formatDate(date: Date): string {
	return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'long' }).format(date);
}

/** Localised 8-point compass label for an azimuth in degrees. */
export function compassLabel(azimuth: number): string {
	return m.compass_points().split(',')[Math.round(azimuth / 45) % 8];
}
