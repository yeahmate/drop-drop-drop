<script lang="ts">
	import {
		formatBearing, labelBearing, formatDistance, pinBoatAnchorBearings, startLine, startLineOk,
		type CourseSpec, type DistanceUnit,
	} from '../geo'

	let { spec, unit = 'nm' }: { spec: CourseSpec; unit?: DistanceUnit } = $props()

	let bias = $state(0)
	let measured = $state<number | null>(null)

	let line = $derived(startLine(spec.axis, spec.startLine, bias))
	let anchor = $derived(pinBoatAnchorBearings(spec.axis))
</script>

<div class="line">
	<section>
		<h2>Start line · axis {labelBearing(spec.axis, spec.north)}</h2>
		<p class="length">{formatDistance(spec.startLine, unit)}</p>
		<div class="bearings">
			<div>
				<h3>Pin to committee boat</h3>
				<p class="huge" data-testid="pin-to-cb">{formatBearing(line.pinToCb)}</p>
			</div>
			<div>
				<h3>Committee boat to pin</h3>
				<p class="huge" data-testid="cb-to-pin">{formatBearing(line.cbToPin)}</p>
			</div>
		</div>
		<label>
			Bias (degrees, + favours the pin)
			<span class="stepper">
				<button type="button" aria-label="Bias minus 5 degrees" onclick={() => (bias = Math.max(-20, bias - 5))}>−5</button>
				<input type="number" min="-20" max="20" step="1" bind:value={bias} />
				<button type="button" aria-label="Bias plus 5 degrees" onclick={() => (bias = Math.min(20, bias + 5))}>+5</button>
			</span>
		</label>
		{#if bias !== 0}
			<p class="fact" data-testid="pin-move">
				Move the pin {Math.round(line.pinMove)} m {bias > 0 ? 'upwind' : 'downwind'}
			</p>
		{:else}
			<p class="fact">Square to the axis</p>
		{/if}
	</section>

	<section>
		<h2>Pin-end boat</h2>
		<p class="fact" data-testid="anchor">
			Drop the anchor at {formatBearing(anchor.from)} to {formatBearing(anchor.to)} to the committee boat
		</p>
		<p class="hint">12 to 15 degrees high of the line, then fall back onto it. That leaves about 10 degrees either way.</p>
	</section>

	<section>
		<h2>Check the laid line</h2>
		<label>
			Measured length (m)
			<input type="number" min="0" step="1" bind:value={measured} />
		</label>
		{#if measured}
			<p class="fact" class:ok={startLineOk(measured, spec.startLine)} class:bad={!startLineOk(measured, spec.startLine)} data-testid="line-check">
				{startLineOk(measured, spec.startLine) ? 'Within tolerance' : 'Outside tolerance'}
				({Math.round(spec.startLine * 0.95)} to {Math.round(spec.startLine * 1.1)} m)
			</p>
		{/if}
	</section>
</div>

<style>
	.line {
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

	.length {
		margin: 0;
		font-size: 24px;
		font-weight: 700;
	}

	.bearings {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.huge {
		margin: 0;
		font-size: 72px;
		line-height: 1;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
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
		text-align: center;
	}

	.stepper button {
		width: auto;
		flex: none;
	}

	.fact {
		margin: 0;
		font-size: 19px;
		font-weight: 700;
	}

	.ok {
		color: var(--good);
	}

	.bad {
		color: var(--warn);
	}

	.hint {
		margin: 0;
		font-size: 14px;
		color: var(--muted);
	}
</style>
