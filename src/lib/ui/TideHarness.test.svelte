<script lang="ts">
	// Test harness: holds the course and current in state and binds them, as App does.
	import type { CourseSpec, Current, WindReading } from '../geo'
	import TideView from './TideView.svelte'

	let { initial, wind = [], current = { set: 0, rate: 0 } }: { initial: CourseSpec; wind?: WindReading[]; current?: Current } = $props()
	// svelte-ignore state_referenced_locally
	let spec = $state<CourseSpec>({ ...initial })
	// svelte-ignore state_referenced_locally
	let tide = $state<Current>({ ...current })
</script>

<TideView bind:spec {wind} bind:tide />
<output data-testid="axis">{spec.axis}</output>
<output data-testid="tide">{tide.set} {tide.rate}</output>
