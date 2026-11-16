<script lang="ts">
	// Test harness: holds the course and log in state and binds them, as App does.
	import type { CourseSpec, WindReading } from '../geo'
	import WindView from './WindView.svelte'

	let { initial, readings = [] }: { initial: CourseSpec; readings?: WindReading[] } = $props()
	// svelte-ignore state_referenced_locally
	let spec = $state<CourseSpec>({ ...initial })
	// svelte-ignore state_referenced_locally
	let wind = $state<WindReading[]>([...readings])
	let tick = 0
</script>

<WindView bind:spec bind:wind now={() => (tick += 300000)} />
<output data-testid="axis">{spec.axis}</output>
<output data-testid="count">{wind.length}</output>
