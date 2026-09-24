import vercel from '@sveltejs/adapter-vercel';
import bun from 'svelte-adapter-bun';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	runes: true,
	preprocess: [vitePreprocess()],

	kit: {
		// Vercel sets VERCEL=1 during its builds; everywhere else (Docker, local) we build a standalone Bun server.
		adapter: process.env.VERCEL ? vercel({ runtime: 'experimental_bun1.x' }) : bun()
	}
};

export default config;
