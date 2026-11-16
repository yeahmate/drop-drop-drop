<script lang="ts">
	import {
		BOAT_CLASSES, COURSE_TYPES, buildCourse, estimatedMinutes, formatBearing, formatCoordinate,
		formatDistance, gateWidth, hasOffsetMark, isTrapezoid, layTable, metresToNm, nmToMetres, norm,
		parseCoordinate, roundingOrder, signal, startLineLength, toLatLon,
		type CourseSpec, type DistanceUnit,
	} from '../geo'
	import CourseDiagram from './CourseDiagram.svelte'

	let {
		spec = $bindable(), unit = 'nm', refLat = $bindable(''), refLon = $bindable(''),
	}: { spec: CourseSpec; unit?: DistanceUnit; refLat?: string; refLon?: string } = $props()

	let boatClass = $state(BOAT_CLASSES[0].name)
	let fleet = $state(40)
	let speed = $state(4)

	let course = $derived(buildCourse(spec))
	let rows = $derived(layTable(course))
	let minutes = $derived(estimatedMinutes(course.length, speed))
	let lat = $derived(parseCoordinate(refLat, 'lat'))
	let lon = $derived(parseCoordinate(refLon, 'lon'))
	let reference = $derived(lat.ok && lon.ok ? { lat: lat.value, lon: lon.value } : null)

	// The beat is edited in the leading unit and stored in metres.
	let beatShown = $derived(unit === 'nm' ? Math.round(metresToNm(spec.beat) * 100) / 100 : Math.round(spec.beat))

	function setBeat(event: Event) {
		const value = Number((event.currentTarget as HTMLInputElement).value)
		if (value > 0) spec.beat = unit === 'nm' ? nmToMetres(value) : value
	}

	// Ratios show three decimals; 0.667 means two thirds exactly.
	let reachShown = $derived(Math.round(spec.reachRatio * 1000) / 1000)

	function setReach(event: Event) {
		const value = Number((event.currentTarget as HTMLInputElement).value)
		if (value > 0) spec.reachRatio = Math.abs(value - 2 / 3) < 0.005 ? 2 / 3 : value
	}

	function turn(by: number) {
		spec.axis = norm(spec.axis + by)
	}

	function applySizing() {
		const c = BOAT_CLASSES.find((b) => b.name === boatClass)!
		spec.startLine = Math.round(startLineLength(fleet, c.length, c.lineFactor))
		spec.gateWidth = Math.round(gateWidth(c.length))
	}
</script>

<div class="plan">
	<div class="main">
		<section>
			<h2><span class="signal">{signal(spec)}</span> axis {formatBearing(spec.axis)}</h2>
			<p class="order" data-testid="rounding-order">{roundingOrder(course)}</p>
			<CourseDiagram {course} axis={spec.axis} />
		</section>

		<section class="stats">
			<div>
				<h3>Course length</h3>
				<p class="big" data-testid="course-length">{formatDistance(course.length, unit)}</p>
			</div>
			<div>
				<h3>First boat</h3>
				<p class="big">{Math.round(minutes)} min</p>
				<label class="inline">at <input type="number" min="1" max="30" step="0.5" bind:value={speed} /> kn average</label>
			</div>
			<div>
				<h3>Marks to lay</h3>
				<p class="big">{Object.keys(course.marks).length}</p>
			</div>
		</section>

		<section>
			<h2>From the reference point</h2>
			<div class="reference">
				<label>
					Reference latitude
					<input type="text" placeholder="N 50° 35.212'" bind:value={refLat} aria-invalid={refLat !== '' && !lat.ok} />
					{#if refLat !== '' && !lat.ok}<span class="error">{lat.error}</span>{/if}
				</label>
				<label>
					Reference longitude
					<input type="text" placeholder="W 002° 26.874'" bind:value={refLon} aria-invalid={refLon !== '' && !lon.ok} />
					{#if refLon !== '' && !lon.ok}<span class="error">{lon.error}</span>{/if}
				</label>
			</div>
			<div class="scroll">
				<table>
					<thead>
						<tr>
							<th>Mark</th><th>Bearing</th><th>Distance</th><th>GPS reads</th>
							{#if reference}<th>Position</th>{/if}
						</tr>
					</thead>
					<tbody>
						{#each rows as row (row.mark)}
							<tr data-testid="lay-{row.mark}">
								<td>{row.mark}</td>
								<td class="num">{formatBearing(row.bearing)}</td>
								<td>{formatDistance(row.distance, unit)}</td>
								<td class="num gps">{formatBearing(row.gpsReads)}</td>
								{#if reference}
									{@const p = toLatLon(reference, row.position)}
									<td class="pos">{formatCoordinate(p.lat, 'lat')}<br />{formatCoordinate(p.lon, 'lon')}</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	</div>

	<aside>
		<section>
			<h2>Course</h2>
			<label>
				Type
				<select bind:value={spec.type}>
					{#each COURSE_TYPES as c (c.type)}
						<option value={c.type}>{c.type}: {c.name}</option>
					{/each}
				</select>
			</label>
			<label>
				Beats
				<input type="number" min="1" max="6" step="1" bind:value={spec.beats} />
			</label>
			<label>
				Course axis
				<span class="stepper">
					<button type="button" aria-label="Axis minus 5 degrees" onclick={() => turn(-5)}>−5</button>
					<input type="number" min="0" max="359" bind:value={spec.axis} />
					<button type="button" aria-label="Axis plus 5 degrees" onclick={() => turn(5)}>+5</button>
				</span>
			</label>
		</section>

		<section>
			<h2>Dimensions</h2>
			<label>
				Beat ({unit === 'nm' ? 'NM' : 'm'})
				<input type="number" min="0" step={unit === 'nm' ? 0.05 : 50} value={beatShown} onchange={setBeat} />
				<span class="hint">{formatDistance(spec.beat, unit)}</span>
			</label>
			{#if isTrapezoid(spec.type)}
				<label>
					Interior angle
					<input type="number" min="30" max="120" step="5" bind:value={spec.angle} />
				</label>
				<label>
					Reach, fraction of beat
					<input type="number" min="0.2" max="2" step="0.001" value={reachShown} onchange={setReach} />
					<span class="hint">{formatDistance(spec.reachRatio * spec.beat, unit)}</span>
				</label>
				<label>
					Outer beat, fraction of beat
					<input type="number" min="0.2" max="2" step="0.05" bind:value={spec.outerRatio} />
				</label>
			{/if}
			{#if hasOffsetMark(spec.type)}
				<label>
					Offset mark 1a (m)
					<input type="number" min="10" max="500" step="5" bind:value={spec.offsetDistance} />
				</label>
				<label>
					Offset angle
					<select bind:value={spec.offsetAngle}>
						<option value={80}>80°</option>
						<option value={90}>90°</option>
					</select>
				</label>
			{/if}
			<label>
				Gate width (m)
				<input type="number" min="5" max="500" step="1" bind:value={spec.gateWidth} />
			</label>
			<label>
				Start line (m)
				<input type="number" min="10" max="2000" step="5" bind:value={spec.startLine} />
			</label>
		</section>

		<section>
			<h2>Size from the fleet</h2>
			<label>
				Class
				<select bind:value={boatClass}>
					{#each BOAT_CLASSES as c (c.name)}
						<option value={c.name}>{c.name}</option>
					{/each}
				</select>
			</label>
			<label>
				Boats
				<input type="number" min="2" max="200" step="1" bind:value={fleet} />
			</label>
			<button type="button" class="apply" onclick={applySizing}>Set line and gate</button>
		</section>
	</aside>
</div>

<style>
	.plan {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		align-items: flex-start;
	}

	.main {
		flex: 999 1 520px;
		min-width: 0;
		display: grid;
		gap: 16px;
	}

	aside {
		flex: 1 1 280px;
		max-width: 420px;
		display: grid;
		gap: 16px;
	}

	section {
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 12px;
		padding: 16px;
		display: grid;
		gap: 10px;
		min-width: 0;
	}

	h2 {
		margin: 0;
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
	}

	.signal {
		font-size: 22px;
		color: var(--ink);
		letter-spacing: 0;
	}

	h3 {
		margin: 0;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
	}

	.order {
		margin: 0;
		font-size: 15px;
	}

	.stats {
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
	}

	.big {
		margin: 2px 0;
		font-size: 22px;
		font-weight: 700;
	}

	label {
		display: grid;
		gap: 4px;
		font-size: 13px;
		color: var(--muted);
	}

	.inline {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.inline input {
		width: 76px;
		min-height: 40px;
		font-size: 15px;
	}

	.hint {
		font-size: 13px;
	}

	.error {
		font-size: 13px;
		font-weight: 600;
		color: var(--warn);
	}

	.stepper {
		display: flex;
		gap: 6px;
	}

	.stepper input {
		text-align: center;
	}

	input,
	select,
	button {
		font: inherit;
		font-size: 17px;
		font-weight: 600;
		color: var(--ink);
		min-height: 48px;
		padding: 0 10px;
		border: 1px solid #94a3b8;
		border-radius: 8px;
		background: #fff;
		width: 100%;
		min-width: 0;
	}

	input[aria-invalid='true'] {
		border-color: var(--warn);
	}

	.stepper button {
		width: auto;
		flex: none;
	}

	.apply {
		background: var(--ink);
		color: #fff;
		border-color: var(--ink);
	}

	.reference {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 12px;
	}

	.scroll {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 16px;
	}

	th {
		text-align: left;
		font-size: 12px;
		color: var(--muted);
		padding: 6px 4px;
	}

	td {
		padding: 9px 4px;
		border-top: 1px solid #e3e9ef;
		font-weight: 600;
	}

	.num {
		font-variant-numeric: tabular-nums;
		font-size: 21px;
	}

	.gps {
		color: var(--axis);
	}

	.pos {
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
</style>
