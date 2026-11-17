import { describe, expect, it } from 'vitest'
import {
	DEFAULT_SPEC, ORIGIN, assignments, buildCourse, changeLeg, equipment, offset, type CourseSpec,
} from './index'

const spec = (over: Partial<CourseSpec>) => buildCourse({ ...DEFAULT_SPEC, ...over })

describe('course change', () => {
	const mark = offset(ORIGIN, 235, 900)

	it('turns the beat to starboard and gives the mark boat its move', () => {
		const c = changeLeg({ from: ORIGIN, mark, bearing: 250 })
		expect(c.turn).toBeCloseTo(15)
		expect(c.direction).toBe('starboard')
		expect(c.length).toBe('same')
		expect(c.signal).toEqual({ needed: true, bearing: '250', shape: 'green triangle', sign: null })
		// Chord of a 15 degree turn at 900 m.
		expect(c.move.distance).toBeCloseTo(2 * 900 * Math.sin((7.5 * Math.PI) / 180), 1)
		expect(Math.round(c.after.reciprocal)).toBe(70)
	})

	it('turns to port across north', () => {
		const c = changeLeg({ from: ORIGIN, mark: offset(ORIGIN, 5, 900), bearing: 350 })
		expect(c.direction).toBe('port')
		expect(c.turn).toBeCloseTo(15)
		expect(c.signal.shape).toBe('red rectangle')
		expect(c.signal.bearing).toBe('350')
	})

	it('lengthens and shortens along the same bearing', () => {
		const longer = changeLeg({ from: ORIGIN, mark, length: 1080 })
		expect(longer.direction).toBe('none')
		expect(longer.length).toBe('longer')
		expect(longer.lengthChange).toBeCloseTo(0.2)
		expect(longer.signal).toEqual({ needed: true, bearing: '235', shape: null, sign: '+' })
		expect(Math.round(longer.move.bearing)).toBe(235)
		expect(longer.move.distance).toBeCloseTo(180)

		const shorter = changeLeg({ from: ORIGIN, mark, length: 700 })
		expect(shorter.signal.sign).toBe('−')
		expect(Math.round(shorter.move.bearing)).toBe(55)
	})

	it('combines a turn and a length change', () => {
		const c = changeLeg({ from: ORIGIN, mark, bearing: 220, length: 1000 })
		expect(c.signal).toEqual({ needed: true, bearing: '220', shape: 'red rectangle', sign: '+' })
	})

	it('needs no signal for no change, or inside the limit the SIs allow', () => {
		expect(changeLeg({ from: ORIGIN, mark }).signal.needed).toBe(false)
		// Europe Nationals SI 11.2: up to 100 m without signalling.
		expect(changeLeg({ from: ORIGIN, mark, length: 980, noSignalWithin: 100 }).signal.needed).toBe(false)
		expect(changeLeg({ from: ORIGIN, mark, length: 1010, noSignalWithin: 100 }).signal.needed).toBe(true)
		expect(changeLeg({ from: ORIGIN, mark, length: 980 }).signal.needed).toBe(true)
	})

	it('works for a leg that does not start at the reference', () => {
		const from = offset(ORIGIN, 0, 900)
		const reachMark = offset(from, 250, 600)
		const c = changeLeg({ from, mark: reachMark, bearing: 240 })
		expect(c.direction).toBe('port')
		expect(c.after.distance).toBeCloseTo(600)
	})
})

describe('mark boat assignments', () => {
	it('splits a trapezoid between three boats', () => {
		expect(assignments(spec({ type: 'IX' }))).toEqual([
			{ boat: 'Marks 1', marks: ['1', '2'] },
			{ boat: 'Marks 3', marks: ['3s', '3p', '5'] },
			{ boat: 'Marks 4', marks: ['4s', '4p', 'Pin', 'Finish pin'] },
		])
		expect(assignments(spec({ type: 'O' }))[1].marks).toEqual(['3s', '3p'])
	})

	it('splits a windward/leeward between two boats', () => {
		expect(assignments(spec({ type: 'LA' }))).toEqual([
			{ boat: 'Marks 1', marks: ['1', '1a'] },
			{ boat: 'Marks 2', marks: ['2s', '2p', 'Pin', 'Finish pin'] },
		])
	})

	it('gives every course mark to exactly one boat', () => {
		for (const type of ['L', 'LA', 'LR', 'LRA', 'I', 'O', 'IX', 'OX'] as const) {
			const course = spec({ type })
			const given = assignments(course).flatMap((j) => j.marks).filter((m) => m in course.marks)
			expect(given.sort()).toEqual(Object.keys(course.marks).sort())
		}
	})
})

describe('equipment', () => {
	it('counts buoys for the Europe Nationals course', () => {
		// Seven course marks, a start pin, a finish pin and one spare.
		expect(equipment(spec({ type: 'IX' }))).toEqual({ courseMarks: 7, lineMarks: 2, spares: 1, total: 10 })
	})

	it('drops the start pin for a pin-end boat and reuses it for a finish at the start', () => {
		expect(equipment(spec({ type: 'IX' }), { pinEndBoat: true }).lineMarks).toBe(1)
		expect(equipment(spec({ type: 'L' }))).toEqual({ courseMarks: 3, lineMarks: 1, spares: 1, total: 5 })
		expect(equipment(spec({ type: 'L' }), { pinEndBoat: true, spares: 2 }).total).toBe(5)
	})
})
