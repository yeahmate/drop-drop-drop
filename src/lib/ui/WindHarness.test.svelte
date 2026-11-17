<script lang="ts">
	// Test harness: holds the course and log in state and binds them, as App does.
	import type { CourseSpec, Current, WindReading } from '../geo'
	import WindView from './WindView.svelte'

	let { initial, readings = [], tide = { set: 0, rate: 0 } }: { initial: CourseSpec; readings?: WindReading[]; tide?: Current } = $props()
	// svelte-ignore state_referenced_locally
	let spec = $state<CourseSpec>({ ...initial })
	// svelte-ignore state_referenced_locally
	let wind = $state<WindReading[]>([...readings])
	let tick = 0
</script>

<WindView bind:spec bind:wind {tide} now={() => (tick += 300000)} />
<output data-testid="last">{JSON.stringify(wind.at(-1) ?? null)}</output>
<output data-testid="axis">{spec.axis}</output>
<output data-testid="count">{wind.length}</output>
