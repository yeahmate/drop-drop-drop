import { describe, expect, it } from 'vitest'
import {
	formatBearing, formatDistance, leg, nmToMetres, metresToNm, norm, pinAdjustment,
	readCalculator, reciprocal, tideStickKnots, trapezoid, windwardLeeward,
} from './index'

const round = (n: number) => Math.round(norm(n)) % 360

describe('bearings', () => {
	// K2 Marklaying workbook, Module 7 exercise 1.
	it('gives reciprocals', () => {
		const cases = [[305, 125], [175, 355], [355, 175], [300, 120], [75, 255], [5, 185], [185, 5], [130, 310], [245, 65], [295, 115]]
		for (const [bearing, expected] of cases) expect(reciprocal(bearing)).toBe(expected)
	})

	it('formats three digits as spoken on VHF', () => {
		expect(formatBearing(55)).toBe('055')
		expect(formatBearing(359.6)).toBe('000')
		expect(formatBearing(-5)).toBe('355')
	})
})

describe('units', () => {
	it('leads with nautical miles and keeps metres alongside', () => {
		expect(formatDistance(900)).toBe('0.49 NM (900 m)')
		expect(formatDistance(900, 'm')).toBe('900 m (0.49 NM)')
		expect(nmToMetres(1)).toBe(1852)
	})

	it('gives short distances a third decimal', () => {
		expect(formatDistance(42)).toBe('0.023 NM (42 m)')
		expect(formatDistance(185)).toBe('0.100 NM (185 m)')
		expect(formatDistance(186)).toBe('0.10 NM (186 m)')
	})
})

describe('trapezoid, reference point system', () => {
	// K2 Marklaying workbook, Module 9 exercises 1 to 3: bearing and distance
	// (NM) from marks 2, 1 and 3 back to the reference point.
	const cases = [
		{ angle: 70, axis: 75, beat: 0.9, m2: [216, 0.89], m1: [255, 0.9], m3: [145, 0.6] },
		{ angle: 60, axis: 340, beat: 0.6, m2: [119, 0.53], m1: [160, 0.6], m3: [40, 0.4] },
		{ angle: 80, axis: 175, beat: 0.75, m2: [318, 0.83], m1: [355, 0.75], m3: [255, 0.5] },
	]
	for (const c of cases) {
		it(`matches the workbook at ${c.angle} degrees, axis ${c.axis}`, () => {
			const marks = trapezoid({ axis: c.axis, beat: nmToMetres(c.beat), angle: c.angle })
			for (const [mark, expected] of [['2', c.m2], ['1', c.m1], ['3', c.m3]] as const) {
				const l = leg(marks[mark], marks.ref)
				expect(round(l.bearing)).toBe(expected[0])
				expect(metresToNm(l.distance)).toBeCloseTo(expected[1], 2)
			}
		})
	}

	// Reference charts, axis 000 rows.
	it('matches the 70 degree reference chart', () => {
		const m = trapezoid({ axis: 0, beat: 1000, angle: 70 })
		expect(round(leg(m.ref, m['2']).bearing)).toBe(321)
		expect(round(leg(m.ref, m['3']).bearing)).toBe(250)
		expect(round(leg(m['1'], m['2']).bearing)).toBe(250)
		expect(round(leg(m.cb, m.pin).bearing)).toBe(270)
	})

	it('matches the 80 degree reference chart', () => {
		const m = trapezoid({ axis: 0, beat: 1000, angle: 80 })
		expect(round(leg(m.ref, m['2']).bearing)).toBe(323)
		expect(round(leg(m.ref, m['3']).bearing)).toBe(260)
	})

	it('puts the port gate mark on the right looking upwind', () => {
		const m = trapezoid({ axis: 0, beat: 1000, angle: 70, gateWidth: 40 })
		expect(m['4p'].e).toBeCloseTo(20)
		expect(m['4s'].e).toBeCloseTo(-20)
	})

	it('keeps the direct 4 to 2 bearing right off the standard width', () => {
		const m = trapezoid({ axis: 0, beat: 1000, angle: 90, reachRatio: 1 })
		expect(round(leg(m.ref, m['2']).bearing)).toBe(315)
	})
})

describe('windward/leeward', () => {
	// Workbook Module 7 exercise 6: 1A to 1 with an 80 degree spreader.
	// The workbook's answer for axis 175 (095) breaks its own pattern; the
	// other nine give axis + 80, so 175 is left out here.
	it('lays the offset mark', () => {
		const cases = [[125, 205], [275, 355], [335, 55], [225, 305], [185, 265], [95, 175], [235, 315], [285, 5], [315, 35]]
		for (const [axis, expected] of cases) {
			const m = windwardLeeward({ axis, beat: 1000, offsetAngle: 80, offsetDistance: 75 })
			expect(round(leg(m['1a']!, m['1']).bearing)).toBe(expected)
		}
	})
})

describe('course angle calculator', () => {
	it('reads the workbook angles off the dial', () => {
		const at = (axis: number, label: string, angle: number) =>
			readCalculator(axis).find((r) => r.label === label && r.angle === angle)!.bearing
		expect(at(305, 'Gate, Pin-CB', 90)).toBe(35) // Module 7 ex. 3
		expect(at(140, '2-1, 3-4', 70)).toBe(210) // Module 7 ex. 4
		expect(at(305, '2-1, 3-4', 70)).toBe(15) // Module 7 ex. 7, 3 to ref
		expect(at(0, '3-Finish', 70)).toBe(110) // 70 degree chart
		expect(at(175, 'Gate, Pin-CB', 90)).toBe(265) // Module 9 ex. 4
	})
})

describe('line and tide helpers', () => {
	// Pin-end adjustment table on the course angle calculator.
	it('matches the pin-end anchor adjustment table', () => {
		expect(Math.round(pinAdjustment(200, 5))).toBe(17)
		expect(Math.round(pinAdjustment(200, 20))).toBe(73)
		expect(Math.round(pinAdjustment(500, 10))).toBe(88)
		expect(Math.round(pinAdjustment(500, 20))).toBe(182)
	})

	it('approximates the tide stick rule: knots = 2 x metres / seconds', () => {
		expect(tideStickKnots(30, 60)).toBeCloseTo(1, 1)
	})
})
