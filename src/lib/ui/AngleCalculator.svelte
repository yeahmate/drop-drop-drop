<script lang="ts">
	import { formatBearing, norm, pinAdjustment, readCalculator } from '../geo'

	let { axis = $bindable(0), angle = $bindable(70) }: { axis?: number; angle?: number } = $props()

	const C = 200
	const R = 118
	const ticks = Array.from({ length: 72 }, (_, i) => i * 5)
	const lines = [200, 250, 300, 350, 400, 450, 500]
	const biases = [5, 10, 15, 20]
	const nm = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]

	let readings = $derived(readCalculator(axis).filter((r) => r.angle === angle || r.angle >= 90))

	const polar = (deg: number, r: number) => ({
		x: C + r * Math.sin((deg * Math.PI) / 180),
		y: C - r * Math.cos((deg * Math.PI) / 180),
	})

	function turn(by: number) {
		axis = norm(axis + by)
	}
</script>

<div class="calc">
	<div class="controls">
		<label>
			Course axis
			<span class="stepper">
				<button type="button" aria-label="Axis minus 5 degrees" onclick={() => turn(-5)}>−5</button>
				<input type="number" min="0" max="359" bind:value={axis} />
				<button type="button" aria-label="Axis plus 5 degrees" onclick={() => turn(5)}>+5</button>
			</span>
		</label>
		<label>
			Interior angle
			<select bind:value={angle}>
				<option value={60}>60°</option>
				<option value={70}>70°</option>
				<option value={80}>80°</option>
			</select>
		</label>
	</div>

	<svg viewBox="0 0 400 400" role="img" aria-label="Course angle calculator dial set to axis {formatBearing(axis)}">
		<g transform="rotate({-axis} {C} {C})">
			<circle cx={C} cy={C} r={R} class="rose" />
			{#each ticks as t (t)}
				{@const a = polar(t, R)}
				{@const b = polar(t, R - (t % 30 === 0 ? 14 : t % 10 === 0 ? 9 : 5))}
				<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} class="tick" />
				{#if t % 30 === 0}
					{@const p = polar(t, R - 28)}
					<text x={p.x} y={p.y + 4} text-anchor="middle" class="rose-num" transform="rotate({t} {p.x} {p.y})">{t}</text>
				{/if}
			{/each}
		</g>
		{#each readings as r (r.offset)}
			{@const a = polar(r.offset, R + 4)}
			{@const b = polar(r.offset, R + 22)}
			{@const t = polar(r.offset, R + 50)}
			<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} class="pointer" class:main={r.offset === 180} />
			<text x={t.x} y={t.y} text-anchor="middle" class="bearing">{formatBearing(r.bearing)}</text>
			<text x={t.x} y={t.y + 13} text-anchor="middle" class="name">{r.label}</text>
		{/each}
		<path d="M{C} {C - R - 4}V{C - R - 30}" class="pointer main" />
		<text x={C} y="26" text-anchor="middle" class="bearing">{formatBearing(axis)}</text>
		<text x={C} y="40" text-anchor="middle" class="name">Course axis</text>
		<circle cx={C} cy={C} r="3" class="hub" />
	</svg>

	<table class="readings">
		<thead><tr><th>Pointer</th><th>Bearing</th></tr></thead>
		<tbody>
			<tr><td>Course axis</td><td class="num">{formatBearing(axis)}</td></tr>
			{#each readings as r (r.offset)}
				<tr><td>{r.label}</td><td class="num">{formatBearing(r.bearing)}</td></tr>
			{/each}
		</tbody>
	</table>

	<div class="panels">
		<section>
			<h3>Nautical miles to metres</h3>
			<table>
				<tbody>
					{#each nm as n (n)}
						<tr><td>{n.toFixed(1)} NM</td><td>{Math.round(n * 1852)} m</td></tr>
					{/each}
				</tbody>
			</table>
		</section>
		<section>
			<h3>Pin end anchor adjustment (m) for bias change</h3>
			<div class="scroll">
				<table>
					<thead>
						<tr><th>Line</th>{#each biases as b (b)}<th>{b}°</th>{/each}</tr>
					</thead>
					<tbody>
						{#each lines as l (l)}
							<tr><td>{l} m</td>{#each biases as b (b)}<td>{Math.round(pinAdjustment(l, b))}</td>{/each}</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
		<section>
			<h3>Tide stick</h3>
			<p>Knots = 2 × metres drifted ÷ seconds.</p>
			<p>Or feet drifted ÷ (minutes × 100).</p>
			<h3>Mark missing</h3>
			<p>Flag M with repetitive sound signals, on station at the mark's position.</p>
		</section>
	</div>
</div>

<style>
	.calc {
		display: grid;
		gap: 16px;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
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
		min-height: 48px;
		padding: 0 12px;
		border: 1px solid #94a3b8;
		border-radius: 8px;
		background: #fff;
	}

	input {
		width: 96px;
		text-align: center;
	}

	svg {
		width: 100%;
		max-width: 460px;
		justify-self: center;
	}

	.rose {
		fill: #f8fafc;
		stroke: var(--ink);
		stroke-width: 2;
	}

	.tick {
		stroke: var(--muted);
		stroke-width: 1;
	}

	.rose-num {
		font-size: 11px;
		fill: var(--ink);
	}

	.pointer {
		stroke: var(--ink);
		stroke-width: 2.5;
	}

	.pointer.main {
		stroke: var(--axis);
		stroke-width: 4;
		fill: none;
	}

	.bearing {
		font-size: 17px;
		font-weight: 700;
		fill: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.name {
		font-size: 10.5px;
		fill: var(--muted);
	}

	.hub {
		fill: var(--ink);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 15px;
	}

	th {
		text-align: left;
		font-size: 12px;
		color: var(--muted);
		padding: 6px 4px;
	}

	td {
		padding: 7px 4px;
		border-top: 1px solid #e3e9ef;
	}

	.readings td {
		font-weight: 600;
	}

	.num {
		font-variant-numeric: tabular-nums;
		font-size: 20px;
	}

	.panels {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 16px;
	}

	section {
		border: 1px solid var(--line);
		border-radius: 12px;
		padding: 12px 14px;
	}

	h3 {
		margin: 0 0 6px;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
	}

	h3:not(:first-child) {
		margin-top: 14px;
	}

	p {
		margin: 0 0 4px;
		font-size: 15px;
	}

	.scroll {
		overflow-x: auto;
	}
</style>
