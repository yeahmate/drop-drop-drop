#!/usr/bin/env node
// Changelog tool. See changelog.d/README.md.
//
//   npm run changelog -- check             validate the fragments
//   npm run changelog -- preview           show the unreleased section
//   npm run changelog -- release 0.2.0     fold fragments into CHANGELOG.md

import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, insert, render, validVersion } from './changelog-lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'changelog.d')
const changelogPath = join(root, 'CHANGELOG.md')

function fragments() {
	return readdirSync(dir)
		.filter((file) => file !== 'README.md' && !file.startsWith('.'))
		.map((file) => ({ file, body: readFileSync(join(dir, file), 'utf8') }))
}

function fail(lines) {
	for (const line of lines) console.error(line)
	process.exit(1)
}

const [command, version] = process.argv.slice(2)
const found = fragments()
const errors = check(found)

if (command === 'check') {
	if (errors.length) fail(errors)
	console.log(`${found.length} changelog fragment${found.length === 1 ? '' : 's'} OK`)
} else if (command === 'preview') {
	if (errors.length) fail(errors)
	console.log(found.length ? render(found, 'Unreleased', 'not yet released') : 'No unreleased changes.')
} else if (command === 'release') {
	if (!validVersion(version ?? '')) fail(['Give a version like 0.2.0: npm run changelog -- release 0.2.0'])
	if (errors.length) fail(errors)
	if (!found.length) fail(['There are no fragments in changelog.d/ to release.'])
	const date = new Date().toISOString().slice(0, 10)
	writeFileSync(changelogPath, insert(readFileSync(changelogPath, 'utf8'), render(found, version, date)))
	for (const { file } of found) rmSync(join(dir, file))
	console.log(`CHANGELOG.md updated for ${version}; ${found.length} fragments removed. Review and commit.`)
} else {
	fail(['Usage: npm run changelog -- check | preview | release <version>'])
}
