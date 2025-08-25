<script lang="ts">
	import { CookieManager } from '@boxfish-studio/sveltekit-cookie-manager';
	import type { SKCMConfiguration } from '@boxfish-studio/sveltekit-cookie-manager';

	const configuration: SKCMConfiguration = {
		disclaimer: {
			title: 'This website uses cookies',
			body: 'By using this site, you agree with our use of cookies'
		},
		theme: {
			primary: '#14cabf',
			dark: '#131f37',
			medium: '#b0bfd9',
			light: '#fff'
		}
	};
</script>

<CookieManager {configuration} />
