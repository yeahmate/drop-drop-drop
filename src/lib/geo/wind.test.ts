import { describe, expect, it } from 'vitest'
import {
	angleDiff, meanDirection, pinBoatAnchorBearings, skewFromAxis, spokenDigits, startLine,
	summarise, windReport,
} from './index'

const reading = (direction: number, speed = 10, i = 0) => ({ time: i * 300000, direction, speed })

describe('wind directions', () => {
	it('averages across north', () => {
		expect(meanDirection([350, 10])).toBeCloseTo(0)
		expect(meanDirection([355, 5, 15])).toBeCloseTo(5)
		expect(meanDirection([230, 240])).toBeCloseTo(235)
	})

	it('takes signed differences the short way round', () => {
		expect(angleDiff(10, 350)).toBe(20)
		expect(angleDiff(350, 10)).toBe(-20)
		expect(angleDiff(232, 235)).toBe(-3)
	})

	it('summarises mean, range and speed', () => {
		const s = summarise([232, 238, 240, 235, 230].map((d, i) => reading(d, 9 + i, i)))!
		expect(s.count).toBe(5)
		expect(s.mean).toBeCloseTo(235, 0)
		expect(Math.round(s.low)).toBe(230)
		expect(Math.round(s.high)).toBe(240)
		expect(s.meanSpeed).toBe(11)
		expect(s.minSpeed).toBe(9)
		expect(s.maxSpeed).toBe(13)
	})

	it('gives a range that spans north', () => {
		const s = summarise([350, 0, 10].map((d, i) => reading(d, 10, i)))!
		expect(Math.round(s.low)).toBe(350)
		expect(Math.round(s.high)).toBe(10)
	})

	it('detects a steady veer and a steady back', () => {
		expect(summarise([200, 205, 210, 215].map((d, i) => reading(d, 10, i)))!.trend).toBeCloseTo(5)
		expect(summarise([10, 5, 0, 355].map((d, i) => reading(d, 10, i)))!.trend).toBeCloseTo(-5)
		expect(summarise([235, 235, 235].map((d, i) => reading(d, 10, i)))!.trend).toBeCloseTo(0)
	})

	it('has nothing to say with no readings', () => {
		expect(summarise([])).toBeNull()
	})
})

describe('skew from the axis', () => {
	// RM Manual L.6.4: no change under 15 degrees, consider one from 20.
	it('holds under 15 degrees', () => {
		expect(skewFromAxis(232, 235)).toEqual({ degrees: 3, side: 'left', advice: 'hold' })
		expect(skewFromAxis(249, 235).advice).toBe('hold')
	})

	it('watches from 15 and advises a change from 20', () => {
		expect(skewFromAxis(250, 235)).toEqual({ degrees: 15, side: 'right', advice: 'watch' })
		expect(skewFromAxis(215, 235)).toEqual({ degrees: 20, side: 'left', advice: 'change' })
	})

	it('works across north', () => {
		expect(skewFromAxis(5, 350)).toEqual({ degrees: 15, side: 'right', advice: 'watch' })
	})
})

describe('VHF wording', () => {
	it('speaks digits singly', () => {
		expect(spokenDigits('135')).toBe('one three five')
		expect(spokenDigits('4769')).toBe('four seven six nine')
	})

	it('builds the workbook wind report', () => {
		// Workbook Module 5: "wind at Mark 1, two three zero degrees, 10 knots".
		expect(windReport('Mark 1', 230, 10)).toBe(
			'Committee wind, wind at Mark 1, two three zero degrees, one zero knots',
		)
		expect(windReport('Mark 1', 5, 8)).toContain('zero zero five degrees, eight knots')
	})
})

describe('start line', () => {
	it('gives the square line bearings', () => {
		// Workbook Module 7 exercise 3 and Module 9 exercise 4.
		for (const [axis, pinToCb] of [[305, 35], [170, 260], [355, 85], [70, 160], [5, 95], [175, 265]]) {
			expect(startLine(axis, 250).pinToCb).toBe(pinToCb)
		}
		expect(startLine(0, 250).cbToPin).toBe(270) // reference charts
		expect(startLine(175, 250).pinMove).toBe(0)
	})

	it('moves the pin by line length times tan of the bias', () => {
		// Angle calculator table: 300 m line, 10 degrees is 53 m.
		expect(Math.round(startLine(175, 300, 10).pinMove)).toBe(53)
		expect(startLine(175, 300, 10).pinToCb).toBe(275)
		expect(Math.round(startLine(175, 300, -10).pinMove)).toBe(53)
	})

	it('anchors the pin-end boat 12 to 15 degrees high', () => {
		// Workbook Module 9 exercise 5: 277 to 280 for axis 175.
		expect(pinBoatAnchorBearings(175)).toEqual({ from: 277, to: 280 })
		expect(pinBoatAnchorBearings(260)).toEqual({ from: 2, to: 5 })
	})
})
