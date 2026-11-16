/**
 * Latitude and longitude. One minute of latitude is one nautical mile, so a
 * mark's offset in metres from the pinged reference converts directly.
 */

import type { Vec } from './bearing'
import { METRES_PER_NM } from './units'

export interface LatLon {
	/** Degrees, north positive. */
	lat: number
	/** Degrees, east positive. */
	lon: number
}

const METRES_PER_DEGREE = METRES_PER_NM * 60

/** Position of a point `v` metres east and north of `ref`. */
export function toLatLon(ref: LatLon, v: Vec): LatLon {
	const lat = ref.lat + v.n / METRES_PER_DEGREE
	const midLat = (ref.lat + lat) / 2
	const lon = ref.lon + v.e / (METRES_PER_DEGREE * Math.cos((midLat * Math.PI) / 180))
	return { lat, lon }
}

/** Metres east and north of `ref` for a position, the inverse of toLatLon. */
export function fromLatLon(ref: LatLon, p: LatLon): Vec {
	const midLat = (ref.lat + p.lat) / 2
	return {
		e: (p.lon - ref.lon) * METRES_PER_DEGREE * Math.cos((midLat * Math.PI) / 180),
		n: (p.lat - ref.lat) * METRES_PER_DEGREE,
	}
}

export type Axis = 'lat' | 'lon'

/** Degrees and decimal minutes as on a Garmin handheld: N 50° 35.212' */
export function formatCoordinate(value: number, axis: Axis): string {
	const hemi = axis === 'lat' ? (value < 0 ? 'S' : 'N') : value < 0 ? 'W' : 'E'
	const abs = Math.abs(value)
	let deg = Math.floor(abs)
	let min = Math.round((abs - deg) * 60 * 1000) / 1000
	if (min >= 60) {
		deg += 1
		min = 0
	}
	const width = axis === 'lat' ? 2 : 3
	return `${hemi} ${String(deg).padStart(width, '0')}° ${min.toFixed(3).padStart(6, '0')}'`
}

export function formatLatLon(p: LatLon): string {
	return `${formatCoordinate(p.lat, 'lat')}  ${formatCoordinate(p.lon, 'lon')}`
}

export type ParseResult = { ok: true; value: number } | { ok: false; error: string }

/**
 * Parse degrees and decimal minutes, for example "N 50° 35.212'", "50 35.212 N"
 * or "W002 26.874". Rejects minutes of 60 or more and out-of-range degrees.
 */
export function parseCoordinate(text: string, axis: Axis): ParseResult {
	const hemis = axis === 'lat' ? 'NS' : 'EW'
	const upper = text.trim().toUpperCase()
	const letters = upper.replace(/[^A-Z]/g, '')
	if (letters.length !== 1 || !hemis.includes(letters)) {
		return { ok: false, error: `Needs ${hemis[0]} or ${hemis[1]}` }
	}
	const numbers = upper.match(/\d+(?:\.\d+)?/g)
	if (!numbers || numbers.length !== 2) {
		return { ok: false, error: 'Enter degrees then decimal minutes' }
	}
	if (numbers[0].includes('.')) {
		return { ok: false, error: 'Degrees must be a whole number' }
	}
	const deg = Number(numbers[0])
	const min = Number(numbers[1])
	const max = axis === 'lat' ? 90 : 180
	if (min >= 60) return { ok: false, error: 'Minutes must be less than 60' }
	if (deg > max || (deg === max && min > 0)) {
		return { ok: false, error: `Degrees must be ${max} or less` }
	}
	const sign = letters === 'S' || letters === 'W' ? -1 : 1
	return { ok: true, value: sign * (deg + min / 60) }
}
