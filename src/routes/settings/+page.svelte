<script lang="ts">
	import { resolve } from '$app/paths';
	import FluentArrowLeft24Regular from '~icons/fluent/arrow-left-24-regular';
	import FluentLocalLanguage24Regular from '~icons/fluent/local-language-24-regular';
	import FluentPaintBrush24Regular from '~icons/fluent/paint-brush-24-regular';
	import FluentPhoneLaptop24Regular from '~icons/fluent/phone-laptop-24-regular';
	import FluentArrowUpload24Regular from '~icons/fluent/arrow-upload-24-regular';
	import FluentDelete24Regular from '~icons/fluent/delete-24-regular';
	import FluentCheckmarkCircle24Regular from '~icons/fluent/checkmark-circle-24-regular';
	import FluentShieldLock24Regular from '~icons/fluent/shield-lock-24-regular';
	import { Button } from '$lib/components/ui';
	import { imageFileToDataUrl, persistedBranding } from '$lib/branding';
	import { pwa, promptInstall } from '$lib/pwa.svelte';
	import { getLocale, locales, setLocale } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages';

	const LOCALE_STORAGE_KEY = 'PARAGLIDE_LOCALE';
	const LANGUAGE_NAMES: Record<string, string> = { en: 'English', de: 'Deutsch' };

	const [storedBranding, saveBranding] = persistedBranding();
	let branding = $state(storedBranding);
	$effect(() => saveBranding($state.snapshot(branding)));

	let languageChoice = $state(localStorage.getItem(LOCALE_STORAGE_KEY) ? getLocale() : 'auto');
	let logoError = $state(false);
	let fileInput: HTMLInputElement;

	function chooseLanguage(choice: string) {
		if (choice === 'auto') {
			localStorage.removeItem(LOCALE_STORAGE_KEY);
			location.reload();
		} else {
			setLocale(choice as (typeof locales)[number]);
		}
	}

	async function handleLogo(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;
		logoError = false;
		try {
			branding.logo = await imageFileToDataUrl(file);
		} catch {
			logoError = true;
		}
	}

	const textFields = [
		{ key: 'companyName', label: m.company_name, type: 'text', autocomplete: 'organization' },
		{ key: 'consultant', label: m.consultant, type: 'text', autocomplete: 'name' },
		{ key: 'email', label: m.email, type: 'email', autocomplete: 'email' },
		{ key: 'phone', label: m.phone, type: 'tel', autocomplete: 'tel' },
		{ key: 'website', label: m.website, type: 'url', autocomplete: 'url' }
	] as const;
</script>

<svelte:head>
	<title>{m.settings_title()} · {m.app_name()}</title>
</svelte:head>

<div class="ledger-grid min-h-svh">
	<header class="border-base-content/15 bg-neutral/95 sticky top-0 z-20 border-b backdrop-blur-md">
		<div class="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
			<Button
				href={resolve('/')}
				shape="circle"
				variant="subtle"
				size="sm"
				icon={FluentArrowLeft24Regular}
				aria-label={m.back_to_planner()}
				title={m.back_to_planner()}
			/>
			<h1 class="text-base-content flex-1 text-2xl">{m.settings_title()}</h1>
			<span class="text-base-content/55 flex items-center gap-1 text-xs">
				<FluentCheckmarkCircle24Regular class="text-success size-4" />
				{m.saved_automatically()}
			</span>
		</div>
	</header>

	<main class="mx-auto max-w-2xl space-y-4 px-4 py-6">
		<section class="panel fade_in p-5">
			<h2 class="section-title mb-1">
				<FluentLocalLanguage24Regular class="size-5 text-sky-300" />
				{m.language_title()}
			</h2>
			<p class="text-base-content/60 mb-4 text-sm">{m.language_hint()}</p>
			<div class="flex flex-wrap gap-1.5">
				{#each ['auto', ...locales] as choice (choice)}
					<Button
						size="sm"
						variant={languageChoice === choice ? 'primary' : 'subtle'}
						onclick={() => {
							languageChoice = choice;
							chooseLanguage(choice);
						}}
					>
						{choice === 'auto' ? m.language_auto() : LANGUAGE_NAMES[choice]}
					</Button>
				{/each}
			</div>
		</section>

		<section class="panel fade_in p-5">
			<h2 class="section-title mb-1">
				<FluentPaintBrush24Regular class="size-5 text-rose-300" />
				{m.branding_title()}
			</h2>
			<p class="text-base-content/60 mb-4 text-sm">{m.branding_hint()}</p>

			<span class="field-label">{m.logo()}</span>
			<div class="mb-4 flex flex-wrap items-center gap-3">
				<button
					type="button"
					class="field-control flinch grid h-20 w-44 place-items-center overflow-hidden rounded-2xl border-dashed p-2"
					onclick={() => fileInput.click()}
					aria-label={m.logo_upload()}
				>
					{#if branding.logo}
						<img src={branding.logo} alt="" class="max-h-full max-w-full object-contain" />
					{:else}
						<FluentArrowUpload24Regular class="text-base-content/40 size-6" />
					{/if}
				</button>
				<div class="flex flex-col gap-1.5">
					<Button
						size="xs"
						variant="subtle"
						icon={FluentArrowUpload24Regular}
						onclick={() => fileInput.click()}
					>
						{m.logo_upload()}
					</Button>
					{#if branding.logo}
						<Button
							size="xs"
							variant="soft-red"
							icon={FluentDelete24Regular}
							onclick={() => (branding.logo = null)}
						>
							{m.logo_remove()}
						</Button>
					{/if}
				</div>
				<input
					bind:this={fileInput}
					type="file"
					accept="image/png,image/jpeg,image/svg+xml,image/webp"
					class="hidden"
					onchange={handleLogo}
				/>
			</div>
			<p class="field-hint -mt-2 mb-4" class:text-red-300!={logoError}>{m.logo_hint()}</p>

			<div class="grid gap-3 sm:grid-cols-2">
				{#each textFields as field (field.key)}
					<label class="block">
						<span class="field-label">{field.label()}</span>
						<input
							type={field.type}
							autocomplete={field.autocomplete}
							class="field-control w-full rounded-full px-4 py-2 text-sm"
							bind:value={branding[field.key]}
						/>
					</label>
				{/each}
			</div>

			<span class="field-label mt-5">{m.preview()}</span>
			<div class="flex items-center gap-4 rounded-2xl bg-[#fffdf8] p-4 text-[#14283f]">
				{#if branding.logo}
					<img src={branding.logo} alt="" class="h-12 max-w-40 object-contain" />
				{/if}
				<div class="min-w-0 flex-1">
					<div class="truncate font-bold">{branding.companyName || m.app_name()}</div>
					<div class="truncate text-xs text-[#69727f]">
						{[branding.website, branding.email, branding.phone].filter(Boolean).join(' · ')}
					</div>
				</div>
				<div class="text-right">
					<div class="editorial-title text-lg">{m.report_title()}</div>
					<div class="text-xs text-[#69727f]">{branding.consultant}</div>
				</div>
			</div>
		</section>

		<section class="panel fade_in p-5">
			<h2 class="section-title mb-1">
				<FluentPhoneLaptop24Regular class="size-5 text-emerald-300" />
				{m.app_section_title()}
			</h2>
			<p class="text-base-content/60 mb-4 text-sm">{m.install_hint()}</p>
			{#if pwa.installed}
				<p class="text-success flex items-center gap-2 text-sm">
					<FluentCheckmarkCircle24Regular class="size-5" />
					{m.installed()}
				</p>
			{:else if pwa.installPrompt}
				<Button icon={FluentPhoneLaptop24Regular} onclick={promptInstall}>{m.install_app()}</Button>
			{:else}
				<p class="text-base-content/60 text-sm">{m.install_unavailable()}</p>
			{/if}

			<div class="border-base-content/10 mt-5 border-t pt-4">
				<Button
					href={resolve('/privacy')}
					size="sm"
					variant="ghost"
					icon={FluentShieldLock24Regular}
				>
					{m.privacy()}
				</Button>
			</div>
		</section>
	</main>
</div>
