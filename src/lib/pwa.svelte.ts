interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const pwa = $state({
	installPrompt: null as BeforeInstallPromptEvent | null,
	installed: false
});

/** Keeps the browser's install prompt around so Settings can offer an "Install app" button. */
export function trackInstallability(): () => void {
	pwa.installed = window.matchMedia('(display-mode: standalone)').matches;

	const onPrompt = (e: Event) => {
		e.preventDefault();
		pwa.installPrompt = e as BeforeInstallPromptEvent;
	};
	const onInstalled = () => {
		pwa.installPrompt = null;
		pwa.installed = true;
	};
	window.addEventListener('beforeinstallprompt', onPrompt);
	window.addEventListener('appinstalled', onInstalled);
	return () => {
		window.removeEventListener('beforeinstallprompt', onPrompt);
		window.removeEventListener('appinstalled', onInstalled);
	};
}

export async function promptInstall(): Promise<void> {
	const prompt = pwa.installPrompt;
	if (!prompt) return;
	await prompt.prompt();
	await prompt.userChoice;
	pwa.installPrompt = null;
}
