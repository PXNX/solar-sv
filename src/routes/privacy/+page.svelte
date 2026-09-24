<script lang="ts">
	import { resolve } from '$app/paths';
	import FluentArrowLeft24Regular from '~icons/fluent/arrow-left-24-regular';
	import FluentWarning24Regular from '~icons/fluent/warning-24-regular';
	import { Button } from '$lib/components/ui';
	import { OPERATOR, PRIVACY_UPDATED, operatorComplete } from '$lib/legal';
	import { formatDate } from '$lib/utils/format';
	import { getLocale } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages';

	const german = getLocale() === 'de';
</script>

<svelte:head>
	<title>{m.privacy()} · {m.app_name()}</title>
</svelte:head>

{#snippet controller()}
	<address class="not-italic">
		{OPERATOR.name || '[Name / Firma]'}<br />
		{OPERATOR.street || '[Straße, Hausnummer]'}<br />
		{OPERATOR.city || '[PLZ, Ort]'}<br />
		{#if OPERATOR.email}
			<a href="mailto:{OPERATOR.email}">{OPERATOR.email}</a>
		{:else}
			[E-Mail]
		{/if}
		{#if OPERATOR.phone}<br />{OPERATOR.phone}{/if}
	</address>
{/snippet}

<div class="ledger-grid min-h-svh">
	<header class="border-base-content/15 bg-neutral/95 sticky top-0 z-20 border-b backdrop-blur-md">
		<div class="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
			<Button
				href={resolve('/settings')}
				shape="circle"
				variant="subtle"
				size="sm"
				icon={FluentArrowLeft24Regular}
				aria-label={m.settings()}
				title={m.settings()}
			/>
			<h1 class="text-base-content flex-1 text-2xl">
				{german ? 'Datenschutzerklärung' : 'Privacy policy'}
			</h1>
		</div>
	</header>

	<main class="mx-auto max-w-3xl px-4 py-6">
		{#if !operatorComplete}
			<div class="panel mb-4 flex gap-3 border-amber-500/40! p-4 text-sm text-amber-200">
				<FluentWarning24Regular class="size-5 shrink-0" />
				<p>
					{german
						? 'Die Angaben zum Verantwortlichen fehlen noch. Bitte in src/lib/legal.ts eintragen.'
						: 'Controller details are missing. Please fill them in in src/lib/legal.ts.'}
				</p>
			</div>
		{/if}

		<article
			class="panel prose prose-sm prose-invert sm:prose-base prose-headings:font-[family-name:var(--font-editorial)] prose-headings:font-normal prose-a:text-primary max-w-none p-6"
		>
			{#if german}
				<p class="lead">
					Diese Datenschutzerklärung informiert Sie gemäß Art. 13 DSGVO darüber, welche
					personenbezogenen Daten bei der Nutzung des Solarplaners verarbeitet werden.
				</p>

				<h2>1. Verantwortlicher</h2>
				{@render controller()}

				<h2>2. Grundprinzip: Ihre Daten bleiben in Ihrem Browser</h2>
				<p>
					Der Solarplaner läuft vollständig in Ihrem Browser. Kundennamen, Adressen, eingezeichnete
					Dachflächen, Wirtschaftlichkeitsangaben, der Kundenverlauf sowie Ihr Branding (Logo,
					Firmenname, Kontaktdaten) werden ausschließlich lokal im Speicher Ihres Browsers (<em
						>localStorage</em
					>) abgelegt. Diese Daten werden nicht an uns übermittelt und nicht auf unseren Servern
					gespeichert. Sie können sie jederzeit löschen, indem Sie die Websitedaten in Ihrem Browser
					entfernen.
				</p>
				<p>
					Wenn Sie als Berater/in Daten Ihrer Kundinnen und Kunden eingeben, sind Sie für diese
					Verarbeitung selbst verantwortlich. Bitte geben Sie nur die Daten ein, die Sie für das
					Angebot benötigen, und informieren Sie Ihre Kunden entsprechend.
				</p>

				<h2>3. Hosting und Server-Logfiles</h2>
				<p>
					Die Anwendung wird bei Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA
					gehostet. Beim Aufruf werden technisch notwendige Daten verarbeitet (IP-Adresse, Datum und
					Uhrzeit, aufgerufene Adresse, Browser-Kennung). Das dient der Auslieferung und Sicherheit
					der Anwendung; Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Vercel ist als
					Auftragsverarbeiter tätig und nach dem EU-US Data Privacy Framework zertifiziert;
					ergänzend gelten Standardvertragsklauseln.
				</p>

				<h2>4. Kartendienste</h2>
				<p>
					Zur Darstellung der Karte lädt Ihr Browser Kartenkacheln direkt von folgenden Anbietern.
					Dabei werden Ihre IP-Adresse und der angezeigte Kartenausschnitt an den jeweiligen
					Anbieter übertragen:
				</p>
				<ul>
					<li>
						Luftbilder: Esri Inc., 380 New York Street, Redlands, CA 92373, USA (World Imagery).
						Eine Übermittlung in die USA erfolgt auf Grundlage des EU-US Data Privacy Framework bzw.
						von Standardvertragsklauseln.
					</li>
					<li>
						Straßenkarte: OpenStreetMap Foundation, St John’s Innovation Centre, Cowley Road,
						Cambridge, CB4 0WS, Vereinigtes Königreich (Angemessenheitsbeschluss der EU).
					</li>
				</ul>
				<p>
					Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; die Karte ist für die Funktion der
					Anwendung erforderlich.
				</p>

				<h2>5. Adresssuche</h2>
				<p>
					Wenn Sie eine Adresse eingeben, wird der Suchtext zusammen mit Ihrer IP-Adresse an den
					Dienst Nominatim der OpenStreetMap Foundation übermittelt, um die Position auf der Karte
					zu ermitteln. Das geschieht nur, wenn Sie aktiv suchen. Rechtsgrundlage ist Art. 6 Abs. 1
					lit. f DSGVO; bei Kundenadressen sollten Sie sicherstellen, dass eine Rechtsgrundlage für
					die Verarbeitung besteht (z. B. Art. 6 Abs. 1 lit. b DSGVO, vorvertragliche Maßnahmen).
				</p>

				<h2>6. Ertragsberechnung (PVGIS)</h2>
				<p>
					Für die Ertragsprognose übermittelt unser Server die auf ca. 100 m gerundete Position
					einer Dachfläche sowie deren Neigung und Ausrichtung an PVGIS, einen Dienst der
					Gemeinsamen Forschungsstelle der Europäischen Kommission. Namen, Adressen und Ihre
					IP-Adresse werden dabei nicht an PVGIS weitergegeben.
				</p>

				<h2>7. Offline-Nutzung</h2>
				<p>
					Damit die Anwendung offline funktioniert, speichert ein Service Worker die
					Anwendungsdateien sowie bereits angesehene Kartenkacheln im Cache Ihres Browsers. Diese
					Daten verlassen Ihr Gerät nicht und lassen sich über die Browsereinstellungen löschen.
				</p>

				<h2>8. Keine Cookies, kein Tracking</h2>
				<p>
					Wir setzen keine Cookies, keine Analyse- oder Tracking-Werkzeuge und keine Werbung ein.
					Die Speicherung im Browser (Abschnitte 2 und 7) ist für die von Ihnen gewünschte Funktion
					unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Schriftarten werden von unserem eigenen
					Server geladen, nicht von Drittanbietern.
				</p>

				<h2>9. Ihre Rechte</h2>
				<p>
					Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art.
					17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und
					Widerspruch gegen Verarbeitungen auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO (Art. 21).
					Außerdem können Sie sich bei einer Datenschutz-Aufsichtsbehörde beschweren, etwa beim
					Landesbeauftragten für den Datenschutz und die Informationsfreiheit Baden-Württemberg.
				</p>

				<p class="text-sm opacity-70">Stand: {formatDate(PRIVACY_UPDATED)}</p>
			{:else}
				<p class="lead">
					This privacy policy explains, in line with Art. 13 GDPR, which personal data is processed
					when you use Solar Planner.
				</p>

				<h2>1. Controller</h2>
				{@render controller()}

				<h2>2. Your data stays in your browser</h2>
				<p>
					Solar Planner runs entirely in your browser. Customer names, addresses, drawn roofs,
					economics inputs, the customer history and your branding (logo, company name, contact
					details) are stored only in your browser's local storage. They are not sent to us or
					stored on our servers. You can delete them at any time by clearing this site's data in
					your browser.
				</p>
				<p>
					If you enter data about your customers, you are responsible for that processing. Please
					only enter what you need for the proposal and inform your customers accordingly.
				</p>

				<h2>3. Hosting and server logs</h2>
				<p>
					The app is hosted by Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA. When
					you open it, technically necessary data is processed (IP address, date and time, requested
					URL, browser identifier) to deliver and secure the app, based on Art. 6(1)(f) GDPR. Vercel
					acts as a processor and is certified under the EU-US Data Privacy Framework; standard
					contractual clauses apply in addition.
				</p>

				<h2>4. Map services</h2>
				<p>
					To show the map, your browser loads map tiles directly from these providers, which receive
					your IP address and the visible map area:
				</p>
				<ul>
					<li>
						Aerial imagery: Esri Inc., 380 New York Street, Redlands, CA 92373, USA (World Imagery),
						based on the EU-US Data Privacy Framework or standard contractual clauses.
					</li>
					<li>
						Street map: OpenStreetMap Foundation, St John’s Innovation Centre, Cowley Road,
						Cambridge, CB4 0WS, United Kingdom (EU adequacy decision).
					</li>
				</ul>
				<p>The legal basis is Art. 6(1)(f) GDPR; the map is required for the app to work.</p>

				<h2>5. Address search</h2>
				<p>
					When you search for an address, the search text and your IP address are sent to the
					OpenStreetMap Foundation's Nominatim service to find the location. This only happens when
					you actively search. The legal basis is Art. 6(1)(f) GDPR; for customer addresses, make
					sure you have a legal basis yourself (for example Art. 6(1)(b) GDPR, pre-contractual
					measures).
				</p>

				<h2>6. Yield calculation (PVGIS)</h2>
				<p>
					For the yield forecast, our server sends the roof's position rounded to about 100 m, plus
					its tilt and orientation, to PVGIS, a service of the European Commission's Joint Research
					Centre. Names, addresses and your IP address are not passed on.
				</p>

				<h2>7. Offline use</h2>
				<p>
					To work offline, a service worker stores the app files and map tiles you have viewed in
					your browser's cache. This data does not leave your device and can be cleared in your
					browser settings.
				</p>

				<h2>8. No cookies, no tracking</h2>
				<p>
					We use no cookies, no analytics or tracking tools and no advertising. Browser storage
					(sections 2 and 7) is strictly necessary for the functions you request (Section 25(2)(2)
					TDDDG). Fonts are served from our own server, not by third parties.
				</p>

				<h2>9. Your rights</h2>
				<p>
					You have the right of access (Art. 15 GDPR), rectification (Art. 16), erasure (Art. 17),
					restriction of processing (Art. 18), data portability (Art. 20) and to object to
					processing based on Art. 6(1)(f) GDPR (Art. 21). You can also lodge a complaint with a
					data protection supervisory authority.
				</p>

				<p class="text-sm opacity-70">Last updated: {formatDate(PRIVACY_UPDATED)}</p>
			{/if}
		</article>
	</main>
</div>
