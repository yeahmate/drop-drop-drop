/**
 * Live guidance for laying a mark: where the boat is relative to the line
 * from the origin (normally the reference point) out to the mark's position.
 */

import { bearingBetween, distanceBetween, type Vec } from './bearing'

/** Workbook Module 9: windward mark within 20 m. */
export const LAY_TOLERANCE = 20

export interface Guidance {
	/** Metres still to run along the line; negative once past the target. */
	toRun: number
	/** Metres off the line, always positive. */
	offLine: number
	/** Which side of the line the boat is on, looking from origin to target. */
	side: 'left' | 'right' | 'on'
	/** Which way to steer to regain the line. */
	steer: 'left' | 'right' | 'hold'
	/** Straight-line metres from the boat to the target. */
	toTarget: number
	/** What a GPS set to GoTo the origin reads now. */
	bearingToOrigin: number
	distanceToOrigin: number
	/** Inside the laying tolerance. */
	onStation: boolean
}

export function guide(origin: Vec, target: Vec, boat: Vec, tolerance = LAY_TOLERANCE): Guidance {
	const length = distanceBetween(origin, target) || 1
	const ue = (target.e - origin.e) / length
	const un = (target.n - origin.n) / length
	const be = boat.e - origin.e
	const bn = boat.n - origin.n
	const along = be * ue + bn * un
	// Right-hand perpendicular of the line direction.
	const cross = be * un - bn * ue
	const offLine = Math.abs(cross)
	const side = offLine < 0.5 ? 'on' : cross > 0 ? 'right' : 'left'
	const toTarget = distanceBetween(boat, target)
	return {
		toRun: length - along,
		offLine,
		side,
		steer: side === 'on' ? 'hold' : side === 'right' ? 'left' : 'right',
		toTarget,
		bearingToOrigin: bearingBetween(boat, origin),
		distanceToOrigin: distanceBetween(boat, origin),
		onStation: toTarget <= tolerance,
	}
}

/**
 * How far upwind or up-tide of the target to drop the anchor so the mark
 * settles on station: the horizontal run of a taut warp.
 */
export function dropOffset(depth: number, warp: number): number {
	return warp > depth ? Math.sqrt(warp * warp - depth * depth) : 0
}

/** Metres on the ground for one degree of bearing at a distance. */
export function metresPerDegree(distance: number): number {
	return (distance * Math.PI) / 180
}
