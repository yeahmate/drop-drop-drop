import { describe, expect, it } from 'vitest'
import {
	formatCoordinate, formatLatLon, fromLatLon, nmToMetres, offset, parseCoordinate, toLatLon,
	ORIGIN,
} from './index'

const ref = { lat: 50 + 35.212 / 60, lon: -(2 + 26.874 / 60) }

describe('formatting', () => {
	it('prints degrees and decimal minutes', () => {
		expect(formatCoordinate(ref.lat, 'lat')).toBe("N 50° 35.212'")
		expect(formatCoordinate(ref.lon, 'lon')).toBe("W 002° 26.874'")
		expect(formatLatLon(ref)).toBe("N 50° 35.212'  W 002° 26.874'")
	})

	it('carries minutes that round up to 60', () => {
		expect(formatCoordinate(50.99999999, 'lat')).toBe("N 51° 00.000'")
	})
})

describe('parsing', () => {
	it('reads the workbook reference point', () => {
		// Module 6 exercise: N 52° 35.767' W 002° 26.132'
		const lat = parseCoordinate("N 52° 35.767'", 'lat')
		const lon = parseCoordinate("W 002° 26.132'", 'lon')
		expect(lat).toEqual({ ok: true, value: 52 + 35.767 / 60 })
		expect(lon).toEqual({ ok: true, value: -(2 + 26.132 / 60) })
	})

	it('accepts loose layouts', () => {
		expect(parseCoordinate('50 35.212 n', 'lat')).toEqual({ ok: true, value: ref.lat })
		expect(parseCoordinate('W002 26.874', 'lon')).toEqual({ ok: true, value: ref.lon })
	})

	it('rejects minutes of 60 or more', () => {
		// Module 6 exercise: N 51° 97.010' cannot be a position.
		expect(parseCoordinate("N 51° 97.010'", 'lat')).toEqual({ ok: false, error: 'Minutes must be less than 60' })
	})

	it('rejects the wrong hemisphere letter, out-of-range degrees and junk', () => {
		expect(parseCoordinate("W 50° 35.212'", 'lat').ok).toBe(false)
		expect(parseCoordinate("N 91° 00.000'", 'lat').ok).toBe(false)
		expect(parseCoordinate("E 181° 00.000'", 'lon').ok).toBe(false)
		expect(parseCoordinate('50.5869', 'lat').ok).toBe(false)
		expect(parseCoordinate('', 'lat').ok).toBe(false)
		expect(parseCoordinate('N 50.5 35.2', 'lat').ok).toBe(false)
	})
})

describe('positions from the reference', () => {
	it('moves one minute of latitude per nautical mile north', () => {
		const p = toLatLon(ref, offset(ORIGIN, 0, nmToMetres(1)))
		expect((p.lat - ref.lat) * 60).toBeCloseTo(1, 6)
		expect(p.lon).toBeCloseTo(ref.lon, 9)
	})

	it('widens longitude by the cosine of latitude', () => {
		const p = toLatLon(ref, offset(ORIGIN, 90, nmToMetres(1)))
		expect((p.lon - ref.lon) * 60).toBeCloseTo(1 / Math.cos((ref.lat * Math.PI) / 180), 4)
	})

	it('round-trips offsets to well under a metre', () => {
		for (const bearing of [0, 55, 125, 196, 235, 321]) {
			const v = offset(ORIGIN, bearing, 1667)
			const back = fromLatLon(ref, toLatLon(ref, v))
			expect(back.e).toBeCloseTo(v.e, 3)
			expect(back.n).toBeCloseTo(v.n, 3)
		}
	})
})
