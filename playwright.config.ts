import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * End-to-end tests run against the real production build served by Bun
 * (svelte-adapter-bun), the same server the Docker image uses.
 */
export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	timeout: 45_000,
	expect: { timeout: 10_000 },
	use: {
		baseURL: `http://localhost:${PORT}`,
		locale: 'en-US',
		timezoneId: 'Europe/Berlin',
		// Service workers would bypass the network mocks; the PWA spec opts back in.
		serviceWorkers: 'block',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [
		{
			name: 'desktop',
			use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } },
			testIgnore: '**/mobile.e2e.ts'
		},
		{
			name: 'mobile',
			use: { ...devices['Pixel 7'] },
			testMatch: '**/mobile.e2e.ts'
		}
	],
	webServer: {
		command: 'bun run build && bun ./build/index.js',
		port: PORT,
		env: { PORT: String(PORT) },
		reuseExistingServer: !process.env.CI,
		timeout: 300_000
	}
});
