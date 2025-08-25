import type { Actions } from '@sveltejs/kit';
import puppeteer from 'puppeteer';

export const actions = {
	default: async ({ request }) => {
		//	await request.json();

		console.log('captureWithHtml2Canvass');

		const browser = await puppeteer.launch({ headless: true });
		const page = await browser.newPage();
		await page.goto('https://geo-mn.vercel.app', { waitUntil: 'networkidle0' });

		// Screenshot of a specific element (div with iframe)
		const element = await page.$('#container');
		await element?.screenshot({ path: 'div-with-iframe.png' });

		console.log('screenshot captured');

		await browser.close();

		return new Response('ok');
	}
} satisfies Actions;
