import { describe, expect, it } from 'vitest'
import { DEFAULT_SPEC, buildCourse, roundingOrder, type CourseSpec } from './geo'
import { courseFromHash, decodeCourse, encodeCourse, shareUrl } from './share'

const spec: CourseSpec = { ...DEFAULT_SPEC, type: 'IX', beats: 3, axis: 235, beat: 900, angle: 80, startLine: 270 }

describe('share links', () => {
	it('round-trips a course', () => {
		const decoded = decodeCourse(encodeCourse(spec))!
		expect(decoded.type).toBe('IX')
		expect(decoded.axis).toBe(235)
		expect(decoded.reachRatio).toBeCloseTo(2 / 3, 3)
		expect(roundingOrder(buildCourse(decoded))).toBe(roundingOrder(buildCourse(spec)))
		expect(buildCourse(decoded).length).toBeCloseTo(buildCourse(spec).length, 0)
	})

	it('produces a URL-safe code and reads it back from a link', () => {
		const url = shareUrl(spec, 'https://example.org/app/#old')
		expect(url).toMatch(/^https:\/\/example\.org\/app\/#c=[A-Za-z0-9_-]+$/)
		expect(courseFromHash(new URL(url).hash)?.beats).toBe(3)
	})

	it('rejects junk, wrong versions, unknown courses and out-of-range values', () => {
		const pack = (data: unknown) => btoa(JSON.stringify(data)).replace(/=+$/, '')
		const good = JSON.parse(atob(encodeCourse(spec).replace(/-/g, '+').replace(/_/g, '/')))
		expect(decodeCourse('not a course')).toBeNull()
		expect(decodeCourse(pack({ type: 'I' }))).toBeNull()
		expect(decodeCourse(pack([2, ...good.slice(1)]))).toBeNull()
		expect(decodeCourse(pack([1, 'ZZ', ...good.slice(2)]))).toBeNull()
		expect(decodeCourse(pack(good.slice(0, -1)))).toBeNull()
		const farBeat = [...good]
		farBeat[4] = 1e9
		expect(decodeCourse(pack(farBeat))).toBeNull()
		const textAxis = [...good]
		textAxis[3] = '235'
		expect(decodeCourse(pack(textAxis))).toBeNull()
		const halfBeats = [...good]
		halfBeats[2] = 2.5
		expect(decodeCourse(pack(halfBeats))).toBeNull()
		expect(courseFromHash('#nothing')).toBeNull()
	})
})
