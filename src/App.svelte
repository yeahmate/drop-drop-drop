<script lang="ts">
	import {
		DEFAULT_SPEC, formatVariation, northLetter, parseCoordinate, switchNorth, variation as variationAt,
		type CourseSpec, type North,
	} from './lib/geo'
	import { courseFromHash, shareUrl } from './lib/share'
	import { deviceStorage, load, save } from './lib/store'
	import AngleCalculator from './lib/ui/AngleCalculator.svelte'
	import BriefView from './lib/ui/BriefView.svelte'
	import ChangeView from './lib/ui/ChangeView.svelte'
	import LayView from './lib/ui/LayView.svelte'
	import LineView from './lib/ui/LineView.svelte'
	import PlanView from './lib/ui/PlanView.svelte'
	import TideView from './lib/ui/TideView.svelte'
	import WindView from './lib/ui/WindView.svelte'

	const tabs = [
		{ id: 'plan', name: 'Plan' },
		{ id: 'lay', name: 'Lay' },
		{ id: 'line', name: 'Line' },
		{ id: 'wind', name: 'Wind' },
		{ id: 'tide', name: 'Tide' },
		{ id: 'change', name: 'Change' },
		{ id: 'brief', name: 'Brief' },
		{ id: 'calc', name: 'Angles' },
	] as const
	type Tab = (typeof tabs)[number]['id']

	const storage = deviceStorage()
	const saved = load(storage)
	// A shared link wins over whatever was last open on this device.
	const linked = courseFromHash(location.hash)
	const hashTab = /[#&]t=(\w+)/.exec(location.hash)?.[1]

	let spec = $state<CourseSpec>(linked ?? saved.spec ?? { ...DEFAULT_SPEC, axis: 235 })
	let unit = $state(saved.unit)
	let refLat = $state(saved.refLat)
	let refLon = $state(saved.refLon)
	let wind = $state(saved.wind)
	let laid = $state(linked ? {} : saved.laid)
	let depth = $state(saved.depth)
	let warp = $state(saved.warp)
	let brief = $state(saved.brief)
	let tide = $state(saved.tide)
	let tab = $state<Tab>(tabs.find((t) => t.id === hashTab)?.id ?? (linked ? 'lay' : 'plan'))
	let shared = $state('')
	let settingsOpen = $state(false)

	function choose(id: Tab, button: HTMLElement) {
		tab = id
		// The tab strip scrolls sideways on a phone; keep the chosen tab in view.
		button.scrollIntoView?.({ inline: 'center', block: 'nearest' })
	}

	// Variation is worked out from the reference position and today's date.
	const today = new Date()
	let reference = $derived.by(() => {
		const lat = parseCoordinate(refLat, 'lat')
		const lon = parseCoordinate(refLon, 'lon')
		return lat.ok && lon.ok ? { lat: lat.value, lon: lon.value } : null
	})
	let variation = $derived(reference ? variationAt(reference, today) : null)

	function setNorth(event: Event) {
		const to = (event.currentTarget as HTMLSelectElement).value as North
		const next = switchNorth($state.snapshot(spec) as CourseSpec, $state.snapshot(wind), to, variation, tide.set)
		spec = next.spec
		wind = next.wind
		tide = { ...tide, set: next.tideSet }
	}

	$effect(() => {
		save(storage, { spec: $state.snapshot(spec), unit, refLat, refLon, wind: $state.snapshot(wind), laid: $state.snapshot(laid), depth, warp, brief: $state.snapshot(brief), tide: $state.snapshot(tide) })
	})

	async function share() {
		const url = shareUrl(spec, location.href)
		history.replaceState(null, '', url)
		try {
			await navigator.clipboard.writeText(url)
			shared = 'Link copied'
		} catch {
			shared = 'Link is in the address bar'
		}
	}
</script>

<header>
	<div class="bar">
		<h1>Drop Drop Drop</h1>
		<span class="grow"></span>
		<button
			type="button" class="chip" aria-expanded={settingsOpen} aria-controls="settings"
			aria-label="Settings: bearings {spec.north}, distances {unit === 'nm' ? 'nautical miles' : 'metres'} first"
			onclick={() => (settingsOpen = !settingsOpen)}
		>°{northLetter(spec.north)} · {unit === 'nm' ? 'NM' : 'm'}</button>
		<button type="button" class="share" onclick={share}>Share</button>
	</div>

	{#if settingsOpen}
		<div class="settings" id="settings">
			<label>
				<span>Bearings</span>
				<select value={spec.north} onchange={setNorth}>
					<option value="magnetic">Magnetic</option>
					<option value="true">True</option>
				</select>
			</label>
			<label>
				<span>Distances</span>
				<select bind:value={unit}>
					<option value="nm">NM first</option>
					<option value="m">Metres first</option>
				</select>
			</label>
			<p data-testid="variation">
				{#if variation !== null}
					Variation at the reference: {formatVariation(variation)}
				{:else if reference}
					The magnetic model has expired.
				{:else if spec.north === 'magnetic'}
					Bearings are magnetic. Set the reference position to apply variation to positions and GPS guidance.
				{:else}
					Bearings are true.
				{/if}
			</p>
		</div>
	{/if}

	<nav aria-label="Tools">
		{#each tabs as t (t.id)}
			<button type="button" aria-pressed={tab === t.id} onclick={(e) => choose(t.id, e.currentTarget)}>{t.name}</button>
		{/each}
	</nav>
</header>

{#if shared}<p class="notice" role="status">{shared}</p>{/if}
{#if reference && variation === null}
	<p class="notice warn" role="alert">
		The magnetic model has expired, so positions and GPS guidance treat magnetic as true. Update the app.
	</p>
{/if}

<main>
	{#if tab === 'plan'}
		<PlanView bind:spec {unit} bind:refLat bind:refLon {variation} />
	{:else if tab === 'lay'}
		<LayView {spec} {unit} bind:refLat bind:refLon bind:laid bind:depth bind:warp {variation} />
	{:else if tab === 'line'}
		<LineView {spec} {unit} />
	{:else if tab === 'wind'}
		<WindView bind:spec bind:wind {tide} />
	{:else if tab === 'tide'}
		<TideView bind:spec {wind} bind:tide />
	{:else if tab === 'change'}
		<ChangeView bind:spec {unit} />
	{:else if tab === 'brief'}
		<BriefView {spec} {unit} bind:brief />
	{:else}
		<div class="card">
			<AngleCalculator bind:axis={spec.axis} bind:angle={spec.angle} />
		</div>
	{/if}
</main>

<style>
	header {
		background: var(--ink);
		color: #fff;
		position: sticky;
		top: 0;
		z-index: 2;
	}

	.bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px 4px;
	}

	h1 {
		margin: 0;
		font-size: 16px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.grow {
		flex: 1;
	}

	button,
	select {
		font: inherit;
		font-size: 14px;
		font-weight: 600;
		min-height: 44px;
		padding: 0 12px;
		border-radius: 8px;
		border: 0;
	}

	.chip {
		background: #1b3550;
		color: #fff;
		border: 1px solid #5b7590;
		white-space: nowrap;
	}

	.chip[aria-expanded='true'] {
		background: #fff;
		color: var(--ink);
	}

	.share {
		background: #f97316;
		color: var(--ink);
	}

	.settings {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 16px;
		padding: 8px 12px;
		background: #1b3550;
	}

	.settings label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: #c9d6e3;
	}

	.settings p {
		margin: 0;
		flex: 1 1 240px;
		font-size: 13px;
		color: #c9d6e3;
	}

	/* One row of tabs that scrolls sideways when it does not fit. */
	nav {
		display: flex;
		gap: 4px;
		padding: 4px 12px 8px;
		overflow-x: auto;
		scrollbar-width: none;
	}

	nav::-webkit-scrollbar {
		display: none;
	}

	nav button {
		background: #1b3550;
		color: #fff;
		flex: none;
	}

	nav button[aria-pressed='true'] {
		background: #fff;
		color: var(--ink);
	}

	.notice {
		margin: 0;
		padding: 8px 16px;
		font-size: 14px;
		font-weight: 600;
		background: #dcfce7;
	}

	.notice.warn {
		background: #fee2e2;
		color: var(--warn);
	}

	main {
		max-width: 1280px;
		margin: 0 auto;
		padding: 16px;
	}

	.card {
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 12px;
		padding: 16px;
		max-width: 760px;
		margin: 0 auto;
	}
</style>
