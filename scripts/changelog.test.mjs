// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MARKER, check, checkBody, insert, parseName, render, validVersion } from './changelog-lib.mjs'

describe('fragment names', () => {
	it('accepts <short-name>.<type>.md', () => {
		expect(parseName('wind-log.added.md')).toEqual({ ok: true, slug: 'wind-log', type: 'added' })
		expect(parseName('gps2.fixed.md').ok).toBe(true)
	})

	it('rejects other shapes and unknown types', () => {
		for (const name of ['wind-log.md', 'Wind-Log.added.md', 'wind_log.added.md', 'wind-log.added.txt', '.added.md', 'a..added.md']) {
			expect(parseName(name).ok).toBe(false)
		}
		expect(parseName('wind-log.feature.md').error).toContain('type must be one of')
	})
})

describe('fragment bodies', () => {
	it('accepts bullets with indented continuation lines', () => {
		expect(checkBody('a.added.md', '- One thing.\n- Another thing\n  that wraps.\n')).toEqual([])
	})

	it('rejects empty files, headings and loose prose', () => {
		expect(checkBody('a.added.md', '  \n')).toEqual(['a.added.md: is empty'])
		expect(checkBody('a.added.md', '## Added\n- x')).toHaveLength(2)
		expect(checkBody('a.added.md', '- x\nloose line')[0]).toContain('a.added.md:2')
	})
})

describe('release', () => {
	const fragments = [
		{ file: 'zeta.fixed.md', body: '- Fixed zeta.\n' },
		{ file: 'beta.added.md', body: '- Added beta.\n' },
		{ file: 'alpha.added.md', body: '- Added alpha\n  with detail.\n' },
		{ file: 'old.removed.md', body: '- Removed old.' },
	]

	it('groups by type in a fixed order and sorts within a type', () => {
		expect(render(fragments, '0.2.0', '2026-11-17')).toBe(
			'## 0.2.0 - 2026-11-17\n\n### Added\n\n- Added alpha\n  with detail.\n- Added beta.\n\n### Fixed\n\n- Fixed zeta.\n\n### Removed\n\n- Removed old.\n',
		)
	})

	it('puts the newest release first', () => {
		const start = `# Changelog\n\n${MARKER}\n\n## 0.1.0 - 2026-11-01\n\n### Added\n\n- First.\n`
		const next = insert(start, render(fragments.slice(0, 1), '0.2.0', '2026-11-17'))
		expect(next.indexOf('## 0.2.0')).toBeGreaterThan(next.indexOf(MARKER))
		expect(next.indexOf('## 0.2.0')).toBeLessThan(next.indexOf('## 0.1.0'))
		expect(next).toContain('- First.')
	})

	it('refuses a changelog without the marker, and bad versions', () => {
		expect(() => insert('# Changelog\n', 'x')).toThrow()
		expect(validVersion('0.2.0')).toBe(true)
		expect(validVersion('v0.2')).toBe(false)
	})
})

describe('this repository', () => {
	const dir = new URL('../changelog.d/', import.meta.url)
	const fragments = readdirSync(dir)
		.filter((file) => file !== 'README.md' && !file.startsWith('.'))
		.map((file) => ({ file, body: readFileSync(new URL(file, dir), 'utf8') }))

	it('has only valid fragments in changelog.d', () => {
		expect(check(fragments)).toEqual([])
	})

	it('has a changelog with the release marker', () => {
		expect(readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8')).toContain(MARKER)
	})
})
