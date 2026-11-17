import { describe, expect, it } from 'vitest'
import { CHECKLIST, knownAnswers, progress } from './checklist'
import { DEFAULT_SPEC } from './geo'

describe('briefing checklist', () => {
	it('has the 24 items of the spreadsheet, each with a unique id', () => {
		expect(CHECKLIST).toHaveLength(24)
		expect(new Set(CHECKLIST.map((i) => i.id)).size).toBe(24)
		expect(CHECKLIST[0].text).toBe('Race area / colour')
		expect(CHECKLIST[23].text).toContain('Mobile phone numbers')
	})

	it('fills in what the course already knows', () => {
		const known = knownAnswers({ ...DEFAULT_SPEC, type: 'IX', beats: 2, axis: 235, startLine: 270, gateWidth: 42 }, 'nm')
		expect(known.course).toBe('IX2, axis 235: Start – 1 – 4s/4p – 1 – 2 – 3p – 5 – Finish')
		expect(known.start).toBe('0.15 NM (270 m)')
		expect(known.gate).toBe('0.023 NM (42 m)')
		expect(known.gps).toContain('Nautical miles first')
		for (const id of Object.keys(known)) expect(CHECKLIST.some((i) => i.id === id)).toBe(true)
	})

	it('counts progress', () => {
		expect(progress({})).toEqual({ done: 0, total: 24 })
		expect(progress({ vhf: { done: true, note: '' }, fuel: { done: false, note: 'x' }, nope: { done: true, note: '' } }))
			.toEqual({ done: 1, total: 24 })
	})
})
