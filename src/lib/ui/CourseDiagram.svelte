<script lang="ts">
	import type { BuiltCourse, Vec } from '../geo'
	import { fitPoints, markLabels, scaleBar } from './fit'

	let { course, axis }: { course: BuiltCourse; axis: number } = $props()

	const W = 640
	const H = 520

	let all = $derived<Vec[]>([...Object.values(course.marks), ...Object.values(course.points)])
	let fit = $derived(fitPoints(all, W, H, 64))
	let centre = $derived({
		e: all.reduce((s, p) => s + p.e, 0) / all.length,
		n: all.reduce((s, p) => s + p.n, 0) / all.length,
	})
	let path = $derived(
		course.sequence.map((w, i) => `${i ? 'L' : 'M'}${fit.x(w.position).toFixed(1)} ${fit.y(w.position).toFixed(1)}`).join(''),
	)
	let marks = $derived(Object.entries(course.marks).map(([name, p]) => ({ name, x: fit.x(p), y: fit.y(p) })))
	let labels = $derived(markLabels(course.marks).map((l) => {
		// Push each label away from the middle of the course.
		const dx = fit.x(l.position) - fit.x(centre)
		const dy = fit.y(l.position) - fit.y(centre)
		const d = Math.hypot(dx, dy) || 1
		const reach = l.text.length > 2 ? 40 : 24
		return { text: l.text, x: fit.x(l.position) + (dx / d) * reach, y: fit.y(l.position) + (dy / d) * reach + 5 }
	}))
	let bar = $derived(scaleBar(fit.scale, 140))
</script>

<svg viewBox="0 0 {W} {H}" role="img" aria-label="Course diagram, north up">
	<path d={path} class="track" />
	<line
		class="beat"
		x1={fit.x(course.points.ref)} y1={fit.y(course.points.ref)}
		x2={fit.x(course.marks['1'])} y2={fit.y(course.marks['1'])}
	/>
	<line
		class="start"
		x1={fit.x(course.points.cb)} y1={fit.y(course.points.cb)}
		x2={fit.x(course.points.pin)} y2={fit.y(course.points.pin)}
	/>
	<rect class="cb" x={fit.x(course.points.cb) - 8} y={fit.y(course.points.cb) - 6} width="16" height="12" rx="3" />
	<circle class="pin" cx={fit.x(course.points.pin)} cy={fit.y(course.points.pin)} r="4" />
	<circle class="finish" cx={fit.x(course.points.finish)} cy={fit.y(course.points.finish)} r="5" />
	{#each marks as m (m.name)}
		<circle class="mark" cx={m.x} cy={m.y} r="6" />
	{/each}
	{#each labels as l (l.text)}
		<text class="label" x={l.x} y={l.y} text-anchor="middle">{l.text}</text>
	{/each}

	<!-- Wind blows down the axis, from mark 1 towards the gate. -->
	<g transform="translate(52 52)">
		<g transform="rotate({axis + 180})">
			<line class="wind" x1="0" y1="22" x2="0" y2="-14" />
			<path class="wind-head" d="M0 -24L-6 -12H6Z" />
		</g>
		<text class="note" x="0" y="46" text-anchor="middle">wind</text>
	</g>
	<g transform="translate({W - 40} 44)">
		<line class="north" x1="0" y1="16" x2="0" y2="-12" />
		<path class="north-head" d="M0 -20L-5 -10H5Z" />
		<text class="note" x="0" y="34" text-anchor="middle">N</text>
	</g>
	<g transform="translate(24 {H - 24})">
		<path class="bar" d="M0 0H{bar * fit.scale}M0 -5V5M{bar * fit.scale} -5V5" />
		<text class="note" x={bar * fit.scale + 10} y="4">{bar} m</text>
	</g>
</svg>

<style>
	svg {
		width: 100%;
		height: auto;
		background: #f8fafc;
		border-radius: 8px;
	}

	.track {
		fill: none;
		stroke: var(--ink);
		stroke-width: 1.5;
		stroke-dasharray: 5 5;
	}

	.beat {
		stroke: var(--axis);
		stroke-width: 3;
	}

	.start {
		stroke: var(--start);
		stroke-width: 3;
	}

	.cb,
	.pin {
		fill: var(--start);
	}

	.finish {
		fill: #fff;
		stroke: var(--axis);
		stroke-width: 3;
	}

	.mark {
		fill: var(--ink);
	}

	.label {
		font-size: 16px;
		font-weight: 700;
		fill: var(--ink);
	}

	.note {
		font-size: 12px;
		fill: var(--muted);
	}

	.wind,
	.north,
	.bar {
		stroke: var(--ink);
		stroke-width: 2;
		fill: none;
	}

	.wind-head,
	.north-head {
		fill: var(--ink);
	}
</style>
