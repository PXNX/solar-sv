import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import Icons from 'unplugin-icons/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { paraglideVitePlugin } from '@inlang/paraglide-js';

const DAY = 24 * 60 * 60;

export default defineConfig({
	plugins: [
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			emitTsDeclarations: true,
			// An explicit choice in Settings wins, otherwise follow the browser language.
			strategy: ['custom-choice', 'preferredLanguage', 'baseLocale']
		}),
		sveltekit(),
		tailwindcss(),
		Icons({
			compiler: 'svelte',
			autoInstall: true
		}),
		SvelteKitPWA({
			registerType: 'prompt',
			manifest: {
				id: '/',
				name: 'Solar Planner',
				short_name: 'Solar',
				description: 'Plan rooftop PV layouts on aerial imagery and export customer proposals.',
				start_url: '/',
				scope: '/',
				display: 'standalone',
				orientation: 'any',
				theme_color: '#0e1d2f',
				background_color: '#0e1d2f',
				categories: ['business', 'productivity', 'utilities'],
				icons: [
					{ src: '/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
					{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
					{
						src: '/maskable-icon-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				],
				shortcuts: [{ name: 'Settings', short_name: 'Settings', url: '/settings' }]
			},
			workbox: {
				globPatterns: [
					'client/**/*.{js,css,ico,png,svg,webp,woff2,webmanifest}',
					'prerendered/**/*.html'
				],
				maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
				runtimeCaching: [
					{
						// Aerial imagery changes rarely; keep what was viewed so sites open offline.
						urlPattern: /^https:\/\/server\.arcgisonline\.com\/.*/,
						handler: 'CacheFirst',
						options: {
							cacheName: 'imagery-tiles',
							expiration: { maxEntries: 3000, maxAgeSeconds: 30 * DAY },
							cacheableResponse: { statuses: [0, 200] }
						}
					},
					{
						// Yields for a roof never change; answer offline from the last response.
						urlPattern: ({ url }) => url.pathname === '/api/yield',
						handler: 'StaleWhileRevalidate',
						options: { cacheName: 'pvgis-yield', expiration: { maxEntries: 500 } }
					},
					{
						urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/,
						handler: 'StaleWhileRevalidate',
						options: {
							cacheName: 'street-tiles',
							expiration: { maxEntries: 1500, maxAgeSeconds: 7 * DAY },
							cacheableResponse: { statuses: [0, 200] }
						}
					}
				]
			}
		})
	],

	server: {
		allowedHosts: true,
		port: 3021
	}
});
