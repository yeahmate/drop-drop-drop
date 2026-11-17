import { describe, expect, it } from 'vitest'
import { asSailingWind, currentOnAxis, drift, sailingWind, stationAnchored, summarise, stickFeetRule, stickKnots, stickRuleOfThumb } from './index'

describe('tide stick', () => {
	it('converts a timed drift to knots', () => {
		// 1 knot is 1852 m an hour: 30.87 m a minute.
		expect(stickKnots(30.87, 60)).toBeCloseTo(1, 3)
		expect(stickKnots(20, 30)).toBeCloseTo(1.296, 3)
	})

	it('agrees with the workbook rule of thumb to within 3%', () => {
		// Workbook: knots = 2 x metres / seconds.
		expect(stickRuleOfThumb(20, 30)).toBeCloseTo(1.333, 3)
		expect(stickRuleOfThumb(20, 30) / stickKnots(20, 30)).toBeCloseTo(1.029, 3)
	})

	it('agrees with the calculator sheet rule in feet', () => {
		// Calculator: feet / (minutes x 100). One knot is 101 feet a minute.
		expect(stickFeetRule(101.27, 1)).toBeCloseTo(1.013, 3)
		expect(stickFeetRule(101.27, 1) / stickKnots(101.27 * 0.3048, 60)).toBeCloseTo(1.013, 2)
	})

	it('gives nothing for no time', () => {
		expect(stickKnots(10, 0)).toBe(0)
		expect(stickRuleOfThumb(10, 0)).toBe(0)
		expect(stickFeetRule(10, 0)).toBe(0)
	})
})

describe('sailing wind', () => {
	const wind = { direction: 0, speed: 10 }

	it('is the ground wind in slack water', () => {
		expect(sailingWind(wind, { set: 90, rate: 0 })).toEqual({ direction: 0, speed: 10 })
	})

	it('strengthens with wind against tide and weakens with wind with tide', () => {
		// Water flowing north into a northerly: boats are carried into the wind.
		expect(sailingWind(wind, { set: 0, rate: 2 }).speed).toBeCloseTo(12)
		expect(sailingWind(wind, { set: 180, rate: 2 }).speed).toBeCloseTo(8)
		expect(sailingWind(wind, { set: 180, rate: 2 }).direction).toBeCloseTo(0)
	})

	it('swings towards where a cross tide is going', () => {
		// Water flowing east: boats carried east feel more wind from the east.
		const s = sailingWind(wind, { set: 90, rate: 2 })
		expect(s.direction).toBeCloseTo(11.31, 2)
		expect(s.speed).toBeCloseTo(Math.hypot(10, 2), 6)
		expect(sailingWind(wind, { set: 270, rate: 2 }).direction).toBeCloseTo(348.69, 2)
	})

	it('works for any heading, not just north', () => {
		const s = sailingWind({ direction: 235, speed: 12 }, { set: 145, rate: 1 })
		// Cross tide from the right looking upwind... the water goes to 145,
		// which is 90 degrees left of 235, so the wind backs.
		expect(s.direction).toBeCloseTo(235 - (Math.atan(1 / 12) * 180) / Math.PI, 2)
	})

	it('keeps the ground direction if the tide exactly cancels the wind', () => {
		expect(sailingWind({ direction: 40, speed: 2 }, { set: 220, rate: 2 }).direction).toBe(40)
	})
})

describe('current on the course', () => {
	it('splits into along and across the axis', () => {
		const up = currentOnAxis(235, { set: 235, rate: 1.5 })
		expect(up.along).toBeCloseTo(1.5)
		expect(up.across).toBeCloseTo(0)
		expect(up.alongWord).toBe('up the beat')
		expect(up.acrossWord).toBe('none')

		const cross = currentOnAxis(235, { set: 325, rate: 1.5 })
		expect(cross.along).toBeCloseTo(0)
		expect(cross.across).toBeCloseTo(1.5)
		expect(cross.acrossWord).toBe('to the right')

		const mixed = currentOnAxis(0, { set: 210, rate: 2 })
		expect(mixed.along).toBeCloseTo(-1.732, 3)
		expect(mixed.across).toBeCloseTo(-1, 3)
		expect(mixed.alongWord).toBe('down the beat')
		expect(mixed.acrossWord).toBe('to the left')
	})

	it('works across north', () => {
		expect(currentOnAxis(350, { set: 10, rate: 1 }).acrossWord).toBe('to the right')
	})
})

describe('drift', () => {
	it('is 1852 m an hour at one knot', () => {
		expect(drift(1, 60)).toBeCloseTo(1852)
		expect(drift(1.5, 5)).toBeCloseTo(231.5)
	})
})

describe('a mixed wind log', () => {
	// The committee boat reads the wind at anchor; mark boats read it drifting.
	const current = { set: 90, rate: 2 }
	const committee = { time: 1, direction: 0, speed: 10, station: 'Committee', anchored: true }
	const mark = { time: 2, direction: 11, speed: 10.2, station: 'Mark 1' }

	it('defaults the committee boat to anchored and mark boats to drifting', () => {
		expect(stationAnchored('Committee')).toBe(true)
		for (const s of ['Mark 1', 'Mark 2', 'Gate 3', 'Gate 4', 'Pin']) expect(stationAnchored(s)).toBe(false)
	})

	it('corrects anchored readings for the current and leaves drifting ones alone', () => {
		const [c, m] = asSailingWind([committee, mark], current)
		expect(c.direction).toBeCloseTo(11.31, 2)
		expect(c.speed).toBeCloseTo(10.198, 3)
		expect(c.station).toBe('Committee')
		expect(m).toBe(mark)
	})

	it('makes the two boats agree once the committee reading is corrected', () => {
		// Uncorrected, the boats disagree by 11 degrees for the same wind.
		expect(summarise([committee, mark])!.mean).toBeCloseTo(5.5, 0)
		const s = summarise(asSailingWind([committee, mark], current))!
		expect(s.mean).toBeCloseTo(11.2, 1)
		expect(Math.round(s.high) - Math.round(s.low)).toBe(0)
	})

	it('changes nothing in slack water', () => {
		expect(asSailingWind([committee], { set: 90, rate: 0 })[0]).toBe(committee)
	})
})
