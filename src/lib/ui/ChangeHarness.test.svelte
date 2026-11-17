<script lang="ts">
	// Test harness: holds the course in state and binds it, as App does.
	import type { CourseSpec, DistanceUnit } from '../geo'
	import ChangeView from './ChangeView.svelte'

	let { initial, unit = 'm' }: { initial: CourseSpec; unit?: DistanceUnit } = $props()
	// svelte-ignore state_referenced_locally
	let spec = $state<CourseSpec>({ ...initial })
</script>

<ChangeView bind:spec {unit} />
<output data-testid="axis">{spec.axis}</output>
<output data-testid="beat">{Math.round(spec.beat)}</output>
