import { inflateSync, constants } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import type { Download } from '@playwright/test';

export async function downloadBytes(download: Download): Promise<Buffer> {
	return readFile((await download.path())!);
}

/** Inflates every FlateDecode stream of a PDF and returns the text drawn with Tj. */
export function pdfText(pdf: Buffer): string {
	const source = pdf.toString('latin1');
	const chunks: string[] = [];
	const marker = /stream\r?\n/g;
	let match: RegExpExecArray | null;
	while ((match = marker.exec(source))) {
		const start = match.index + match[0].length;
		const end = source.indexOf('endstream', start);
		if (end < 0) break;
		try {
			const inflated = inflateSync(pdf.subarray(start, end), {
				finishFlush: constants.Z_SYNC_FLUSH
			});
			chunks.push(inflated.toString('latin1'));
		} catch {
			// Uncompressed content streams; binary images just add noise nobody searches for.
			chunks.push(pdf.subarray(start, end).toString('latin1'));
		}
		// Skip past the keyword, or `endstream` itself matches the marker.
		marker.lastIndex = end + 'endstream'.length;
	}
	const shown = chunks.join('\n').match(/\((?:\\.|[^\\)])*\)\s*Tj/g) ?? [];
	return shown
		.map((operator) =>
			operator
				.replace(/\)\s*Tj$/, '')
				.slice(1)
				.replace(/\\([()\\])/g, '$1')
		)
		.join('\n');
}

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
