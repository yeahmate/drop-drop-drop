<script lang="ts">
	import {
		formatBearing, formatDistance, leg, nmToMetres, readCalculator, trapezoid,
		type DistanceUnit, type TrapezoidMark,
	} from './lib/geo'

	let axis = $state(235)
	let beatNm = $state(0.5)
	let angle = $state(70)
	let unit = $state<DistanceUnit>('nm')

	const rows: { mark: TrapezoidMark; name: string }[] = [
		{ mark: '1', name: 'Mark 1' },
		{ mark: '2', name: 'Mark 2' },
		{ mark: '3', name: 'Gate 3' },
		{ mark: 'start', name: 'Start line' },
	]

	let marks = $derived(trapezoid({ axis, beat: nmToMetres(beatNm), angle }))
	let table = $derived(rows.map((r) => ({ ...r, ...leg(marks.ref, marks[r.mark]) })))
	let dial = $derived(readCalculator(axis).filter((r) => r.angle === angle || r.angle >= 90))
</script>

<header>
	<h1>Drop Drop Drop</h1>
	<p>Trapezoid from the reference point · magnetic</p>
</header>

<main>
	<section class="controls">
		<label>
			Course axis
			<input type="number" min="0" max="359" step="5" bind:value={axis} />
		</label>
		<label>
			Beat (NM)
			<input type="number" min="0.1" max="3" step="0.05" bind:value={beatNm} />
		</label>
		<label>
			Interior angle
			<select bind:value={angle}>
				<option value={60}>60°</option>
				<option value={70}>70°</option>
				<option value={80}>80°</option>
			</select>
		</label>
		<label>
			Distances lead with
			<select bind:value={unit}>
				<option value="nm">Nautical miles</option>
				<option value="m">Metres</option>
			</select>
		</label>
	</section>

	<section>
		<h2>From the reference point (4s/4p)</h2>
		<div class="scroll">
			<table>
				<thead>
					<tr><th>Mark</th><th>Bearing</th><th>Distance</th><th>GPS reads</th></tr>
				</thead>
				<tbody>
					{#each table as row (row.mark)}
						<tr>
							<td>{row.name}</td>
							<td class="num">{formatBearing(row.bearing)}</td>
							<td>{formatDistance(row.distance, unit)}</td>
							<td class="num gps">{formatBearing(row.reciprocal)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section>
		<h2>Course angle calculator, {angle}°</h2>
		<div class="scroll">
			<table>
				<thead>
					<tr><th>Pointer</th><th>Bearing</th></tr>
				</thead>
				<tbody>
					{#each dial as r (r.label + r.offset)}
						<tr>
							<td>{r.label}</td>
							<td class="num">{formatBearing(r.bearing)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</main>

<style>
	header {
		background: var(--ink);
		color: #fff;
		padding: 16px 20px;
	}

	h1 {
		margin: 0;
		font-size: 20px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	header p {
		margin: 4px 0 0;
		font-size: 14px;
		color: #c9d6e3;
	}

	main {
		max-width: 720px;
		margin: 0 auto;
		padding: 16px;
		display: grid;
		gap: 16px;
	}

	section {
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 12px;
		padding: 16px;
	}

	.controls {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 12px;
	}

	label {
		display: grid;
		gap: 4px;
		font-size: 13px;
		color: var(--muted);
	}

	input,
	select {
		font: inherit;
		font-size: 18px;
		font-weight: 600;
		color: var(--ink);
		min-height: 48px;
		padding: 0 10px;
		border: 1px solid #94a3b8;
		border-radius: 8px;
		background: #fff;
		width: 100%;
	}

	h2 {
		margin: 0 0 8px;
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
	}

	.scroll {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 17px;
	}

	th {
		text-align: left;
		font-size: 12px;
		color: var(--muted);
		padding: 6px 4px;
	}

	td {
		padding: 10px 4px;
		border-top: 1px solid #e3e9ef;
		font-weight: 600;
	}

	.num {
		font-variant-numeric: tabular-nums;
		font-size: 22px;
	}

	.gps {
		color: var(--axis);
	}
</style>
