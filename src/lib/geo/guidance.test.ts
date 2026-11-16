import { describe, expect, it } from 'vitest'
import { ORIGIN, dropOffset, guide, metresPerDegree, offset } from './index'

describe('live guidance', () => {
	// Mark 1 on axis 235 at 900 m, as in the workbook's Module 9 example.
	const target = offset(ORIGIN, 235, 900)

	it('reports distance to run and the GPS reading on the line', () => {
		const g = guide(ORIGIN, target, offset(ORIGIN, 235, 760))
		expect(g.toRun).toBeCloseTo(140)
		expect(g.offLine).toBeCloseTo(0)
		expect(g.side).toBe('on')
		expect(g.steer).toBe('hold')
		expect(Math.round(g.bearingToOrigin)).toBe(55)
		expect(g.distanceToOrigin).toBeCloseTo(760)
		expect(g.onStation).toBe(false)
	})

	it('tells a boat left of the line to steer right', () => {
		// Looking down 235, left is towards 145.
		const boat = offset(offset(ORIGIN, 235, 760), 145, 18)
		const g = guide(ORIGIN, target, boat)
		expect(g.side).toBe('left')
		expect(g.steer).toBe('right')
		expect(g.offLine).toBeCloseTo(18)
		expect(g.toRun).toBeCloseTo(140)
	})

	it('tells a boat right of the line to steer left', () => {
		const g = guide(ORIGIN, target, offset(offset(ORIGIN, 235, 500), 325, 30))
		expect(g.side).toBe('right')
		expect(g.steer).toBe('left')
	})

	it('goes negative once past the mark position', () => {
		expect(guide(ORIGIN, target, offset(ORIGIN, 235, 950)).toRun).toBeCloseTo(-50)
	})

	it('is on station inside 20 m and not outside it', () => {
		expect(guide(ORIGIN, target, offset(target, 10, 19)).onStation).toBe(true)
		expect(guide(ORIGIN, target, offset(target, 10, 21)).onStation).toBe(false)
	})

	it('works from another mark as the origin', () => {
		const from = offset(ORIGIN, 0, 500)
		const to = offset(from, 90, 300)
		const g = guide(from, to, offset(from, 90, 100))
		expect(g.toRun).toBeCloseTo(200)
		expect(Math.round(g.bearingToOrigin)).toBe(270)
	})
})

describe('drop offset', () => {
	it('is the horizontal run of the warp', () => {
		expect(dropOffset(12, 25)).toBeCloseTo(21.93, 2)
		expect(dropOffset(3, 5)).toBeCloseTo(4)
	})

	it('is zero when the warp is no longer than the depth', () => {
		expect(dropOffset(10, 10)).toBe(0)
		expect(dropOffset(10, 6)).toBe(0)
	})
})

describe('bearing resolution', () => {
	it('is about 32 m per degree at one nautical mile', () => {
		expect(metresPerDegree(1852)).toBeCloseTo(32.3, 1)
	})
})
