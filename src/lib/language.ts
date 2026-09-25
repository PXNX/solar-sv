import { defineCustomClientStrategy } from '$lib/paraglide/runtime';

/** Set only when the user picks a language in Settings; absent means "follow the browser". */
export const LANGUAGE_KEY = 'solar-language';

let registered = false;

/**
 * Paraglide persists whatever it resolves on first use, which would freeze the browser
 * language as if it were a choice. This strategy only reads the explicit choice.
 */
export function registerLanguageStrategy() {
	if (registered) return;
	registered = true;
	defineCustomClientStrategy('custom-choice', {
		getLocale: () => localStorage.getItem(LANGUAGE_KEY) ?? undefined,
		setLocale: () => {}
	});
}

export function chooseLanguage(locale: string | null) {
	if (locale) localStorage.setItem(LANGUAGE_KEY, locale);
	else localStorage.removeItem(LANGUAGE_KEY);
	location.reload();
}
