// Changelog fragments: one small file per change in changelog.d/, so two
// branches never edit the same lines of CHANGELOG.md. Pure functions here;
// scripts/changelog.mjs does the file work.

export const TYPES = ['added', 'changed', 'fixed', 'removed', 'security']

const HEADINGS = { added: 'Added', changed: 'Changed', fixed: 'Fixed', removed: 'Removed', security: 'Security' }

const NAME = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.([a-z]+)\.md$/

/** Split "wind-log.added.md" into its parts, or say what is wrong with it. */
export function parseName(file) {
	const match = NAME.exec(file)
	if (!match) return { ok: false, error: `${file}: name must be <short-name>.<type>.md in lower case with hyphens` }
	if (!TYPES.includes(match[2])) return { ok: false, error: `${file}: type must be one of ${TYPES.join(', ')}` }
	return { ok: true, slug: match[1], type: match[2] }
}

/** A fragment is one or more "- " bullets; continuation lines are indented. */
export function checkBody(file, body) {
	const lines = body.replace(/\r\n/g, '\n').trim().split('\n')
	if (lines.length === 1 && lines[0] === '') return [`${file}: is empty`]
	const errors = []
	if (!lines[0].startsWith('- ')) errors.push(`${file}: must start with a "- " bullet`)
	lines.forEach((line, i) => {
		if (line.startsWith('#')) errors.push(`${file}:${i + 1}: no headings; the release script adds them`)
		else if (line !== '' && !line.startsWith('- ') && !/^\s+\S/.test(line)) {
			errors.push(`${file}:${i + 1}: start a new bullet with "- " or indent a continuation line`)
		}
	})
	return errors
}

/** Validate a set of { file, body } fragments. Returns a list of problems. */
export function check(fragments) {
	const errors = []
	for (const { file, body } of fragments) {
		const name = parseName(file)
		if (!name.ok) errors.push(name.error)
		errors.push(...checkBody(file, body))
	}
	return errors
}

/** The section for one release, grouped by type in a fixed order. */
export function render(fragments, version, date) {
	const sections = []
	for (const type of TYPES) {
		const bodies = fragments
			.filter((f) => parseName(f.file).type === type)
			.sort((a, b) => a.file.localeCompare(b.file))
			.map((f) => f.body.replace(/\r\n/g, '\n').trim())
		if (bodies.length) sections.push(`### ${HEADINGS[type]}\n\n${bodies.join('\n')}`)
	}
	return `## ${version} - ${date}\n\n${sections.join('\n\n')}\n`
}

export const MARKER = '<!-- releases -->'

/** Put a rendered release at the top of the changelog, under the marker. */
export function insert(changelog, release) {
	if (!changelog.includes(MARKER)) throw new Error(`CHANGELOG.md has no ${MARKER} line`)
	return changelog.replace(MARKER, `${MARKER}\n\n${release.trimEnd()}`)
}

export function validVersion(version) {
	return /^\d+\.\d+\.\d+$/.test(version)
}
