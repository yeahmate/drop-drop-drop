import { describe, expect, it } from 'vitest'
import { DEFAULT_SPEC } from './geo'
import { EMPTY, load, save, type Saved } from './store'

function memory(initial?: string) {
	let value = initial ?? null
	return {
		getItem: () => value,
		setItem: (_key: string, v: string) => { value = v },
		read: () => value,
	}
}

const state: Saved = {
	spec: { ...DEFAULT_SPEC, type: 'OX', beats: 3, axis: 235 },
	unit: 'm',
	refLat: "N 50° 35.212'",
	refLon: "W 002° 26.874'",
	wind: [{ time: 1000, direction: 232, speed: 11 }],
	laid: { '1': { e: -737, n: -516 } },
	depth: 12,
	warp: 25,
}

describe('saved state', () => {
	it('round-trips through storage', () => {
		const storage = memory()
		expect(save(storage, state)).toBe(true)
		const back = load(storage)
		expect(back.spec?.type).toBe('OX')
		expect(back.spec?.axis).toBe(235)
		expect({ ...back, spec: null }).toEqual({ ...state, spec: null })
	})

	it('starts empty with no storage, no data or broken data', () => {
		expect(load(undefined)).toEqual(EMPTY)
		expect(load(memory())).toEqual(EMPTY)
		expect(load(memory('{not json'))).toEqual(EMPTY)
		expect(load(memory('"text"'))).toEqual(EMPTY)
	})

	it('drops anything invalid and keeps the rest', () => {
		const back = load(memory(JSON.stringify({
			spec: 'garbage',
			unit: 'furlongs',
			refLat: 42,
			wind: [{ time: 1, direction: 400, speed: 5 }, { time: 2, direction: 90, speed: 12 }, null, 'x'],
			laid: { '1': { e: 1, n: 2 }, 'bad name!': { e: 1, n: 2 }, '2': { e: 'x', n: 2 } },
			depth: -4,
			warp: 30,
		})))
		expect(back.spec).toBeNull()
		expect(back.unit).toBe('nm')
		expect(back.refLat).toBe('')
		expect(back.wind).toEqual([{ time: 2, direction: 90, speed: 12 }])
		expect(back.laid).toEqual({ '1': { e: 1, n: 2 } })
		expect(back.depth).toBe(EMPTY.depth)
		expect(back.warp).toBe(30)
	})

	it('reports a refused write instead of throwing', () => {
		const full = { getItem: () => null, setItem: () => { throw new Error('quota') } }
		expect(save(full, state)).toBe(false)
		expect(save(undefined, state)).toBe(false)
	})
})
