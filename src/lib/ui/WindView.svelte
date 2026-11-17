<script lang="ts">
	import {
		angleDiff, formatBearing, labelBearing, norm, skewFromAxis, summarise, windReport,
		type CourseSpec, type WindReading,
	} from '../geo'

	let {
		spec = $bindable(), wind = $bindable([]), now = Date.now,
	}: { spec: CourseSpec; wind?: WindReading[]; now?: () => number } = $props()

	const stations = ['Mark 1', 'Mark 2', 'Gate 3', 'Gate 4', 'Committee', 'Pin']
	const W = 340
	const H = 160
	const SPAN = 30

	let station = $state(stations[0])
	// svelte-ignore state_referenced_locally
	let direction = $state(wind.length ? wind[wind.length - 1].direction : spec.axis)
	// svelte-ignore state_referenced_locally
	let speed = $state(wind.length ? wind[wind.length - 1].speed : 10)

	let recent = $derived(wind.slice(-12))
	let summary = $derived(summarise(recent))
	let skew = $derived(summary ? skewFromAxis(summary.mean, spec.axis) : null)
	let points = $derived(recent.map((r, i) => ({
		x: recent.length > 1 ? 30 + (i * (W - 40)) / (recent.length - 1) : W / 2,
		y: H / 2 - (Math.max(-SPAN, Math.min(SPAN, angleDiff(r.direction, spec.axis))) / SPAN) * (H / 2 - 12),
	})))

	const advice = {
		hold: 'No change needed',
		watch: 'Watch it: 15° or more off the axis',
		change: 'Consider moving the course: 20° or more off the axis',
	}

	function log() {
		wind = [...wind, { time: now(), direction: norm(direction), speed: Math.max(0, speed) }]
	}

	function undo() {
		wind = wind.slice(0, -1)
	}

	function setAxis() {
		if (summary) spec.axis = Math.round(summary.mean / 5) * 5 % 360
	}
</script>

<div class="wind">
	<section>
		<h2>Last {recent.length} readings · axis {labelBearing(spec.axis, spec.north)}</h2>
		{#if summary && skew}
			<div class="stats">
				<div>
					<h3>Mean</h3>
					<p class="big" data-testid="mean">{formatBearing(summary.mean)}</p>
					<p class="hint">{summary.meanSpeed.toFixed(0)} kn</p>
				</div>
				<div>
					<h3>Range</h3>
					<p class="big" data-testid="range">{formatBearing(summary.low)}–{formatBearing(summary.high)}</p>
					<p class="hint">{summary.minSpeed} to {summary.maxSpeed} kn</p>
				</div>
				<div>
					<h3>Vs axis</h3>
					<p class="big {skew.advice}" data-testid="skew">
						{Math.round(skew.degrees)}°{skew.side === 'on' ? '' : skew.side === 'left' ? ' L' : ' R'}
					</p>
				</div>
			</div>
			<p class="advice {skew.advice}" data-testid="advice">{advice[skew.advice]}</p>
			<svg viewBox="0 0 {W} {H}" role="img" aria-label="Wind direction relative to the axis over the last readings">
				<rect x="30" y={H / 4 + 6} width={W - 40} height={H / 2 - 12} class="band" />
				<line x1="30" x2={W - 10} y1={H / 2} y2={H / 2} class="axis" />
				<polyline points={points.map((p) => `${p.x},${p.y}`).join(' ')} class="trace" />
				{#each points as p, i (i)}
					<circle cx={p.x} cy={p.y} r="4" class="dot" />
				{/each}
				<text x="26" y="16" text-anchor="end" class="tick">+{SPAN}</text>
				<text x="26" y={H / 2 + 4} text-anchor="end" class="tick">axis</text>
				<text x="26" y={H - 6} text-anchor="end" class="tick">−{SPAN}</text>
			</svg>
			<button type="button" onclick={setAxis}>Set axis to mean wind</button>
		{:else}
			<p class="hint">No readings yet. Log one every five minutes before the start.</p>
		{/if}
	</section>

	<section class="entry">
		<h2>New reading</h2>
		<label>
			Where
			<select bind:value={station}>
				{#each stations as s (s)}<option value={s}>{s}</option>{/each}
			</select>
		</label>
		<div class="stepper">
			<button type="button" aria-label="Direction minus 5" onclick={() => (direction = norm(direction - 5))}>−5</button>
			<label class="value">
				<input type="number" min="0" max="359" bind:value={direction} aria-label="Direction" />
				direction
			</label>
			<button type="button" aria-label="Direction plus 5" onclick={() => (direction = norm(direction + 5))}>+5</button>
		</div>
		<div class="stepper">
			<button type="button" aria-label="Speed minus 1" onclick={() => (speed = Math.max(0, speed - 1))}>−1</button>
			<label class="value">
				<input type="number" min="0" max="60" bind:value={speed} aria-label="Speed" />
				knots
			</label>
			<button type="button" aria-label="Speed plus 1" onclick={() => (speed = speed + 1)}>+1</button>
		</div>
		<button type="button" class="primary" onclick={log}>Log reading</button>
		{#if wind.length}<button type="button" onclick={undo}>Undo last reading</button>{/if}
		<p class="vhf" data-testid="vhf"><strong>Say on VHF:</strong> {windReport(station, direction, speed)}.</p>
	</section>
</div>

<style>
	.wind {
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

	h2,
	h3 {
		margin: 0;
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}

	.big {
		margin: 0;
		font-size: 30px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.hint {
		margin: 0;
		font-size: 14px;
		color: var(--muted);
	}

	.advice {
		margin: 0;
		font-size: 16px;
		font-weight: 700;
	}

	.hold {
		color: var(--good);
	}

	.watch {
		color: var(--start);
	}

	.change {
		color: var(--warn);
	}

	svg {
		width: 100%;
	}

	.band {
		fill: #dcfce7;
	}

	.axis {
		stroke: var(--axis);
		stroke-width: 2;
		stroke-dasharray: 6 5;
	}

	.trace {
		fill: none;
		stroke: var(--ink);
		stroke-width: 2.5;
	}

	.dot {
		fill: var(--ink);
	}

	.tick {
		font-size: 11px;
		fill: var(--muted);
	}

	label {
		display: grid;
		gap: 4px;
		font-size: 13px;
		color: var(--muted);
	}

	.stepper {
		display: flex;
		gap: 8px;
		align-items: flex-start;
	}

	.value {
		flex: 1;
		text-align: center;
	}

	.value input {
		font-size: 40px;
		min-height: 64px;
		text-align: center;
	}

	input,
	select,
	button {
		font: inherit;
		font-size: 18px;
		font-weight: 600;
		color: var(--ink);
		min-height: 56px;
		padding: 0 12px;
		border: 1px solid #94a3b8;
		border-radius: 10px;
		background: #fff;
		width: 100%;
		min-width: 0;
	}

	.stepper button {
		width: 64px;
		min-height: 64px;
		flex: none;
	}

	.primary {
		background: var(--ink);
		border-color: var(--ink);
		color: #fff;
	}

	.vhf {
		margin: 0;
		background: var(--ground);
		border-radius: 10px;
		padding: 10px 12px;
		font-size: 15px;
	}
</style>
