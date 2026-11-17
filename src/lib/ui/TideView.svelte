<script lang="ts">
	import {
		asSailingWind, currentOnAxis, drift, formatBearing, labelBearing, norm, sailingWind, stickKnots, stickRuleOfThumb,
		summarise, type CourseSpec, type Current, type WindReading,
	} from '../geo'

	let {
		spec = $bindable(), wind = [], tide = $bindable({ set: 0, rate: 0 }),
	}: { spec: CourseSpec; wind?: WindReading[]; tide?: Current } = $props()

	let metres = $state<number | null>(null)
	let seconds = $state<number | null>(null)
	// Used only until there are readings in the wind log.
	// svelte-ignore state_referenced_locally
	let manualDirection = $state(spec.axis)
	let manualSpeed = $state(10)

	let measured = $derived(metres && seconds ? stickKnots(metres, seconds) : null)
	// The log mixes at-anchor readings (committee boat) and drifting ones (mark
	// boats). Only the at-anchor ones need correcting for the current.
	let recent = $derived(wind.slice(-12))
	let logged = $derived(summarise(asSailingWind(recent, tide)))
	let atAnchor = $derived(recent.filter((r) => r.anchored).length)
	let sailing = $derived(logged
		? { direction: logged.mean, speed: logged.meanSpeed }
		: sailingWind({ direction: manualDirection, speed: manualSpeed }, tide))
	let onAxis = $derived(currentOnAxis(spec.axis, tide))
	let suggested = $derived(Math.round(sailing.direction / 5) * 5 % 360)

	function useMeasured() {
		if (measured !== null) tide = { ...tide, rate: Math.round(measured * 10) / 10 }
	}

	function turn(by: number) {
		tide = { ...tide, set: norm(tide.set + by) }
	}

	function rate(by: number) {
		tide = { ...tide, rate: Math.max(0, Math.round((tide.rate + by) * 10) / 10) }
	}

	function setAxis() {
		spec.axis = suggested
	}
</script>

<div class="tide">
	<section>
		<h2>Tide stick</h2>
		<div class="pair">
			<label>Drift (m)<input type="number" min="0" step="1" bind:value={metres} /></label>
			<label>Time (s)<input type="number" min="0" step="1" bind:value={seconds} /></label>
		</div>
		{#if measured !== null}
			<p class="fact" data-testid="stick">{measured.toFixed(1)} knots</p>
			<p class="hint">Rule of thumb, 2 × metres ÷ seconds: {stickRuleOfThumb(metres ?? 0, seconds ?? 0).toFixed(1)} knots</p>
			<button type="button" onclick={useMeasured}>Use as the current's rate</button>
		{:else}
			<p class="hint">Drop the stick at a mark, time it over a measured distance, and note which way it goes.</p>
		{/if}
	</section>

	<section>
		<h2>Current</h2>
		<div class="stepper">
			<button type="button" aria-label="Set minus 5 degrees" onclick={() => turn(-5)}>−5</button>
			<label class="value">
				<input type="number" min="0" max="359" aria-label="Set" value={tide.set} onchange={(e) => (tide = { ...tide, set: norm(Number(e.currentTarget.value)) })} />
				flowing towards ({spec.north})
			</label>
			<button type="button" aria-label="Set plus 5 degrees" onclick={() => turn(5)}>+5</button>
		</div>
		<div class="stepper">
			<button type="button" aria-label="Rate minus 0.1 knots" onclick={() => rate(-0.1)}>−0.1</button>
			<label class="value">
				<input type="number" min="0" max="15" step="0.1" aria-label="Rate" value={tide.rate} onchange={(e) => (tide = { ...tide, rate: Math.max(0, Number(e.currentTarget.value)) })} />
				knots
			</label>
			<button type="button" aria-label="Rate plus 0.1 knots" onclick={() => rate(0.1)}>+0.1</button>
		</div>
	</section>

	<section>
		<h2>On the course · axis {labelBearing(spec.axis, spec.north)}</h2>
		{#if tide.rate > 0}
			<p class="fact" data-testid="along">
				{#if onAxis.alongWord === 'none'}No current along the beat{:else}{Math.abs(onAxis.along).toFixed(1)} kn {onAxis.alongWord}{/if}
			</p>
			<p class="fact" data-testid="across">
				{#if onAxis.acrossWord === 'none'}No current across the course{:else}{Math.abs(onAxis.across).toFixed(1)} kn across, {onAxis.acrossWord} looking upwind{/if}
			</p>
			<p class="hint" data-testid="drift">A drifting boat or loose mark moves {Math.round(drift(tide.rate, 5))} m in five minutes. Drop anchors up-tide.</p>
		{:else}
			<p class="hint">Enter the current to see what it does to the course.</p>
		{/if}
	</section>

	<section>
		<h2>Sailing wind</h2>
		{#if logged}
			<p class="hint" data-testid="ground">
				From the wind log: {atAnchor} at anchor, corrected for the current; {recent.length - atAnchor} drifting, used as read.
			</p>
		{:else}
			<div class="pair">
				<label>Wind at anchor, from<input type="number" min="0" max="359" bind:value={manualDirection} /></label>
				<label>Speed (kn)<input type="number" min="0" max="60" bind:value={manualSpeed} /></label>
			</div>
			<p class="hint">As read on the committee boat. Readings in the wind log replace these.</p>
		{/if}
		<p class="huge" data-testid="sailing">{formatBearing(sailing.direction)} <small>at {sailing.speed.toFixed(1)} kn</small></p>
		<p class="hint">What the fleet races in: the wind felt by a boat carried on the current. A drifting mark boat reads it directly; the committee boat at anchor does not.</p>
		<p class="fact" data-testid="gates">Gates and start line square to it: {formatBearing(sailing.direction + 90)} / {formatBearing(sailing.direction - 90)}</p>
		{#if suggested !== Math.round(norm(spec.axis))}
			<button type="button" class="primary" onclick={setAxis}>Set axis to {formatBearing(suggested)}</button>
		{/if}
	</section>
</div>

<style>
	.tide {
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
		gap: 8px;
		align-items: flex-start;
	}

	.value {
		flex: 1;
		text-align: center;
	}

	.value input {
		font-size: 34px;
		min-height: 60px;
		text-align: center;
	}

	input,
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
		width: 72px;
		min-height: 60px;
		flex: none;
	}

	.primary {
		background: var(--ink);
		border-color: var(--ink);
		color: #fff;
	}

	.fact {
		margin: 0;
		font-size: 19px;
		font-weight: 700;
	}

	.huge {
		margin: 0;
		font-size: 64px;
		line-height: 1;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.huge small {
		font-size: 20px;
	}

	.hint {
		margin: 0;
		font-size: 14px;
		color: var(--muted);
	}
</style>
