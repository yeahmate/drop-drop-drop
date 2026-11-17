import { describe, expect, it } from 'vitest'
import {
	DEFAULT_SPEC, ORIGIN, bearingBetween, courseToTrue, distanceBetween, formatVariation, fromTrue,
	northLetter, offset, rotate, switchNorth, toLatLon, toTrue, trueToCourse, variation, appliedVariation,
} from './index'

describe('World Magnetic Model', () => {
	// Published WMM2025 test values at 2025.0, sea level.
	it('matches the published test values', () => {
		const date = new Date(Date.UTC(2025, 0, 1))
		expect(variation({ lat: 80, lon: 0 }, date)).toBeCloseTo(1.28, 2)
		expect(variation({ lat: 0, lon: 120 }, date)).toBeCloseTo(-0.16, 2)
		expect(variation({ lat: -80, lon: 240 }, date)).toBeCloseTo(68.78, 2)
	})

	it('gives a small easterly variation on the English south coast in 2026', () => {
		const v = variation({ lat: 50.587, lon: -2.448 }, new Date(Date.UTC(2026, 10, 17)))!
		expect(v).toBeGreaterThan(0)
		expect(v).toBeLessThan(1.5)
	})

	it('returns null once the model has expired', () => {
		expect(variation({ lat: 50, lon: 0 }, new Date(Date.UTC(2031, 0, 1)))).toBeNull()
	})
})

describe('true and magnetic', () => {
	it('adds easterly variation to get true', () => {
		expect(toTrue(235, 5)).toBe(240)
		expect(toTrue(358, 5)).toBe(3)
		expect(fromTrue(240, 5)).toBe(235)
		expect(fromTrue(2, -5)).toBe(7)
	})

	it('applies no variation when working in true, or when it is unknown', () => {
		expect(appliedVariation('true', 12)).toBe(0)
		expect(appliedVariation('magnetic', 12)).toBe(12)
		expect(appliedVariation('magnetic', null)).toBe(0)
	})

	it('formats variation with its direction', () => {
		expect(formatVariation(0.54)).toBe('0.5°E')
		expect(formatVariation(-12.26)).toBe('12.3°W')
		expect(formatVariation(0.02)).toBe('0.0°')
		expect(northLetter('magnetic')).toBe('M')
		expect(northLetter('true')).toBe('T')
	})

	it('rotates offsets clockwise by the variation and back', () => {
		const mark = offset(ORIGIN, 235, 900)
		const turned = courseToTrue(mark, 10)
		expect(bearingBetween(ORIGIN, turned)).toBeCloseTo(245)
		expect(distanceBetween(ORIGIN, turned)).toBeCloseTo(900)
		const back = trueToCourse(turned, 10)
		expect(back.e).toBeCloseTo(mark.e)
		expect(back.n).toBeCloseTo(mark.n)
		expect(rotate({ e: 0, n: 1 }, 90).e).toBeCloseTo(1)
	})

	it('places a magnetic bearing on the chart using the variation', () => {
		// 1 NM on 000 magnetic with 10 degrees east variation is 010 true.
		const ref = { lat: 50, lon: -2 }
		const p = toLatLon(ref, courseToTrue(offset(ORIGIN, 0, 1852), 10))
		expect((p.lat - ref.lat) * 60).toBeCloseTo(Math.cos((10 * Math.PI) / 180), 3)
		expect(p.lon).toBeGreaterThan(ref.lon)
	})
})

describe('switching north', () => {
	const spec = { ...DEFAULT_SPEC, axis: 235, north: 'magnetic' as const }
	const wind = [{ time: 1, direction: 358, speed: 10 }]

	it('re-expresses the axis and wind log so nothing moves on the water', () => {
		const t = switchNorth(spec, wind, 'true', 5)
		expect(t.spec.north).toBe('true')
		expect(t.spec.axis).toBe(240)
		expect(t.wind[0].direction).toBe(3)
		const back = switchNorth(t.spec, t.wind, 'magnetic', 5)
		expect(back.spec.axis).toBe(235)
		expect(back.wind[0].direction).toBe(358)
	})

	it('only relabels when the variation is unknown, and does nothing if already there', () => {
		expect(switchNorth(spec, wind, 'true', null).spec.axis).toBe(235)
		expect(switchNorth(spec, wind, 'magnetic', 5).spec).toBe(spec)
	})
})
