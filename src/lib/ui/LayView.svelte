<script lang="ts">
	import {
		LAY_TOLERANCE, appliedVariation, buildCourse, labelBearing, trueToCourse, distanceBetween, dropOffset, formatBearing, formatCoordinate,
		formatDistance, fromLatLon, guide, layTable, leg, metresPerDegree, parseCoordinate, signal,
		type CourseSpec, type DistanceUnit, type Vec,
	} from '../geo'
	import { GPS_MESSAGES, ping, watch, type Fix, type GpsError } from '../gps'

	let {
		spec, unit = 'nm',
		refLat = $bindable(''), refLon = $bindable(''),
		laid = $bindable({}), depth = $bindable(10), warp = $bindable(20), variation = null,
		gpsWatch = watch, gpsPing = ping,
	}: {
		spec: CourseSpec
		unit?: DistanceUnit
		refLat?: string
		refLon?: string
		laid?: Record<string, Vec>
		depth?: number
		warp?: number
		/** Magnetic variation at the reference, degrees east; null if unknown. */
		variation?: number | null
		gpsWatch?: typeof watch
		gpsPing?: typeof ping
	} = $props()

	let selected = $state('1')
	let from = $state('Reference')
	let fix = $state<Fix | null>(null)
	let gpsError = $state<GpsError | null>(null)
	let stop: (() => void) | null = null
	let guiding = $state(false)

	let course = $derived(buildCourse(spec))
	let rows = $derived(layTable(course))
	let lat = $derived(parseCoordinate(refLat, 'lat'))
	let lon = $derived(parseCoordinate(refLon, 'lon'))
	let reference = $derived(lat.ok && lon.ok ? { lat: lat.value, lon: lon.value } : null)

	// Points a mark can be laid from: the reference, then every other mark.
	let origins = $derived<Record<string, Vec>>({
		Reference: course.points.ref,
		...Object.fromEntries(rows.map((r) => [r.mark, r.position])),
	})
	let row = $derived(rows.find((r) => r.mark === selected) ?? rows[0])
	let origin = $derived(origins[from] && from !== row.mark ? origins[from] : course.points.ref)
	let originName = $derived(origins[from] && from !== row.mark ? from : 'Reference')
	let instruction = $derived(leg(origin, row.position))
	let anchorRun = $derived(dropOffset(depth, warp))
	// GPS positions are true; turn them into the course's north.
	let applied = $derived(appliedVariation(spec.north, variation))
	let boat = $derived(reference && fix ? trueToCourse(fromLatLon(reference, fix.position), applied) : null)
	let live = $derived(guiding && boat ? guide(origin, row.position, boat) : null)

	function laidStatus(mark: string, planned: Vec): { text: string; ok: boolean } | null {
		const p = laid[mark]
		if (!p) return null
		const off = distanceBetween(p, planned)
		return { text: `laid, ${Math.round(off)} m off`, ok: off <= LAY_TOLERANCE }
	}

	async function pingReference() {
		gpsError = null
		try {
			const f = await gpsPing()
			refLat = formatCoordinate(f.position.lat, 'lat')
			refLon = formatCoordinate(f.position.lon, 'lon')
			laid = {}
		} catch (e) {
			gpsError = e as GpsError
		}
	}

	function startGuiding() {
		gpsError = null
		guiding = true
		stop = gpsWatch((f) => (fix = f), (e) => (gpsError = e))
		// Keep the screen on while streaming a mark; not every browser allows it.
		navigator.wakeLock?.request('screen').catch(() => {})
	}

	function stopGuiding() {
		stop?.()
		stop = null
		guiding = false
		fix = null
	}

	async function markLaid() {
		if (!reference) return
		gpsError = null
		try {
			const f = fix ?? (await gpsPing())
			laid = { ...laid, [row.mark]: trueToCourse(fromLatLon(reference, f.position), applied) }
		} catch (e) {
			gpsError = e as GpsError
		}
	}

	$effect(() => () => stop?.())
</script>

<div class="lay">
	<section class="ref">
		<h2>Reference point · {signal(spec)} axis {labelBearing(spec.axis, spec.north)}</h2>
		<div class="pair">
			<label>
				Latitude
				<input type="text" placeholder="N 50° 35.212'" bind:value={refLat} aria-invalid={refLat !== '' && !lat.ok} />
				{#if refLat !== '' && !lat.ok}<span class="error">{lat.error}</span>{/if}
			</label>
			<label>
				Longitude
				<input type="text" placeholder="W 002° 26.874'" bind:value={refLon} aria-invalid={refLon !== '' && !lon.ok} />
				{#if refLon !== '' && !lon.ok}<span class="error">{lon.error}</span>{/if}
			</label>
		</div>
		<button type="button" class="primary" onclick={pingReference}>Ping reference here</button>
		{#if !reference}
			<p class="hint">Bearings and distances work without a position. Live guidance needs the reference.</p>
		{/if}
	</section>

	<section>
		<h2>Marks</h2>
		<div class="marks">
			{#each rows as r (r.mark)}
				{@const status = laidStatus(r.mark, r.position)}
				<button
					type="button" class="mark" class:laid={status?.ok} class:off={status && !status.ok}
					aria-pressed={r.mark === row.mark}
					aria-label="Mark {r.mark}{status ? `, ${status.text}` : ''}"
					onclick={() => { selected = r.mark; stopGuiding() }}
				>{r.mark}</button>
			{/each}
		</div>
	</section>

	<section class="instruction" data-testid="instruction">
		<div class="head">
			<h2>Mark {row.mark}</h2>
			<label class="from">
				Lay from
				<select bind:value={from}>
					{#each Object.keys(origins).filter((o) => o !== row.mark) as o (o)}
						<option value={o}>{o}</option>
					{/each}
				</select>
			</label>
		</div>
		{#if laidStatus(row.mark, row.position)}
			{@const status = laidStatus(row.mark, row.position)!}
			<p class="status" class:ok={status.ok}>{status.text}</p>
		{/if}
		<p class="caption">From {originName.toLowerCase()} · {spec.north}</p>
		<p class="huge" data-testid="bearing">{formatBearing(instruction.bearing)}</p>
		<p class="large" data-testid="distance">{formatDistance(instruction.distance, unit)}</p>
		<div class="gps" data-testid="gps-reads">
			<span>Your GPS reads<br /><small>GoTo {originName.toLowerCase()}, drive away</small></span>
			<strong>{formatBearing(instruction.reciprocal)}</strong>
		</div>

		<div class="facts">
			<div>
				<h3>Drop anchor</h3>
				<p class="fact" data-testid="drop">{Math.round(anchorRun)} m upwind or up-tide</p>
				<div class="pair">
					<label>Depth (m)<input type="number" min="1" max="200" bind:value={depth} /></label>
					<label>Warp (m)<input type="number" min="1" max="500" bind:value={warp} /></label>
				</div>
			</div>
			<div>
				<h3>Tolerance</h3>
				<p class="fact">±1° · ±{LAY_TOLERANCE} m</p>
				<p class="hint">1° here is {Math.round(metresPerDegree(instruction.distance))} m</p>
			</div>
		</div>

		{#if gpsError}<p class="error" role="alert">{GPS_MESSAGES[gpsError]}</p>{/if}

		{#if live}
			<div class="live" class:on-station={live.onStation} data-testid="live">
				<div>
					<h3>To run</h3>
					<p class="huge small">{Math.round(live.toRun)} m</p>
				</div>
				<div>
					<h3>Off line</h3>
					<p class="huge small">{Math.round(live.offLine)} m</p>
					<p class="steer">
						{#if live.onStation}On station: drop
						{:else if live.steer === 'hold'}On the line
						{:else}{live.side} of line, steer {live.steer}{/if}
					</p>
				</div>
				<p class="now">
					To {originName.toLowerCase()} now {formatBearing(live.bearingToOrigin)} · {formatDistance(live.distanceToOrigin, unit)}
					{#if fix}· GPS ±{Math.round(fix.accuracy)} m{/if}
				</p>
			</div>
		{:else if guiding}
			<p class="hint" role="status">Waiting for a GPS fix…</p>
		{/if}

		<div class="actions">
			{#if guiding}
				<button type="button" onclick={stopGuiding}>Stop guidance</button>
			{:else}
				<button type="button" class="primary" disabled={!reference} onclick={startGuiding}>Guide me with phone GPS</button>
			{/if}
			<button type="button" class="good" disabled={!reference} onclick={markLaid}>Ping: mark laid here</button>
		</div>
	</section>
</div>

<style>
	.lay {
		display: grid;
		gap: 16px;
		max-width: 560px;
		margin: 0 auto;
	}

	section {
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 12px;
		padding: 16px;
		display: grid;
		gap: 10px;
	}

	.ref {
		background: #eef3ff;
		border-color: #c7d5f5;
	}

	h2,
	h3 {
		margin: 0;
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
	}

	.pair {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}

	label {
		display: grid;
		gap: 4px;
		font-size: 13px;
		color: var(--muted);
	}

	input,
	select,
	button {
		font: inherit;
		font-size: 17px;
		font-weight: 600;
		color: var(--ink);
		min-height: 52px;
		padding: 0 12px;
		border: 1px solid #94a3b8;
		border-radius: 10px;
		background: #fff;
		width: 100%;
		min-width: 0;
	}

	input[aria-invalid='true'] {
		border-color: var(--warn);
	}

	button:disabled {
		opacity: 0.45;
	}

	.primary {
		background: var(--ink);
		border-color: var(--ink);
		color: #fff;
	}

	.good {
		background: var(--good);
		border-color: var(--good);
		color: #fff;
	}

	.marks {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 8px;
	}

	.mark {
		min-height: 56px;
		font-size: 22px;
		font-weight: 700;
		padding: 0;
	}

	.mark[aria-pressed='true'] {
		background: var(--ink);
		border-color: var(--ink);
		color: #fff;
	}

	.mark.laid {
		border: 3px solid var(--good);
	}

	.mark.off {
		border: 3px solid var(--warn);
	}

	.status {
		margin: 0;
		font-size: 15px;
		font-weight: 700;
		color: var(--warn);
	}

	.status.ok {
		color: var(--good);
	}

	.head {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 12px;
	}

	.head h2 {
		font-size: 22px;
		color: var(--ink);
		letter-spacing: 0;
	}

	.from {
		width: 160px;
	}

	.caption,
	.hint,
	.now {
		margin: 0;
		font-size: 13px;
		color: var(--muted);
	}

	.huge {
		margin: 0;
		font-size: 104px;
		line-height: 1;
		font-weight: 700;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}

	.huge.small {
		font-size: 56px;
	}

	.large {
		margin: 0;
		font-size: 30px;
		font-weight: 700;
	}

	.gps {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: var(--axis);
		color: #fff;
		border-radius: 14px;
		padding: 12px 16px;
		font-size: 14px;
		font-weight: 600;
	}

	.gps small {
		font-weight: 400;
	}

	.gps strong {
		font-size: 48px;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 12px;
	}

	.facts > div {
		border: 1px solid var(--line);
		border-radius: 12px;
		padding: 12px;
		display: grid;
		gap: 6px;
		align-content: start;
	}

	.fact {
		margin: 0;
		font-size: 20px;
		font-weight: 700;
	}

	.error {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--warn);
	}

	.live {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px 12px;
		border: 3px solid var(--start);
		border-radius: 14px;
		padding: 12px 14px;
	}

	.live.on-station {
		border-color: var(--good);
		background: #dcfce7;
	}

	.steer {
		margin: 0;
		font-size: 15px;
		font-weight: 700;
	}

	.now {
		grid-column: 1 / -1;
	}

	.actions {
		display: grid;
		gap: 8px;
	}
</style>
