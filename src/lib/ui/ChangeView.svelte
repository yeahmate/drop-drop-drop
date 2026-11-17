<script lang="ts">
	import {
		buildCourse, changeLeg, formatBearing, formatDistance, layTable, leg, metresToNm, nmToMetres, norm,
		type CourseSpec, type DistanceUnit, type Vec,
	} from '../geo'

	let { spec = $bindable(), unit = 'nm' }: { spec: CourseSpec; unit?: DistanceUnit } = $props()

	let course = $derived(buildCourse(spec))
	let rows = $derived(layTable(course).filter((r) => r.mark in course.marks))
	let points = $derived<Record<string, Vec>>({
		Reference: course.points.ref,
		...Object.fromEntries(rows.map((r) => [r.mark, r.position])),
	})

	let markName = $state('1')
	let fromName = $state('Reference')
	let newBearing = $state<number | null>(null)
	let newLength = $state<number | null>(null)
	let limit = $state(0)

	let mark = $derived(points[markName] ?? points['1'])
	let from = $derived(points[fromName] && fromName !== markName ? points[fromName] : points.Reference)
	let current = $derived(leg(from, mark))
	let bearing = $derived(newBearing ?? Math.round(current.bearing))
	let length = $derived(newLength === null ? current.distance : unit === 'nm' ? nmToMetres(newLength) : newLength)
	let result = $derived(changeLeg({ from, mark, bearing, length, noSignalWithin: limit }))
	let fromRef = $derived(leg(course.points.ref, result.position))
	let lengthShown = $derived(unit === 'nm' ? Math.round(metresToNm(length) * 100) / 100 : Math.round(length))
	let wholeCourse = $derived(markName === '1' && fromName === 'Reference')

	function reset() {
		newBearing = null
		newLength = null
	}

	function turn(by: number) {
		newBearing = norm(bearing + by)
	}

	function setLength(event: Event) {
		const value = Number((event.currentTarget as HTMLInputElement).value)
		newLength = value > 0 ? value : null
	}

	function applyToCourse() {
		spec.axis = norm(bearing)
		spec.beat = length
		reset()
	}
</script>

<div class="change">
	<section>
		<h2>Which leg is changing</h2>
		<div class="pair">
			<label>
				Mark to move
				<select bind:value={markName} onchange={reset}>
					{#each rows as r (r.mark)}<option value={r.mark}>{r.mark}</option>{/each}
				</select>
			</label>
			<label>
				Leg starts at
				<select bind:value={fromName} onchange={reset}>
					{#each Object.keys(points).filter((p) => p !== markName) as p (p)}<option value={p}>{p}</option>{/each}
				</select>
			</label>
		</div>
		<p class="hint" data-testid="current">Now {formatBearing(current.bearing)} · {formatDistance(current.distance, unit)}</p>
	</section>

	<section>
		<h2>New leg</h2>
		<label>
			New bearing
			<span class="stepper">
				<button type="button" aria-label="Bearing minus 5 degrees" onclick={() => turn(-5)}>−5</button>
				<input type="number" min="0" max="359" value={bearing} onchange={(e) => (newBearing = norm(Number(e.currentTarget.value)))} />
				<button type="button" aria-label="Bearing plus 5 degrees" onclick={() => turn(5)}>+5</button>
			</span>
		</label>
		<label>
			New length ({unit === 'nm' ? 'NM' : 'm'})
			<input type="number" min="0" step={unit === 'nm' ? 0.05 : 50} value={lengthShown} onchange={setLength} />
		</label>
		<label>
			Sailing instructions allow moving a mark without a signal up to (m)
			<input type="number" min="0" max="500" step="10" bind:value={limit} />
		</label>
	</section>

	<section class="board" data-testid="board">
		<h2>Charlie board</h2>
		{#if result.signal.needed}
			<div class="flag">
				<span class="c" aria-hidden="true">C</span>
				<span class="bearing">{result.signal.bearing}</span>
				{#if result.signal.shape === 'green triangle'}
					<svg viewBox="0 0 48 48" role="img" aria-label="green triangle"><path d="M24 6L44 42H4Z" fill="#15803d" /></svg>
				{:else if result.signal.shape === 'red rectangle'}
					<svg viewBox="0 0 48 48" role="img" aria-label="red rectangle"><rect x="4" y="12" width="40" height="24" fill="#b91c1c" /></svg>
				{/if}
				{#if result.signal.sign}<span class="sign">{result.signal.sign}</span>{/if}
			</div>
			<p class="fact" data-testid="signal">
				Flag C with repetitive sounds: {result.signal.bearing}{#if result.direction !== 'none'}, {Math.round(result.turn)}° to {result.direction}{/if}{#if result.length !== 'same'}, {Math.abs(Math.round(result.lengthChange * 100))}% {result.length}{/if}
			</p>
			<p class="hint">Signal before the leading boat begins the leg.</p>
		{:else if result.move.distance < 1}
			<p class="fact" data-testid="signal">No change</p>
		{:else}
			<p class="fact" data-testid="signal">No signal needed: the move is within {limit} m</p>
		{/if}
	</section>

	<section data-testid="move">
		<h2>Mark boat</h2>
		{#if result.move.distance >= 1}
			<p class="fact">Move mark {markName} {formatBearing(result.move.bearing)} · {formatDistance(result.move.distance, unit)}</p>
			<p class="hint">
				New position from the reference: {formatBearing(fromRef.bearing)} · {formatDistance(fromRef.distance, unit)},
				GPS reads {formatBearing(fromRef.reciprocal)}
			</p>
			{#if wholeCourse}
				<button type="button" class="primary" onclick={applyToCourse}>Re-point the whole course to this</button>
				<p class="hint">Sets the course axis and beat, so every other mark's bearings update too.</p>
			{/if}
		{:else}
			<p class="hint">Set a new bearing or length to see the move.</p>
		{/if}
	</section>
</div>

<style>
	.change {
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

	h2 {
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

	.stepper {
		display: flex;
		gap: 6px;
	}

	input,
	select,
	button {
		font: inherit;
		font-size: 18px;
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

	.stepper button {
		width: auto;
		flex: none;
	}

	.stepper input {
		text-align: center;
	}

	.primary {
		background: var(--ink);
		border-color: var(--ink);
		color: #fff;
	}

	.flag {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.c {
		display: grid;
		place-items: center;
		width: 56px;
		height: 56px;
		font-size: 30px;
		font-weight: 700;
		color: #fff;
		background: linear-gradient(#1d4ed8 0 20%, #fff 20% 40%, #b91c1c 40% 60%, #fff 60% 80%, #1d4ed8 80%);
		text-shadow: 0 0 4px #000;
		border: 1px solid var(--ink);
	}

	.bearing {
		font-size: 64px;
		line-height: 1;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.flag svg {
		width: 52px;
		height: 52px;
	}

	.sign {
		font-size: 64px;
		line-height: 1;
		font-weight: 700;
	}

	.fact {
		margin: 0;
		font-size: 19px;
		font-weight: 700;
	}

	.hint {
		margin: 0;
		font-size: 14px;
		color: var(--muted);
	}
</style>
