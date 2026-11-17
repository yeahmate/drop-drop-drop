// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Runs the shell test suite for the deployment scripts so `npm test` covers
// them too. See deploy/tests/run.sh for the individual checks.
describe('deployment scripts', () => {
	it('pass their shell test suite', () => {
		const script = fileURLToPath(new URL('./run.sh', import.meta.url))
		const result = spawnSync('bash', [script], { encoding: 'utf8', timeout: 110_000 })
		const failures = result.stdout.split('\n').filter((line) => line.startsWith('FAIL'))
		expect(failures).toEqual([])
		expect(result.status).toBe(0)
	}, 120_000)
})
