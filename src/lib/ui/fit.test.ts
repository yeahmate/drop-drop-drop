import { describe, expect, it } from 'vitest'
import { DEFAULT_SPEC, buildCourse } from '../geo'
import { fitPoints, markLabels, scaleBar } from './fit'

describe('diagram fit', () => {
	const points = [{ e: 0, n: 0 }, { e: 1000, n: 500 }]

	it('keeps every point inside the padding, north up', () => {
		const fit = fitPoints(points, 640, 520, 64)
		for (const p of points) {
			expect(fit.x(p)).toBeGreaterThanOrEqual(64 - 1e-9)
			expect(fit.x(p)).toBeLessThanOrEqual(640 - 64 + 1e-9)
			expect(fit.y(p)).toBeGreaterThanOrEqual(64 - 1e-9)
			expect(fit.y(p)).toBeLessThanOrEqual(520 - 64 + 1e-9)
		}
		expect(fit.y(points[1])).toBeLessThan(fit.y(points[0]))
		expect(fit.x(points[1])).toBeGreaterThan(fit.x(points[0]))
	})

	it('uses one scale for both directions', () => {
		const fit = fitPoints(points, 640, 520, 64)
		expect(fit.x(points[1]) - fit.x(points[0])).toBeCloseTo(1000 * fit.scale)
		expect(fit.y(points[0]) - fit.y(points[1])).toBeCloseTo(500 * fit.scale)
	})

	it('copes with a single point', () => {
		expect(Number.isFinite(fitPoints([{ e: 5, n: 5 }], 100, 100, 10).x({ e: 5, n: 5 }))).toBe(true)
	})

	it('picks a round scale bar that fits', () => {
		expect(scaleBar(0.4, 140)).toBe(200)
		expect(scaleBar(0.05, 140)).toBe(2000)
		expect(scaleBar(100, 140)).toBe(10)
	})
})

describe('mark labels', () => {
	const texts = (type: 'IX' | 'LA') =>
		markLabels(buildCourse({ ...DEFAULT_SPEC, type }).marks).map((l) => l.text).sort()

	it('labels each gate once, at its centre', () => {
		expect(texts('IX')).toEqual(['1', '2', '3s/3p', '4s/4p', '5'])
		expect(texts('LA')).toEqual(['1', '1a', '2s/2p'])
		const gate = markLabels(buildCourse({ ...DEFAULT_SPEC, type: 'IX' }).marks).find((l) => l.text === '4s/4p')!
		expect(gate.position.e).toBeCloseTo(0)
		expect(gate.position.n).toBeCloseTo(0)
	})
})
