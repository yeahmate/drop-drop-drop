<script lang="ts">
	import { CHECKLIST, knownAnswers, progress, type BriefState } from '../checklist'
	import {
		assignments, buildCourse, equipment, formatBearing, formatDistance, layTable,
		type CourseSpec, type DistanceUnit,
	} from '../geo'

	let { spec, unit = 'nm', brief = $bindable({}) }: { spec: CourseSpec; unit?: DistanceUnit; brief?: BriefState } = $props()

	let pinEndBoat = $state(false)

	let course = $derived(buildCourse(spec))
	let known = $derived(knownAnswers(spec, unit))
	let done = $derived(progress(brief))
	let jobs = $derived(assignments(course))
	let table = $derived(Object.fromEntries(layTable(course).map((r) => [r.mark, r])))
	let kit = $derived(equipment(course, { pinEndBoat }))

	const entry = (id: string) => brief[id] ?? { done: false, note: '' }

	function toggle(id: string) {
		brief = { ...brief, [id]: { ...entry(id), done: !entry(id).done } }
	}

	function note(id: string, value: string) {
		brief = { ...brief, [id]: { ...entry(id), note: value.slice(0, 500) } }
	}

	function clear() {
		brief = {}
	}
</script>

<div class="brief">
	<section>
		<h2>Who lays what</h2>
		{#each jobs as job (job.boat)}
			<div class="job" data-testid="job-{job.boat}">
				<h3>{job.boat}</h3>
				<ul>
					{#each job.marks as m (m)}
						<li>
							<strong>{m}</strong>
							{#if table[m]}
								<span>{formatBearing(table[m].bearing)} · {formatDistance(table[m].distance, unit)} · GPS reads {formatBearing(table[m].gpsReads)}</span>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</section>

	<section>
		<h2>Load list</h2>
		<p class="fact" data-testid="kit">{kit.total} buoys, each with anchor and warp</p>
		<p class="hint">{kit.courseMarks} course marks, {kit.lineMarks} line {kit.lineMarks === 1 ? 'mark' : 'marks'}, {kit.spares} spare</p>
		<label class="check">
			<input type="checkbox" bind:checked={pinEndBoat} />
			A pin-end boat replaces the start pin buoy
		</label>
	</section>

	<section>
		<div class="head">
			<h2>Briefing checklist</h2>
			<span class="count" data-testid="progress">{done.done} of {done.total}</span>
		</div>
		<ul class="list">
			{#each CHECKLIST as item (item.id)}
				<li class:done={entry(item.id).done}>
					<label class="check">
						<input type="checkbox" checked={entry(item.id).done} onchange={() => toggle(item.id)} />
						<span>{item.text}</span>
					</label>
					{#if known[item.id]}<p class="known">{known[item.id]}</p>{/if}
					<input
						type="text" class="note" placeholder="Notes" aria-label="Notes: {item.text}"
						value={entry(item.id).note} onchange={(e) => note(item.id, e.currentTarget.value)}
					/>
				</li>
			{/each}
		</ul>
		<button type="button" onclick={clear}>Clear ticks and notes</button>
	</section>
</div>

<style>
	.brief {
		display: grid;
		gap: 16px;
		max-width: 640px;
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

	h3 {
		color: var(--ink);
		font-size: 16px;
		letter-spacing: 0;
		text-transform: none;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 6px;
	}

	.job {
		border: 1px solid var(--line);
		border-radius: 10px;
		padding: 10px 12px;
		display: grid;
		gap: 6px;
	}

	.job li {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		font-size: 15px;
	}

	.job strong {
		min-width: 76px;
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

	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.count {
		font-weight: 700;
	}

	.list li {
		border-top: 1px solid #e3e9ef;
		padding: 8px 0;
		display: grid;
		gap: 6px;
	}

	.list li.done span {
		color: var(--muted);
		text-decoration: line-through;
	}

	.check {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 44px;
		font-size: 16px;
		font-weight: 600;
	}

	.check input {
		width: 26px;
		height: 26px;
		flex: none;
	}

	.known {
		margin: 0 0 0 38px;
		font-size: 14px;
		color: var(--axis);
		font-weight: 600;
	}

	.note,
	button {
		font: inherit;
		font-size: 16px;
		color: var(--ink);
		min-height: 44px;
		padding: 0 12px;
		border: 1px solid #94a3b8;
		border-radius: 10px;
		background: #fff;
	}

	.note {
		margin-left: 38px;
	}

	button {
		font-weight: 600;
		min-height: 48px;
	}
</style>
