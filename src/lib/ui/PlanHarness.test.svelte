<script lang="ts">
	// Test harness: holds the course in state and binds it, as App does.
	import type { CourseSpec, DistanceUnit } from '../geo'
	import PlanView from './PlanView.svelte'

	let { initial, unit = 'nm', variation = null }: { initial: CourseSpec; unit?: DistanceUnit; variation?: number | null } = $props()
	// svelte-ignore state_referenced_locally
	let spec = $state<CourseSpec>({ ...initial })
</script>

<PlanView bind:spec {unit} {variation} />
