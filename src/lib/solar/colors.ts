/** One distinct, high-contrast colour per roof, used on the map, the card and exports. */
export const ROOF_COLORS = [
	'#f59e0b',
	'#38bdf8',
	'#34d399',
	'#f472b6',
	'#a78bfa',
	'#fb7185',
	'#22d3ee',
	'#a3e635'
] as const;

export function roofColor(index: number): string {
	return ROOF_COLORS[index % ROOF_COLORS.length];
}
