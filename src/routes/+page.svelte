<script lang="ts">
	import { Map, TileLayer, Polygon, Popup } from 'sveaflet';
	import { onMount } from 'svelte';
	import L from 'leaflet';

	interface DrawnPolygon {
		id: string;
		coordinates: [number, number][];
		area: number;

		name: string;
	}

	let polygons = $state<DrawnPolygon[]>([]);
	let isDrawing = $state(false);
	let selectedColor = $state('#3b82f6');
	let mapInstance: L.Map;
	let drawingPoints = $state<[number, number][]>([]);
	let polygonCounter = $state(1);

	function handleMapClick(e: any) {
		if (isDrawing) {
			const point: [number, number] = [e.latlng.lat, e.latlng.lng];
			drawingPoints = [...drawingPoints, point];
		}
	}

	function startDrawing() {
		isDrawing = true;
		drawingPoints = [];
		mapInstance.doubleClickZoom.disable();
	}

	function finishPolygon() {
		if (isDrawing && drawingPoints.length >= 3) {
			const area = calculatePolygonArea(drawingPoints);

			const newPolygon: DrawnPolygon = {
				id: `polygon_${Date.now()}`,
				coordinates: [...drawingPoints],
				area: area,

				name: `Polygon ${polygonCounter}`
			};

			polygons = [...polygons, newPolygon];
			polygonCounter++;

			// Reset drawing state
			isDrawing = false;
			drawingPoints = [];
			mapInstance.doubleClickZoom.enable();
		}
	}

	function cancelDrawing() {
		isDrawing = false;
		drawingPoints = [];
		mapInstance.doubleClickZoom.enable();
	}

	function calculatePolygonArea(coords: [number, number][]): number {
		// Simple area calculation using shoelace formula (approximate)
		if (coords.length < 3) return 0;

		let area = 0;
		for (let i = 0; i < coords.length; i++) {
			const j = (i + 1) % coords.length;
			area += coords[i][0] * coords[j][1];
			area -= coords[j][0] * coords[i][1];
		}
		return Math.abs(area / 2) * 111.32 * 111.32; // Rough conversion to km²
	}

	function deletePolygon(id: string) {
		polygons = polygons.filter((p) => p.id !== id);
	}

	function clearAllPolygons() {
		polygons = [];
		polygonCounter = 1;
	}

	function formatArea(area: number): string {
		if (area < 1) {
			return `${(area * 1000000).toFixed(0)} m²`;
		}
		return `${area.toFixed(2)} km²`;
	}
</script>

<div class="bg-base-100 flex h-screen flex-col">
	<!-- Header -->
	<div class="navbar bg-primary text-primary-content shadow-lg">
		<div class="flex-1">
			<h1 class="text-xl font-bold">Polygon Drawing Map</h1>
		</div>
		<div class="flex-none gap-2">
			{#if !isDrawing}
				<button class="btn btn-accent" onclick={startDrawing}>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
						/>
					</svg>
					Draw Polygon
				</button>
			{:else}
				<button class="btn btn-success" onclick={finishPolygon} disabled={drawingPoints.length < 3}>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 13l4 4L19 7"
						/>
					</svg>
					Finish ({drawingPoints.length} points)
				</button>
				<button class="btn btn-ghost" onclick={cancelDrawing}> Cancel </button>
			{/if}

			<button class="btn btn-ghost" onclick={clearAllPolygons} disabled={polygons.length === 0}>
				Clear All
			</button>
		</div>
	</div>

	<div class="flex flex-1 overflow-hidden">
		<!-- Map Container -->
		<div class="relative flex-1">
			<Map
				options={{
					center: [51.505, -0.09],
					zoom: 13
				}}
				style="width:100%;height:100%;"
				onclick={handleMapClick}
			>
				<TileLayer url={'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} />

				<!-- Render completed polygons -->
				{#each polygons as polygon}
					<Polygon
						latLngs={polygon.coordinates}
						options={{
							color: '#3b82f6',
							weight: 2,
							opacity: 0.8,
							fillOpacity: 0.4
						}}
					>
						<Popup>
							<div class="p-2">
								<h3 class="font-semibold">{polygon.name}</h3>
								<p class="text-sm">Area: {formatArea(polygon.area)}</p>
								<p class="text-sm">Points: {polygon.coordinates.length}</p>
								<button class="btn btn-error btn-xs mt-2" onclick={() => deletePolygon(polygon.id)}>
									Delete
								</button>
							</div>
						</Popup>
					</Polygon>
				{/each}

				<!-- Render current drawing polygon -->
				{#if isDrawing && drawingPoints.length >= 3}
					<Polygon
						latLngs={drawingPoints}
						options={{
							color: '#3b82f6',
							weight: 2,
							opacity: 0.6,
							fillOpacity: 0.2,
							dashArray: '5, 10'
						}}
					/>
				{/if}
			</Map>

			<!-- Drawing Status -->
			{#if isDrawing}
				<div class="absolute top-4 left-4 z-[1000]">
					<div class="alert alert-info max-w-md shadow-lg">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							class="h-6 w-6 shrink-0 stroke-current"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
						<div>
							<div class="font-bold">Drawing Mode Active</div>
							<div class="text-sm">
								Click to add points ({drawingPoints.length} added)
								<br />Double-click or use "Finish" button when done (min 3 points)
							</div>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Sidebar -->
		<div class="bg-base-200 w-80 overflow-y-auto border-l p-4">
			<h2 class="mb-4 text-lg font-semibold">Drawn Polygons ({polygons.length})</h2>

			{#if polygons.length === 0}
				<div class="text-base-content/60 mt-8 text-center">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="mx-auto mb-4 h-12 w-12 opacity-50"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2l6 3 5.447-2.724A1 1 0 0121 3.382v10.764a1 1 0 01-.553.894L15 18l-6-3z"
						/>
					</svg>
					<p>No polygons drawn yet.</p>
					<p class="mt-2 text-sm">Click "Draw Polygon" to start creating shapes.</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each polygons as polygon, index}
						<div class="card bg-base-100 compact shadow">
							<div class="card-body">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-3">
										<div
											class="h-4 w-4 rounded border border-gray-300"
											style="background-color: #3b82f6"
										></div>
										<div class="flex-1">
											<h3 class="font-medium">{polygon.name}</h3>
											<p class="text-base-content/70 text-sm">
												Area: {formatArea(polygon.area)}
											</p>
											<p class="text-base-content/50 text-xs">
												Points: {polygon.coordinates.length}
											</p>
										</div>
									</div>
									<button class="btn btn-error btn-xs" onclick={() => deletePolygon(polygon.id)}>
										Delete
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Statistics -->
			{#if polygons.length > 0}
				<div class="bg-accent/10 mt-4 rounded-lg p-4">
					<h3 class="mb-2 font-semibold">Statistics:</h3>
					<div class="space-y-1 text-sm">
						<p>Total Polygons: {polygons.length}</p>
						<p>Total Area: {formatArea(polygons.reduce((sum, p) => sum + p.area, 0))}</p>
						<p>
							Average Area: {formatArea(
								polygons.reduce((sum, p) => sum + p.area, 0) / polygons.length
							)}
						</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
	}
</style>
