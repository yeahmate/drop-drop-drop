/**
 * Bearings and flat-plane vectors.
 *
 * Positions are metres east and north of the reference point. Over a course
 * of a few miles a flat plane is accurate to well under a metre, far inside
 * the 20 m laying tolerance.
 */

export interface Vec {
	/** Metres east of the reference point. */
	e: number
	/** Metres north of the reference point. */
	n: number
}

export const ORIGIN: Vec = { e: 0, n: 0 }

const RAD = Math.PI / 180

/** Wrap any angle in degrees to the range 0 (inclusive) to 360 (exclusive). */
export function norm(deg: number): number {
	return ((deg % 360) + 360) % 360
}

/** The reciprocal of a bearing: what a GPS reads looking back at the origin. */
export function reciprocal(deg: number): number {
	return norm(deg + 180)
}

/** Three-digit bearing as spoken on VHF, for example 055. */
export function formatBearing(deg: number): string {
	return String(Math.round(norm(deg)) % 360).padStart(3, '0')
}

/** The point reached by travelling `distance` metres on `bearing` from `from`. */
export function offset(from: Vec, bearing: number, distance: number): Vec {
	return {
		e: from.e + distance * Math.sin(bearing * RAD),
		n: from.n + distance * Math.cos(bearing * RAD),
	}
}

/** Bearing in degrees from `a` to `b`. */
export function bearingBetween(a: Vec, b: Vec): number {
	return norm(Math.atan2(b.e - a.e, b.n - a.n) / RAD)
}

/** Distance in metres from `a` to `b`. */
export function distanceBetween(a: Vec, b: Vec): number {
	return Math.hypot(b.e - a.e, b.n - a.n)
}

export interface Leg {
	/** Bearing from the first point to the second. */
	bearing: number
	/** Bearing from the second point back to the first. */
	reciprocal: number
	/** Distance in metres. */
	distance: number
}

/** Bearing, reciprocal and distance from `a` to `b`. */
export function leg(a: Vec, b: Vec): Leg {
	const bearing = bearingBetween(a, b)
	return { bearing, reciprocal: reciprocal(bearing), distance: distanceBetween(a, b) }
}
