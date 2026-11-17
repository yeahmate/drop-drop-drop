/**
 * Keeps the working course, reference point and logs on the device so the
 * app survives a reload with no signal. Storage can be missing or throw
 * (private browsing, full disk), so every access is guarded and everything
 * read back is validated.
 */

import type { CourseSpec, DistanceUnit, Vec, WindReading } from './geo'
import { decodeCourse, encodeCourse } from './share'

const KEY = 'drop-drop-drop:v1'

export interface Saved {
	spec: CourseSpec | null
	unit: DistanceUnit
	refLat: string
	refLon: string
	wind: WindReading[]
	/** Pinged positions of laid marks, metres from the reference point. */
	laid: Record<string, Vec>
	depth: number
	warp: number
	/** Briefing checklist ticks and notes. */
	brief: Record<string, { done: boolean; note: string }>
}

export const EMPTY: Saved = {
	spec: null, unit: 'nm', refLat: '', refLon: '', wind: [], laid: {}, depth: 10, warp: 20, brief: {},
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')

export function load(storage: StorageLike | undefined): Saved {
	let raw: unknown
	try {
		raw = JSON.parse(storage?.getItem(KEY) ?? 'null')
	} catch {
		return { ...EMPTY }
	}
	if (!raw || typeof raw !== 'object') return { ...EMPTY }
	const r = raw as Record<string, unknown>

	const wind = Array.isArray(r.wind)
		? r.wind
			.filter((w): w is WindReading =>
				!!w && finite(w.time) && finite(w.direction) && finite(w.speed)
				&& w.direction >= 0 && w.direction < 360 && w.speed >= 0 && w.speed <= 100)
			.map((w) => ({ time: w.time, direction: w.direction, speed: w.speed }))
			.slice(-200)
		: []

	const laid: Record<string, Vec> = {}
	if (r.laid && typeof r.laid === 'object') {
		for (const [name, p] of Object.entries(r.laid as Record<string, { e?: unknown; n?: unknown }>)) {
			if (/^[0-9A-Za-z]{1,4}$/.test(name) && p && finite(p.e) && finite(p.n)) laid[name] = { e: p.e, n: p.n }
		}
	}

	const brief: Saved['brief'] = {}
	if (r.brief && typeof r.brief === 'object') {
		for (const [id, b] of Object.entries(r.brief as Record<string, { done?: unknown; note?: unknown }>)) {
			if (/^[a-z]{1,20}$/.test(id) && b && typeof b === 'object') {
				brief[id] = { done: b.done === true, note: text(b.note, 500) }
			}
		}
	}

	return {
		spec: typeof r.spec === 'string' ? decodeCourse(r.spec) : null,
		unit: r.unit === 'm' ? 'm' : 'nm',
		refLat: text(r.refLat, 40),
		refLon: text(r.refLon, 40),
		wind,
		laid,
		depth: finite(r.depth) && r.depth > 0 && r.depth < 500 ? r.depth : EMPTY.depth,
		warp: finite(r.warp) && r.warp > 0 && r.warp < 1000 ? r.warp : EMPTY.warp,
		brief,
	}
}

/** Returns false if the device refused the write. */
export function save(storage: StorageLike | undefined, state: Saved): boolean {
	try {
		if (!storage) return false
		storage.setItem(KEY, JSON.stringify({ ...state, spec: state.spec ? encodeCourse(state.spec) : null }))
		return true
	} catch {
		return false
	}
}

/** The browser's storage, or undefined where it is unavailable. */
export function deviceStorage(): StorageLike | undefined {
	try {
		return globalThis.localStorage
	} catch {
		return undefined
	}
}
