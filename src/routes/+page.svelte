<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		Map,
		TileLayer,
		TileLayerWMS,
		Polygon,
		Polyline,
		CircleMarker,
		Marker,
		DivIcon,
		ControlScale,
		ControlZoom
	} from 'sveaflet';
	import L from 'leaflet';
	import { tick } from 'svelte';

	import FluentWeatherSunny24Filled from '~icons/fluent/weather-sunny-24-filled';
	import FluentMap24Regular from '~icons/fluent/map-24-regular';
	import FluentEarth24Regular from '~icons/fluent/earth-24-regular';
	import FluentEdit24Regular from '~icons/fluent/edit-24-regular';
	import FluentCheckmark24Regular from '~icons/fluent/checkmark-24-regular';
	import FluentDismiss24Regular from '~icons/fluent/dismiss-24-regular';
	import FluentArrowUndo24Regular from '~icons/fluent/arrow-undo-24-regular';
	import FluentDeleteDismiss24Regular from '~icons/fluent/delete-dismiss-24-regular';
	import FluentOptions24Regular from '~icons/fluent/options-24-regular';
	import FluentChevronDown24Regular from '~icons/fluent/chevron-down-24-regular';
	import FluentHome24Regular from '~icons/fluent/home-24-regular';
	import FluentArrowMove24Regular from '~icons/fluent/arrow-move-24-regular';
	import FluentArrowLeft24Regular from '~icons/fluent/arrow-left-24-regular';
	import FluentArrowRight24Regular from '~icons/fluent/arrow-right-24-regular';
	import FluentArrowUp24Regular from '~icons/fluent/arrow-up-24-regular';
	import FluentArrowDown24Regular from '~icons/fluent/arrow-down-24-regular';
	import FluentArrowReset24Regular from '~icons/fluent/arrow-reset-24-regular';
	import FluentPersonAdd24Regular from '~icons/fluent/person-add-24-regular';
	import FluentPerson24Regular from '~icons/fluent/person-24-regular';
	import FluentHistory24Regular from '~icons/fluent/history-24-regular';
	import FluentSettings24Regular from '~icons/fluent/settings-24-regular';
	import FluentImage24Regular from '~icons/fluent/image-24-regular';
	import FluentDocumentPdf24Regular from '~icons/fluent/document-pdf-24-regular';
	import FluentLocation24Filled from '~icons/fluent/location-24-filled';
	import FluentCheckmarkCircle24Regular from '~icons/fluent/checkmark-circle-24-regular';

	import { Badge, Button, IconButton } from '$lib/components/ui';
	import RoofCard from '$lib/components/RoofCard.svelte';
	import AddressInput, { type ResolvedAddress } from '$lib/components/AddressInput.svelte';
	import EconomicsPanel from '$lib/components/EconomicsPanel.svelte';
	import { computeEconomics } from '$lib/solar/economics';
	import { cachedYield, estimateYield, fetchYield, yieldKey } from '$lib/solar/yield';
	import { roofColor } from '$lib/solar/colors';
	import {
		DEFAULT_SETTINGS,
		facingAzimuth,
		layoutRoof,
		type LatLng,
		type PanelSettings,
		type Roof
	} from '$lib/solar/layout';
	import { persistedBranding } from '$lib/branding';
	import { visibleOrthophotos } from '$lib/map/imagery';
	import {
		archive,
		isEmptyProject,
		newProject,
		persistedHistory,
		persistedProject
	} from '$lib/projects';
	import { createPersistentState } from '$lib/utils/storeutils';
	import { canvasToBlob, downloadBlob, renderElement } from '$lib/utils/screenshot';
	import { compassLabel, formatEuro, formatNumber } from '$lib/utils/format';
	import { m } from '$lib/paraglide/messages';

	const STUTTGART: LatLng = [48.7758, 9.1829];
	const DEFAULT_PITCH = 35;
	/** CSS size and pixel ratio of exported map images, independent of the device. */
	const EXPORT_FRAME = { width: 1600, height: 1000, scale: 1.5 };
	const TILE_OPTIONS = { maxNativeZoom: 19, maxZoom: 22, crossOrigin: 'anonymous' as const };

	const [storedSettings, saveSettings] = createPersistentState<PanelSettings>(
		'solar-settings',
		DEFAULT_SETTINGS,
		JSON.stringify,
		(value) => ({ ...DEFAULT_SETTINGS, ...JSON.parse(value) })
	);
	const [storedProject, saveProject] = persistedProject();
	const [storedView, saveView] = createPersistentState<{ center: LatLng; zoom: number } | null>(
		'solar-view',
		null
	);

	let settings = $state(storedSettings);
	let project = $state(storedProject);
	let selectedId = $state<string | null>(null);

	$effect(() => saveSettings($state.snapshot(settings)));
	$effect(() => saveProject($state.snapshot(project)));

	const layouts = $derived(project.roofs.map((roof) => layoutRoof(roof, settings)));
	const totalPanels = $derived(layouts.reduce((sum, l) => sum + l.panels.length, 0));

	// Specific yield (kWh/kWp) per roof: PVGIS when reachable, otherwise a rough estimate.
	let fetchedYields = $state<Record<string, number>>({});
	const yieldKeys = $derived(
		project.roofs.map((roof, i) => yieldKey(layouts[i].center, roof.pitch, layouts[i].azimuth))
	);
	const roofYields = $derived(
		yieldKeys.map((key, i) => {
			const specific = fetchedYields[key] ?? cachedYield(key);
			return specific !== undefined
				? { specific, source: 'pvgis' as const }
				: {
						specific: estimateYield(project.roofs[i].pitch, layouts[i].azimuth),
						source: 'estimate' as const
					};
		})
	);

	$effect(() => {
		const missing = yieldKeys.filter(
			(key) => !(key in fetchedYields) && cachedYield(key) === undefined
		);
		if (missing.length === 0) return;
		// Debounced so dragging the pitch slider does not fire a request per degree.
		const timer = setTimeout(() => {
			for (const key of missing) {
				fetchYield(key).then((value) => {
					if (value !== null) fetchedYields[key] = value;
				});
			}
		}, 500);
		return () => clearTimeout(timer);
	});

	const totalKwp = $derived((totalPanels * settings.watts) / 1000);
	const annualProduction = $derived(
		layouts.reduce(
			(sum, l, i) => sum + ((l.panels.length * settings.watts) / 1000) * roofYields[i].specific,
			0
		)
	);
	const economicsResult = $derived(
		computeEconomics(annualProduction, totalKwp, totalPanels * settings.cost, project.economics)
	);

	const MAP_OPTIONS: L.MapOptions = {
		center: storedView?.center ?? storedProject.customer.location ?? STUTTGART,
		zoom: storedView?.zoom ?? (storedProject.customer.location ? 20 : 17),
		minZoom: 3,
		maxZoom: 22,
		zoomControl: false,
		// One canvas instead of thousands of SVG nodes keeps large arrays smooth.
		preferCanvas: true
	};

	let map: L.Map | undefined = $state();
	let mapElement: HTMLElement;
	let imageryLayer: L.TileLayer | undefined = $state();
	let streetLayer: L.TileLayer | undefined = $state();
	const orthophotoLayers: Record<string, L.TileLayer | undefined> = $state({});
	let mapType = $state<'satellite' | 'osm'>('satellite');

	let drawing = $state(false);
	let points = $state<LatLng[]>([]);

	let onboarding = $state(isEmptyProject(storedProject));
	let toast = $state<string | null>(null);
	let toastTimer: ReturnType<typeof setTimeout>;

	let exporting = $state<'png' | 'pdf' | null>(null);
	/** While capturing: plan-style labels, no selection, no customer pin. */
	let exportMode = $state(false);

	// Esri imagery and OSM are georeferenced independently and can disagree by a few metres,
	// differently from place to place. Like iD/JOSM, we let the user shift the imagery onto the
	// street map instead of guessing a correction.
	const ALIGN_STEP = 0.25;
	const [storedOffset, saveOffset] = createPersistentState('solar-imagery-offset', {
		east: 0,
		north: 0
	});
	let imageryOffset = $state(storedOffset);
	let aligning = $state(false);
	let imageryPane = $state<HTMLElement>();
	let view = $state({
		zoom: MAP_OPTIONS.zoom ?? 17,
		lat: STUTTGART[0],
		bounds: { south: 0, west: 0, north: 0, east: 0 }
	});
	// While aligning, only the global imagery shows: the official orthophotos are already exact.
	const orthophotos = $derived(aligning ? [] : visibleOrthophotos(view.bounds, view.zoom));

	$effect(() => saveOffset($state.snapshot(imageryOffset)));

	$effect(() => {
		if (!map || imageryPane) return;
		// Below the default tile pane, so the street overlay used for aligning sits on top.
		const pane = map.createPane('imagery');
		pane.style.zIndex = '150';
		// State orthophotos sit above the global imagery and are not shifted by the alignment.
		map.createPane('orthophotos').style.zIndex = '160';
		imageryPane = pane;
		updateView();
	});

	$effect(() => {
		if (!imageryPane) return;
		const metresPerPixel =
			(2 * Math.PI * 6378137 * Math.cos((view.lat * Math.PI) / 180)) / (256 * 2 ** view.zoom);
		const x = imageryOffset.east / metresPerPixel;
		const y = -imageryOffset.north / metresPerPixel;
		imageryPane.style.transform = `translate(${x}px, ${y}px)`;
	});

	// Arrow keys nudge the imagery while aligning instead of panning the map.
	$effect(() => {
		if (aligning) map?.keyboard.disable();
		else map?.keyboard.enable();
	});

	function updateView(zoom = map?.getZoom()) {
		if (!map || zoom === undefined) return;
		const center = map.getCenter();
		const bounds = map.getBounds();
		view = {
			zoom,
			lat: center.lat,
			bounds: {
				south: bounds.getSouth(),
				west: bounds.getWest(),
				north: bounds.getNorth(),
				east: bounds.getEast()
			}
		};
		if (!exportMode) saveView({ center: [center.lat, center.lng], zoom: map.getZoom() });
	}

	function nudgeImagery(east: number, north: number) {
		imageryOffset.east = Math.round((imageryOffset.east + east) * 100) / 100;
		imageryOffset.north = Math.round((imageryOffset.north + north) * 100) / 100;
	}

	function startAligning() {
		stopDrawing();
		mapType = 'satellite';
		aligning = true;
	}

	function showToast(message: string) {
		toast = message;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 3500);
	}

	function handleMapClick(e: L.LeafletMouseEvent) {
		if (drawing) points.push([e.latlng.lat, e.latlng.lng]);
	}

	/** Pointer position while drawing, to preview which way the roof will face. */
	let cursor = $state<LatLng | null>(null);

	function handleMouseMove(e: L.LeafletMouseEvent) {
		if (drawing && points.length >= 2) cursor = [e.latlng.lat, e.latlng.lng];
	}

	const EAVE_START_COLOR = '#ef4444';
	const EAVE_END_COLOR = '#22c55e';

	const drawingPreview = $derived.by(() => {
		if (!drawing || points.length < 2) return null;
		const eave: [LatLng, LatLng] = [points[0], points[1]];
		// Once the outline has a third point its centre decides the side; before that, the pointer.
		const inside: LatLng | null =
			points.length >= 3
				? [
						points.reduce((sum, p) => sum + p[0], 0) / points.length,
						points.reduce((sum, p) => sum + p[1], 0) / points.length
					]
				: cursor;
		const azimuth = inside ? facingAzimuth(eave, inside) : null;
		if (azimuth === null) return null;
		const midpoint: LatLng = [(eave[0][0] + eave[1][0]) / 2, (eave[0][1] + eave[1][1]) / 2];
		return { azimuth, midpoint };
	});

	function startDrawing() {
		aligning = false;
		onboarding = false;
		drawing = true;
		points = [];
		cursor = null;
		selectedId = null;
		map?.doubleClickZoom.disable();
	}

	function stopDrawing() {
		drawing = false;
		points = [];
		cursor = null;
		map?.doubleClickZoom.enable();
	}

	function finishDrawing() {
		if (points.length < 3) return;
		const roof: Roof = {
			id: crypto.randomUUID(),
			name: m.default_roof_name({ n: project.roofs.length + 1 }),
			outline: $state.snapshot(points),
			pitch: DEFAULT_PITCH
		};
		project.roofs.push(roof);
		selectedId = roof.id;
		stopDrawing();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement || onboarding) return;
		if (aligning) {
			const nudges: Record<string, [number, number]> = {
				ArrowLeft: [-ALIGN_STEP, 0],
				ArrowRight: [ALIGN_STEP, 0],
				ArrowUp: [0, ALIGN_STEP],
				ArrowDown: [0, -ALIGN_STEP]
			};
			if (e.key in nudges) {
				e.preventDefault();
				nudgeImagery(...nudges[e.key]);
			} else if (e.key === 'Escape' || e.key === 'Enter') aligning = false;
			return;
		}
		if (!drawing) return;
		if (e.key === 'Enter') finishDrawing();
		else if (e.key === 'Escape') stopDrawing();
		else if (e.key === 'Backspace') points.pop();
	}

	function handleFirstPointClick(e: L.LeafletMouseEvent) {
		// Closing the ring must not also add a point via the map click handler.
		L.DomEvent.stopPropagation(e);
		finishDrawing();
	}

	function deleteRoof(id: string) {
		project.roofs = project.roofs.filter((r) => r.id !== id);
		if (selectedId === id) selectedId = null;
	}

	function selectRoof(id: string) {
		if (drawing) return;
		selectedId = id;
	}

	function locateCustomer({ address, location }: ResolvedAddress) {
		project.customer.address = address;
		project.customer.location = location;
		map?.setView(location, 20);
	}

	function startNewCustomer() {
		const [history, saveHistory] = persistedHistory();
		const archived = !isEmptyProject(project);
		saveHistory(archive(history, $state.snapshot(project), $state.snapshot(settings)));
		stopDrawing();
		aligning = false;
		selectedId = null;
		project = newProject($state.snapshot(project.economics));
		onboarding = true;
		if (archived) showToast(m.archived_toast());
	}

	function startPlanning() {
		onboarding = false;
		if (project.customer.location) map?.setView(project.customer.location, 20);
	}

	function slug(value: string): string {
		return value
			.toLowerCase()
			.replace(/ä/g, 'ae')
			.replace(/ö/g, 'oe')
			.replace(/ü/g, 'ue')
			.replace(/ß/g, 'ss')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	function fileName(kind: string, extension: string): string {
		const date = new Date().toISOString().slice(0, 10);
		return [slug(project.customer.name), slug(kind), date].filter(Boolean).join('-') + extension;
	}

	async function waitForTiles() {
		await new Promise((r) => setTimeout(r, 150));
		const started = performance.now();
		const loading = () =>
			[imageryLayer, streetLayer, ...Object.values(orthophotoLayers)].some(
				(layer) => layer && map?.hasLayer(layer) && layer.isLoading()
			);
		while (loading() && performance.now() - started < 8000) {
			await new Promise((r) => setTimeout(r, 100));
		}
	}

	/** Frames all roofs, switches labels to plan style and renders the map to a canvas. */
	async function captureMap(): Promise<{ canvas: HTMLCanvasElement; credits: string[] }> {
		if (!map) throw new Error('Map not ready');
		const previous = { center: map.getCenter(), zoom: map.getZoom(), selected: selectedId };
		exportMode = true;
		selectedId = null;
		try {
			// Render into a fixed landscape frame so phones and desktops produce the same image.
			await tick();
			map.invalidateSize({ animate: false });
			const outline = project.roofs.flatMap((r) => r.outline);
			if (outline.length > 0) {
				map.fitBounds(L.latLngBounds(outline), { padding: [90, 90], maxZoom: 21, animate: false });
			}
			updateView();
			await tick();
			await waitForTiles();
			const canvas = await renderElement(mapElement, {
				width: EXPORT_FRAME.width,
				height: EXPORT_FRAME.height,
				scale: EXPORT_FRAME.scale
			});
			const credits = [...orthophotos.map((source) => source.attribution), 'Esri'].map(
				(html) => new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''
			);
			return { canvas, credits };
		} finally {
			exportMode = false;
			selectedId = previous.selected;
			await tick();
			map.invalidateSize({ animate: false });
			map.setView(previous.center, previous.zoom, { animate: false });
		}
	}

	async function runExport(kind: 'png' | 'pdf') {
		exporting = kind;
		try {
			const { canvas, credits } = await captureMap();
			if (kind === 'png') {
				downloadBlob(await canvasToBlob(canvas), fileName(m.export_png(), '.png'));
				return;
			}
			const { createProposalPdf } = await import('$lib/report/pdf');
			const [branding] = persistedBranding();
			const blob = createProposalPdf({
				branding,
				customer: $state.snapshot(project.customer),
				settings: $state.snapshot(settings),
				roofs: $state.snapshot(project.roofs),
				layouts,
				yields: roofYields,
				economics: $state.snapshot(project.economics),
				result: economicsResult,
				map: canvas,
				imageryCredits: credits
			});
			downloadBlob(blob, fileName(m.export_pdf(), '.pdf'));
		} catch (error) {
			console.error('Export failed:', error);
			alert(m.export_failed());
		} finally {
			exporting = null;
		}
	}

	const numberFields = [
		{ key: 'length', label: m.field_length, min: 0.3, max: 3, step: 0.01 },
		{ key: 'width', label: m.field_width, min: 0.3, max: 3, step: 0.01 },
		{ key: 'gap', label: m.field_gap, min: 0, max: 1, step: 0.01 },
		{ key: 'margin', label: m.field_margin, min: 0, max: 2, step: 0.05 },
		{ key: 'watts', label: m.field_power, min: 50, max: 1000, step: 5 },
		{ key: 'cost', label: m.field_cost, min: 0, max: 10000, step: 10 }
	] as const;
</script>

<svelte:head>
	<title>{project.customer.name ? `${project.customer.name} · ` : ''}{m.app_name()}</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="bg-neutral relative h-svh w-full overflow-hidden">
	<div
		class="absolute inset-0"
		class:cursor-crosshair={drawing}
		class:export-frame={exportMode}
		style:--export-width="{EXPORT_FRAME.width}px"
		style:--export-height="{EXPORT_FRAME.height}px"
		bind:this={mapElement}
	>
		<Map
			options={MAP_OPTIONS}
			onclick={handleMapClick}
			onmousemove={handleMouseMove}
			onzoomanim={(e: L.ZoomAnimEvent) => updateView(e.zoom)}
			onzoomend={() => updateView()}
			onmoveend={() => updateView()}
			bind:instance={map}
		>
			{#if mapType === 'satellite' && imageryPane}
				<TileLayer
					url={'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'}
					options={{ ...TILE_OPTIONS, pane: 'imagery', attribution: 'Tiles &copy; Esri' }}
					bind:instance={imageryLayer}
				/>
				{#each orthophotos as source (source.id)}
					{@const options = {
						...TILE_OPTIONS,
						maxNativeZoom: source.maxNativeZoom,
						bounds: source.bounds,
						pane: 'orthophotos',
						attribution: source.attribution
					}}
					{#if source.kind === 'wms'}
						<TileLayerWMS
							url={source.url}
							options={{
								...options,
								layers: source.layers ?? '',
								format: source.format ?? 'image/png',
								transparent: true,
								version: '1.3.0'
							}}
							bind:instance={orthophotoLayers[source.id]}
						/>
					{:else}
						<TileLayer url={source.url} {options} bind:instance={orthophotoLayers[source.id]} />
					{/if}
				{/each}
			{/if}
			{#if mapType === 'osm' || aligning}
				<TileLayer
					url={'https://tile.openstreetmap.org/{z}/{x}/{y}.png'}
					options={{
						...TILE_OPTIONS,
						opacity: aligning ? 0.55 : 1,
						attribution: '&copy; OpenStreetMap contributors'
					}}
					bind:instance={streetLayer}
				/>
			{/if}
			<ControlZoom options={{ position: 'topright' }} />
			<ControlScale options={{ imperial: false, maxWidth: 150, position: 'bottomright' }} />

			{#if project.customer.location && !exportMode}
				<Marker
					latLng={project.customer.location}
					options={{ interactive: false, keyboard: false }}
				>
					<DivIcon options={{ className: 'customer-pin', iconSize: [0, 0] }}>
						<div class="customer-pin-content"><FluentLocation24Filled /></div>
					</DivIcon>
				</Marker>
			{/if}

			{#each project.roofs as roof, i (roof.id)}
				{@const layout = layouts[i]}
				{@const selected = selectedId === roof.id}
				{@const color = roofColor(i)}
				<Polygon
					latLngs={roof.outline}
					options={{
						color,
						weight: selected ? 3.5 : 2,
						fillColor: color,
						fillOpacity: selected ? 0.22 : 0.1
					}}
					onclick={() => selectRoof(roof.id)}
				/>
				<!-- Leaflet treats nested rings as a MultiPolygon: one canvas layer for all modules of a roof. -->
				<Polygon
					latLngs={layout.panels as unknown as L.LatLngExpression[]}
					options={{
						color: '#a9c9ee',
						weight: 0.75,
						fillColor: '#16335c',
						fillOpacity: 0.92,
						interactive: false
					}}
				/>
				<Polyline
					latLngs={layout.eave}
					options={{ color: '#f97316', weight: 4, lineCap: 'round', interactive: false }}
				/>
				<Marker latLng={layout.center} options={{ interactive: false, keyboard: false }}>
					<DivIcon options={{ className: 'roof-label', iconSize: [0, 0] }}>
						<div
							class="roof-label-content"
							class:roof-label-selected={selected}
							style:--roof-color={color}
						>
							<span class="roof-label-number">{i + 1}</span>
							{roof.pitch}° ·
							<span class="roof-label-arrow" style:transform="rotate({layout.azimuth}deg)">↑</span>
							{#if exportMode}
								{compassLabel(layout.azimuth)} ·
								{m.plan_label_area({ area: formatNumber(layout.roofArea, 1) })}
							{:else}
								{layout.panels.length}
							{/if}
						</div>
					</DivIcon>
				</Marker>
			{/each}

			{#if drawing}
				{#if points.length >= 3}
					<Polygon
						latLngs={points}
						options={{
							color: '#e6a527',
							weight: 2,
							fillColor: '#e6a527',
							fillOpacity: 0.12,
							dashArray: '6, 8',
							interactive: false
						}}
					/>
				{:else if points.length === 2}
					<Polyline latLngs={points} options={{ color: '#e6a527', interactive: false }} />
				{/if}
				{#if points.length >= 2}
					<Polyline
						latLngs={points.slice(0, 2)}
						options={{ color: '#f97316', weight: 4, lineCap: 'round', interactive: false }}
					/>
				{/if}
				{#each points as point, index (index)}
					<CircleMarker
						latLng={point}
						options={{
							radius: index < 2 ? 7 : 5,
							fillColor: index === 0 ? EAVE_START_COLOR : index === 1 ? EAVE_END_COLOR : '#e6a527',
							color: '#fff7e8',
							weight: 2,
							fillOpacity: 1,
							interactive: index === 0
						}}
						onclick={index === 0 ? handleFirstPointClick : undefined}
					/>
				{/each}
				{#if drawingPreview}
					<Marker
						latLng={drawingPreview.midpoint}
						options={{ interactive: false, keyboard: false }}
					>
						<DivIcon options={{ className: 'roof-label', iconSize: [0, 0] }}>
							<div class="facing-preview" data-testid="facing-preview-marker">
								<span
									class="facing-preview-arrow"
									style:transform="rotate({drawingPreview.azimuth}deg)">↑</span
								>
								{compassLabel(drawingPreview.azimuth)}
							</div>
						</DivIcon>
					</Marker>
				{/if}
			{/if}
		</Map>
	</div>

	<aside
		class="panel absolute inset-x-2 bottom-2 z-[1000] flex max-h-[42svh] flex-col overflow-y-auto overscroll-contain backdrop-blur-md md:inset-x-auto md:top-3 md:bottom-3 md:left-3 md:max-h-none md:w-[22rem] md:overflow-hidden"
		data-testid="sidebar"
	>
		<header
			class="border-base-content/10 border-b bg-linear-to-br from-amber-500/20 via-rose-500/10 to-sky-500/15 p-4"
		>
			<div class="flex items-center gap-3">
				<div
					class="bg-primary/15 text-primary grid size-10 shrink-0 place-items-center rounded-full"
				>
					<FluentWeatherSunny24Filled class="size-5" />
				</div>
				<div class="min-w-0 flex-1">
					<h1 class="text-base-content text-xl leading-tight">{m.app_name()}</h1>
					<p class="text-base-content/60 text-xs">{m.app_tagline()}</p>
				</div>
				<Button
					href={resolve('/history')}
					shape="circle"
					variant="subtle"
					size="sm"
					icon={FluentHistory24Regular}
					aria-label={m.history()}
					title={m.history()}
				/>
				<Button
					href={resolve('/settings')}
					shape="circle"
					variant="subtle"
					size="sm"
					icon={FluentSettings24Regular}
					aria-label={m.settings()}
					title={m.settings()}
				/>
			</div>

			<div class="mt-4 space-y-2">
				<div class="flex items-center justify-between">
					<span class="field-label mb-0!">{m.customer_title()}</span>
					<Button
						size="xs"
						variant="soft-amber"
						icon={FluentPersonAdd24Regular}
						onclick={startNewCustomer}
					>
						{m.new_customer()}
					</Button>
				</div>
				<div class="relative">
					<FluentPerson24Regular
						class="text-base-content/50 pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
					/>
					<input
						type="text"
						autocomplete="name"
						placeholder={m.customer_name_placeholder()}
						aria-label={m.customer_name()}
						class="field-control w-full rounded-full py-2 pr-4 pl-10 text-sm"
						bind:value={project.customer.name}
					/>
				</div>
				<AddressInput
					bind:value={project.customer.address}
					placeholder={m.customer_address_placeholder()}
					onresolve={locateCustomer}
				/>
			</div>

			<div class="mt-3 flex gap-1.5">
				<Button
					size="xs"
					grow
					variant={mapType === 'satellite' ? 'primary' : 'subtle'}
					icon={FluentEarth24Regular}
					onclick={() => (mapType = 'satellite')}
				>
					{m.map_satellite()}
				</Button>
				<Button
					size="xs"
					grow
					variant={mapType === 'osm' ? 'primary' : 'subtle'}
					icon={FluentMap24Regular}
					onclick={() => {
						mapType = 'osm';
						aligning = false;
					}}
				>
					{m.map_street()}
				</Button>
				<IconButton
					icon={FluentArrowMove24Regular}
					label={m.align_imagery_tooltip()}
					variant={aligning ? 'soft-amber' : 'subtle'}
					size="xs"
					onclick={() => (aligning ? (aligning = false) : startAligning())}
				/>
			</div>
		</header>

		<div class="space-y-4 p-4 md:flex-1 md:overflow-y-auto">
			<Button
				block
				variant={drawing ? 'soft-amber' : 'primary'}
				icon={FluentEdit24Regular}
				disabled={drawing}
				onclick={startDrawing}
			>
				{drawing ? m.drawing() : m.draw_roof()}
			</Button>

			<details class="panel-muted group p-3">
				<summary class="flex cursor-pointer list-none items-center gap-2.5 select-none">
					<FluentOptions24Regular class="text-primary size-4" />
					<span class="flex-1">
						<span class="editorial-title text-base-content block text-base">{m.module_title()}</span
						>
						<span class="text-base-content/55 block text-xs tabular-nums">
							{formatNumber(settings.length, 2)} × {formatNumber(settings.width, 2)} m ·
							{settings.watts} Wp · {formatEuro(settings.cost)}
						</span>
					</span>
					<FluentChevronDown24Regular
						class="text-base-content/50 size-4 transition-transform group-open:rotate-180"
					/>
				</summary>

				<div class="mt-3 grid grid-cols-2 gap-x-2 gap-y-3">
					{#each numberFields as field (field.key)}
						<label class="block">
							<span class="field-label">{field.label()}</span>
							<input
								type="number"
								class="field-control w-full rounded-full px-3 py-1.5 text-sm tabular-nums"
								min={field.min}
								max={field.max}
								step={field.step}
								bind:value={settings[field.key]}
							/>
						</label>
					{/each}
					<div class="col-span-2">
						<span class="field-label">{m.orientation()}</span>
						<div class="flex gap-1.5">
							<Button
								size="xs"
								grow
								variant={settings.orientation === 'portrait' ? 'soft-amber' : 'subtle'}
								onclick={() => (settings.orientation = 'portrait')}
							>
								{m.portrait()}
							</Button>
							<Button
								size="xs"
								grow
								variant={settings.orientation === 'landscape' ? 'soft-amber' : 'subtle'}
								onclick={() => (settings.orientation = 'landscape')}
							>
								{m.landscape()}
							</Button>
						</div>
						<p class="field-hint">
							{settings.orientation === 'portrait' ? m.portrait_hint() : m.landscape_hint()}
						</p>
					</div>
				</div>
			</details>

			{#if project.roofs.length > 0}
				<EconomicsPanel
					bind:economics={project.economics}
					result={economicsResult}
					estimated={roofYields.some((y) => y.source === 'estimate')}
				/>
			{/if}

			{#if project.roofs.length === 0}
				<div class="panel-muted fade_in p-8 text-center">
					<FluentHome24Regular class="text-base-content/25 mx-auto size-8" />
					<h3 class="editorial-title text-base-content mt-3 text-lg">{m.empty_title()}</h3>
					<p class="text-base-content/60 mt-1.5 text-sm">{m.empty_hint()}</p>
				</div>
			{:else}
				<div>
					<div class="mb-2 flex items-center gap-2">
						<h2 class="section-title text-base">{m.roofs_title()}</h2>
						<Badge tone="neutral" size="xs">{project.roofs.length}</Badge>
						<IconButton
							icon={FluentDeleteDismiss24Regular}
							label={m.remove_all_roofs()}
							variant="soft-red"
							size="xs"
							class="ml-auto"
							onclick={() => {
								project.roofs = [];
								selectedId = null;
							}}
						/>
					</div>
					<div class="space-y-2">
						{#each project.roofs as roof, i (roof.id)}
							<RoofCard
								bind:roof={project.roofs[i]}
								number={i + 1}
								color={roofColor(i)}
								layout={layouts[i]}
								{settings}
								selected={selectedId === roof.id}
								onselect={() => (selectedId = roof.id)}
								ondelete={() => deleteRoof(roof.id)}
							/>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		{#if project.roofs.length > 0}
			<footer
				class="border-base-content/10 border-t bg-linear-to-r from-sky-500/12 via-amber-500/12 to-emerald-500/12 px-4 py-3"
				data-testid="totals"
			>
				<div class="grid grid-cols-3">
					<div>
						<div class="editorial-title text-2xl text-sky-300 tabular-nums">
							{formatNumber(totalPanels)}
						</div>
						<div class="text-base-content/55 text-[0.65rem] tracking-wide uppercase">
							{m.stat_modules()}
						</div>
					</div>
					<div class="text-center">
						<div class="editorial-title text-2xl text-amber-300 tabular-nums">
							{formatNumber(totalKwp, 1)}
						</div>
						<div class="text-base-content/55 text-[0.65rem] tracking-wide uppercase">
							{m.stat_kwp()}
						</div>
					</div>
					<div class="text-right">
						<div class="editorial-title text-2xl text-emerald-300 tabular-nums">
							{formatEuro(totalPanels * settings.cost)}
						</div>
						<div class="text-base-content/55 text-[0.65rem] tracking-wide uppercase">
							{m.stat_cost()}
						</div>
					</div>
				</div>
				<div class="mt-3 flex gap-1.5">
					<Button
						size="sm"
						grow
						variant="subtle"
						icon={FluentImage24Regular}
						title={m.export_png_tooltip()}
						loading={exporting === 'png'}
						disabled={exporting !== null}
						onclick={() => runExport('png')}
					>
						{m.export_png()}
					</Button>
					<Button
						size="sm"
						grow
						icon={FluentDocumentPdf24Regular}
						title={m.export_pdf_tooltip()}
						loading={exporting === 'pdf'}
						disabled={exporting !== null}
						onclick={() => runExport('pdf')}
					>
						{m.export_pdf()}
					</Button>
				</div>
			</footer>
		{/if}
	</aside>

	{#if onboarding}
		<div
			class="fade_in bg-neutral/45 absolute inset-0 z-[1500] grid place-items-center overflow-y-auto p-4 backdrop-blur-[2px] md:pl-[23.5rem]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="onboarding-title"
		>
			<form
				class="panel bg-base-100! w-full max-w-md p-6"
				onsubmit={(e) => {
					e.preventDefault();
					startPlanning();
				}}
			>
				<div class="mb-4 flex items-center gap-3">
					<div class="bg-primary/15 text-primary grid size-11 place-items-center rounded-full">
						<FluentPersonAdd24Regular class="size-5" />
					</div>
					<div>
						<h2 id="onboarding-title" class="text-base-content text-2xl leading-tight">
							{m.new_customer()}
						</h2>
						<p class="text-base-content/60 text-sm">{m.new_customer_intro()}</p>
					</div>
				</div>

				<label class="mb-3 block">
					<span class="field-label">{m.customer_name()}</span>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						type="text"
						autocomplete="name"
						autofocus
						placeholder={m.customer_name_placeholder()}
						class="field-control w-full rounded-full px-4 py-2 text-sm"
						bind:value={project.customer.name}
					/>
				</label>
				<div class="mb-2">
					<span class="field-label">{m.customer_address()}</span>
					<AddressInput
						bind:value={project.customer.address}
						placeholder={m.customer_address_placeholder()}
						onresolve={locateCustomer}
					/>
				</div>
				{#if project.customer.location}
					<p class="field-hint text-success! flex items-center gap-1.5">
						<FluentCheckmarkCircle24Regular class="size-4" />
						{project.customer.address}
					</p>
				{/if}
				<p class="field-hint">{m.customer_privacy()}</p>

				<div class="mt-5 flex justify-end gap-2">
					<Button type="button" variant="ghost" onclick={() => (onboarding = false)}>
						{m.skip()}
					</Button>
					<Button type="submit" icon={FluentEdit24Regular}>{m.start_planning()}</Button>
				</div>
			</form>
		</div>
	{/if}

	{#if drawing}
		<div
			class="panel fade_in absolute top-3 left-1/2 z-[1000] flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-wrap items-center gap-3 py-2 pr-2 pl-4 backdrop-blur-md md:left-[calc(50%+11.75rem)] md:flex-nowrap"
		>
			<Badge tone={points.length < 2 ? 'orange' : 'amber'} size="sm">
				{points.length < 2 ? m.step_eave() : m.step_outline()}
			</Badge>
			<span class="text-base-content/80 flex items-center gap-1.5 text-sm md:whitespace-nowrap">
				{#if points.length < 2}
					<span class="size-2.5 rounded-full" style:background-color={EAVE_START_COLOR}></span>
					<span class="text-base-content/40">→</span>
					<span class="size-2.5 rounded-full" style:background-color={EAVE_END_COLOR}></span>
				{/if}
				{points.length < 2 ? m.hint_eave() : m.hint_outline()}
			</span>
			{#if drawingPreview}
				<Badge tone="green" size="sm">
					<span
						class="inline-block"
						style:transform="rotate({drawingPreview.azimuth}deg)"
						data-testid="facing-preview-arrow">↑</span
					>
					<span data-testid="facing-preview">
						{m.facing_preview({
							direction: compassLabel(drawingPreview.azimuth),
							degrees: drawingPreview.azimuth.toFixed(0)
						})}
					</span>
				</Badge>
			{/if}
			<div class="flex items-center gap-1">
				<IconButton
					icon={FluentArrowUndo24Regular}
					label={m.undo_point()}
					variant="subtle"
					size="sm"
					disabled={points.length === 0}
					onclick={() => points.pop()}
				/>
				<IconButton
					icon={FluentDismiss24Regular}
					label={m.cancel_esc()}
					variant="subtle"
					size="sm"
					onclick={stopDrawing}
				/>
				<Button
					size="sm"
					variant="success"
					icon={FluentCheckmark24Regular}
					disabled={points.length < 3}
					onclick={finishDrawing}
				>
					{m.finish()}
				</Button>
			</div>
		</div>
	{/if}

	{#if aligning}
		<div
			class="panel fade_in absolute top-3 left-1/2 z-[1000] flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-wrap items-center gap-3 py-2 pr-2 pl-4 backdrop-blur-md md:left-[calc(50%+11.75rem)] md:flex-nowrap"
		>
			<Badge tone="amber" size="sm">{m.align_title()}</Badge>
			<span class="text-base-content/80 text-sm md:whitespace-nowrap">{m.align_hint()}</span>
			<div class="flex items-center gap-1">
				<IconButton
					icon={FluentArrowLeft24Regular}
					label={m.shift_west()}
					variant="subtle"
					size="sm"
					onclick={() => nudgeImagery(-ALIGN_STEP, 0)}
				/>
				<IconButton
					icon={FluentArrowUp24Regular}
					label={m.shift_north()}
					variant="subtle"
					size="sm"
					onclick={() => nudgeImagery(0, ALIGN_STEP)}
				/>
				<IconButton
					icon={FluentArrowDown24Regular}
					label={m.shift_south()}
					variant="subtle"
					size="sm"
					onclick={() => nudgeImagery(0, -ALIGN_STEP)}
				/>
				<IconButton
					icon={FluentArrowRight24Regular}
					label={m.shift_east()}
					variant="subtle"
					size="sm"
					onclick={() => nudgeImagery(ALIGN_STEP, 0)}
				/>
			</div>
			<span class="text-base-content/70 w-24 text-center text-xs tabular-nums">
				E {formatNumber(imageryOffset.east, 2)} m<br />N {formatNumber(imageryOffset.north, 2)} m
			</span>
			<IconButton
				icon={FluentArrowReset24Regular}
				label={m.reset_offset()}
				variant="subtle"
				size="sm"
				disabled={imageryOffset.east === 0 && imageryOffset.north === 0}
				onclick={() => (imageryOffset = { east: 0, north: 0 })}
			/>
			<Button
				size="sm"
				variant="success"
				icon={FluentCheckmark24Regular}
				onclick={() => (aligning = false)}
			>
				{m.done()}
			</Button>
		</div>
	{/if}

	{#if toast}
		<div
			class="panel fade_in text-base-content/85 absolute top-3 left-1/2 z-[1600] flex -translate-x-1/2 items-center gap-2 px-4 py-2 text-sm backdrop-blur-md md:left-[calc(50%+11.75rem)]"
			role="status"
		>
			<FluentCheckmarkCircle24Regular class="text-success size-4" />
			{toast}
		</div>
	{/if}
</div>

<style>
	.export-frame {
		position: fixed;
		inset: auto;
		top: 0;
		left: 0;
		width: var(--export-width);
		height: var(--export-height);
	}

	:global(.roof-label),
	:global(.customer-pin) {
		pointer-events: none;
	}

	.roof-label-content {
		display: flex;
		width: max-content;
		transform: translate(-50%, -50%);
		align-items: center;
		gap: 0.3rem;
		border: 1px solid color-mix(in oklab, var(--color-base-content) 15%, transparent);
		border-radius: 9999px;
		background: color-mix(in oklab, var(--color-base-100) 88%, transparent);
		box-shadow: 0 6px 16px rgba(2, 10, 21, 0.35);
		padding: 0.15rem 0.6rem 0.15rem 0.2rem;
		font-family: var(--font-sans);
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-base-content);
		white-space: nowrap;
	}

	.roof-label-selected {
		border-color: var(--roof-color);
		box-shadow:
			0 0 0 2px color-mix(in oklab, var(--roof-color) 45%, transparent),
			0 6px 16px rgba(2, 10, 21, 0.35);
	}

	.roof-label-number {
		display: grid;
		width: 1.25rem;
		height: 1.25rem;
		place-items: center;
		border-radius: 9999px;
		background: var(--roof-color, var(--color-primary));
		color: #0e1d2f;
		font-size: 0.7rem;
		font-weight: 700;
	}

	.facing-preview {
		display: flex;
		width: max-content;
		transform: translate(-50%, 0.6rem);
		align-items: center;
		gap: 0.3rem;
		border-radius: 9999px;
		background: #22c55e;
		box-shadow: 0 6px 16px rgba(2, 10, 21, 0.4);
		padding: 0.15rem 0.6rem;
		font-family: var(--font-sans);
		font-size: 0.8rem;
		font-weight: 700;
		color: #06240f;
		white-space: nowrap;
	}

	.facing-preview-arrow {
		display: inline-block;
		font-size: 1rem;
		line-height: 1;
	}

	.roof-label-arrow {
		display: inline-block;
		color: var(--color-primary);
	}

	.customer-pin-content {
		width: 2rem;
		height: 2rem;
		transform: translate(-50%, -100%);
		color: var(--color-primary);
		filter: drop-shadow(0 4px 6px rgba(2, 10, 21, 0.5));
	}

	.customer-pin-content :global(svg) {
		width: 100%;
		height: 100%;
	}
</style>
