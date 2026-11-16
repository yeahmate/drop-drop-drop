<script lang="ts">
	import { DEFAULT_SPEC, type CourseSpec } from './lib/geo'
	import { courseFromHash, shareUrl } from './lib/share'
	import { deviceStorage, load, save } from './lib/store'
	import AngleCalculator from './lib/ui/AngleCalculator.svelte'
	import LayView from './lib/ui/LayView.svelte'
	import LineView from './lib/ui/LineView.svelte'
	import PlanView from './lib/ui/PlanView.svelte'
	import WindView from './lib/ui/WindView.svelte'

	const tabs = [
		{ id: 'plan', name: 'Plan' },
		{ id: 'lay', name: 'Lay' },
		{ id: 'line', name: 'Line' },
		{ id: 'wind', name: 'Wind' },
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
	let tab = $state<Tab>(tabs.find((t) => t.id === hashTab)?.id ?? (linked ? 'lay' : 'plan'))
	let shared = $state('')

	$effect(() => {
		save(storage, { spec: $state.snapshot(spec), unit, refLat, refLon, wind: $state.snapshot(wind), laid: $state.snapshot(laid), depth, warp })
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
	<h1>Drop Drop Drop</h1>
	<nav aria-label="Tools">
		{#each tabs as t (t.id)}
			<button type="button" aria-pressed={tab === t.id} onclick={() => (tab = t.id)}>{t.name}</button>
		{/each}
	</nav>
	<span class="grow"></span>
	<label class="unit">
		<span>Distances</span>
		<select bind:value={unit}>
			<option value="nm">NM first</option>
			<option value="m">Metres first</option>
		</select>
	</label>
	<button type="button" class="share" onclick={share}>Share course</button>
	{#if shared}<span class="shared" role="status">{shared}</span>{/if}
</header>

<main>
	{#if tab === 'plan'}
		<PlanView bind:spec {unit} bind:refLat bind:refLon />
	{:else if tab === 'lay'}
		<LayView {spec} {unit} bind:refLat bind:refLon bind:laid bind:depth bind:warp />
	{:else if tab === 'line'}
		<LineView {spec} {unit} />
	{:else if tab === 'wind'}
		<WindView bind:spec bind:wind />
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
		padding: 10px 16px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
	}

	h1 {
		margin: 0;
		font-size: 18px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	nav {
		display: flex;
		gap: 4px;
		background: #1b3550;
		padding: 4px;
		border-radius: 10px;
	}

	button,
	select {
		font: inherit;
		font-size: 14px;
		font-weight: 600;
		min-height: 44px;
		padding: 0 14px;
		border-radius: 8px;
		border: 0;
	}

	nav button {
		background: transparent;
		color: #fff;
	}

	nav button[aria-pressed='true'] {
		background: #fff;
		color: var(--ink);
	}

	.grow {
		flex: 1;
	}

	.unit {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: #c9d6e3;
	}

	.share {
		background: #f97316;
		color: var(--ink);
	}

	.shared {
		font-size: 13px;
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
