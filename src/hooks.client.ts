import { registerLanguageStrategy } from '$lib/language';

// Runs before the app renders, so the first getLocale() already sees the user's choice.
registerLanguageStrategy();
