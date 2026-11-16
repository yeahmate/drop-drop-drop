/**
 * Share a course as a link. The whole spec travels in the URL fragment, so
 * mark layers open the same course with no account and no server.
 */

import { COURSE_TYPES, DEFAULT_SPEC, type CourseSpec, type CourseType } from './geo/library'

const VERSION = 1

type Limits = Record<Exclude<keyof CourseSpec, 'type'>, [min: number, max: number]>

const LIMITS: Limits = {
	beats: [1, 6],
	axis: [0, 359.999],
	beat: [50, 10000],
	angle: [30, 120],
	reachRatio: [0.2, 2],
	outerRatio: [0.2, 2],
	gateWidth: [5, 500],
	startLine: [10, 2000],
	startOffset: [0, 1000],
	offsetAngle: [45, 135],
	offsetDistance: [10, 500],
	finishLine: [10, 1000],
	finishReach: [10, 2000],
	mark5Offset: [10, 2000],
}

const KEYS = Object.keys(LIMITS) as (keyof Limits)[]

function toBase64Url(text: string): string {
	return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): string {
	return atob(text.replace(/-/g, '+').replace(/_/g, '/'))
}

export function encodeCourse(spec: CourseSpec): string {
	const values = KEYS.map((k) => Math.round(spec[k] * 1e5) / 1e5)
	return toBase64Url(JSON.stringify([VERSION, spec.type, ...values]))
}

/** Returns null for anything that is not a valid, in-range course. */
export function decodeCourse(code: string): CourseSpec | null {
	let data: unknown
	try {
		data = JSON.parse(fromBase64Url(code))
	} catch {
		return null
	}
	if (!Array.isArray(data) || data.length !== KEYS.length + 2 || data[0] !== VERSION) return null
	const type = data[1] as CourseType
	if (!COURSE_TYPES.some((c) => c.type === type)) return null

	const spec: CourseSpec = { ...DEFAULT_SPEC, type }
	for (let i = 0; i < KEYS.length; i++) {
		const value = data[i + 2]
		const [min, max] = LIMITS[KEYS[i]]
		if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return null
		spec[KEYS[i]] = value
	}
	if (!Number.isInteger(spec.beats)) return null
	return spec
}

export function shareUrl(spec: CourseSpec, base: string): string {
	return `${base.split('#')[0]}#c=${encodeCourse(spec)}`
}

export function courseFromHash(hash: string): CourseSpec | null {
	const match = /[#&]c=([A-Za-z0-9_-]+)/.exec(hash)
	return match ? decodeCourse(match[1]) : null
}
