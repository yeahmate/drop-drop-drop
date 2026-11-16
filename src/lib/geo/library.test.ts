import { describe, expect, it } from 'vitest'
import {
	DEFAULT_SPEC, buildCourse, estimatedMinutes, leg, metresToNm, nmToMetres, norm,
	roundingOrder, signal, type CourseSpec,
} from './index'

const spec = (over: Partial<CourseSpec>): CourseSpec => ({ ...DEFAULT_SPEC, ...over })
const round = (n: number) => Math.round(norm(n)) % 360

describe('rounding orders', () => {
	// Europe Nationals 2022 sailing instructions, Appendix A, and the
	// workbook's Module 7 course diagrams.
	const cases: [Partial<CourseSpec>, string][] = [
		[{ type: 'OX', beats: 2 }, 'Start – 1 – 2 – 3s/3p – 2 – 3p – 5 – Finish'],
		[{ type: 'OX', beats: 3 }, 'Start – 1 – 2 – 3s/3p – 2 – 3s/3p – 2 – 3p – 5 – Finish'],
		[{ type: 'IX', beats: 2 }, 'Start – 1 – 4s/4p – 1 – 2 – 3p – 5 – Finish'],
		[{ type: 'IX', beats: 4 }, 'Start – 1 – 4s/4p – 1 – 4s/4p – 1 – 4s/4p – 1 – 2 – 3p – 5 – Finish'],
		[{ type: 'O', beats: 2 }, 'Start – 1 – 2 – 3s/3p – 2 – 3p – Finish'],
		[{ type: 'I', beats: 2 }, 'Start – 1 – 4s/4p – 1 – 2 – 3p – Finish'],
		[{ type: 'LR', beats: 2 }, 'Start – 1 – 2s/2p – 1 – 2p – Finish'],
		[{ type: 'LR', beats: 3 }, 'Start – 1 – 2s/2p – 1 – 2s/2p – 1 – 2p – Finish'],
		[{ type: 'LA', beats: 2 }, 'Start – 1 – 1a – 2s/2p – 1 – 1a – Finish'],
		[{ type: 'L', beats: 2 }, 'Start – 1 – 2s/2p – 1 – Finish'],
		[{ type: 'LRA', beats: 2 }, 'Start – 1 – 1a – 2s/2p – 1 – 1a – 2p – Finish'],
	]
	for (const [over, expected] of cases) {
		const s = spec(over)
		it(signal(s), () => expect(roundingOrder(buildCourse(s))).toBe(expected))
	}
})

describe('marks to lay', () => {
	it('lists the trapezoid marks, with mark 5 only on X courses', () => {
		expect(Object.keys(buildCourse(spec({ type: 'I' })).marks).sort()).toEqual(['1', '2', '3p', '3s', '4p', '4s'])
		expect(Object.keys(buildCourse(spec({ type: 'OX' })).marks)).toContain('5')
	})

	it('lists the windward/leeward marks, with 1a only on A courses', () => {
		expect(Object.keys(buildCourse(spec({ type: 'L' })).marks).sort()).toEqual(['1', '2p', '2s'])
		expect(Object.keys(buildCourse(spec({ type: 'LRA' })).marks)).toContain('1a')
	})

	it('needs seven marks for the Europe Nationals course', () => {
		// SIs 10.1 and 10.2: marks 1, 2, 3s, 3p, 4s, 4p and 5.
		expect(Object.keys(buildCourse(spec({ type: 'IX' })).marks)).toHaveLength(7)
	})
})

describe('course length', () => {
	// Reference chart distance tables: start 0.05 NM below gate 4, finish
	// 0.15 NM from gate 3, reach two thirds of the beat. The chart's first
	// column (labelled I1/O1) has two beats.
	const chart = [[0.2, 1.13, 1.53, 1.93], [0.5, 2.53, 3.53, 4.53], [1.0, 4.87, 6.87, 8.87]]
	for (const angle of [60, 70, 80]) {
		for (const [beat, two, three, four] of chart) {
			it(`matches the ${angle} degree chart at ${beat} NM`, () => {
				const base = { beat: nmToMetres(beat), angle, gateWidth: 0 }
				const length = (type: 'I' | 'O', beats: number) =>
					metresToNm(buildCourse(spec({ ...base, type, beats })).length)
				expect(length('I', 2)).toBeCloseTo(two, 2)
				expect(length('I', 3)).toBeCloseTo(three, 2)
				expect(length('I', 4)).toBeCloseTo(four, 2)
				expect(length('O', 2)).toBeCloseTo(two, 2)
				expect(length('O', 4)).toBeCloseTo(four, 2)
			})
		}
	}

	it('adds two beats per extra lap on a windward/leeward', () => {
		const l2 = buildCourse(spec({ type: 'L', beats: 2, beat: 1000 })).length
		const l3 = buildCourse(spec({ type: 'L', beats: 3, beat: 1000 })).length
		expect(l3 - l2).toBeCloseTo(2000)
	})

	it('estimates time from length and speed', () => {
		expect(estimatedMinutes(nmToMetres(4), 6)).toBeCloseTo(40)
	})
})

describe('lines', () => {
	it('lays a square start line with the committee boat to starboard', () => {
		const c = buildCourse(spec({ axis: 175, startLine: 250 }))
		const line = leg(c.points.pin, c.points.cb)
		expect(round(line.bearing)).toBe(265) // workbook Module 9 exercise 4
		expect(line.distance).toBeCloseTo(250)
	})

	it('puts the start line below the reference point', () => {
		const c = buildCourse(spec({ axis: 235, startOffset: 100 }))
		const l = leg(c.points.ref, c.points.start)
		expect(round(l.bearing)).toBe(55)
		expect(l.distance).toBeCloseTo(100)
	})

	it('finishes a reaching trapezoid on the chart bearing from gate 3', () => {
		const c = buildCourse(spec({ type: 'I', axis: 0, angle: 70, gateWidth: 0 }))
		expect(round(leg(c.marks['3p'], c.points.finish).bearing)).toBe(110)
	})
})
