/**
 * Course geometry. Every mark is a bearing relative to the course axis and a
 * distance relative to the beat, chained from one reference point (the middle
 * of the leeward gate). Summing the chain keeps direct bearings correct at any
 * angle or width, which fixed paper tables cannot do.
 */

import { ORIGIN, offset, type Vec } from './bearing'
import { nmToMetres } from './units'

export interface TrapezoidParams {
	/** Course axis: bearing from the reference point to mark 1. */
	axis: number
	/** Beat length in metres, reference point to mark 1. */
	beat: number
	/** Interior angle at mark 1 in degrees, typically 60, 70 or 80. */
	angle: number
	/** Reach 1 to 2 as a fraction of the beat. Standard width is two thirds. */
	reachRatio?: number
	/** Outer beat 2 to 3 as a fraction of the beat. */
	outerRatio?: number
	/** Gate width in metres, used for both gates. */
	gateWidth?: number
	/** Start line length in metres. */
	startLine?: number
	/** Distance in metres from the reference point down to the start line. */
	startOffset?: number
}

export type TrapezoidMark =
	| 'ref' | '1' | '2' | '3' | '3s' | '3p' | '4s' | '4p' | 'start' | 'cb' | 'pin'

export type TrapezoidMarks = Record<TrapezoidMark, Vec>

/**
 * Gate marks are named for the side boats leave them on when sailing downwind
 * through the gate, so looking upwind the port mark is on the right.
 */
function gate(centre: Vec, axis: number, width: number): { s: Vec; p: Vec } {
	return {
		s: offset(centre, axis - 90, width / 2),
		p: offset(centre, axis + 90, width / 2),
	}
}

export function trapezoid(params: TrapezoidParams): TrapezoidMarks {
	const {
		axis,
		beat,
		angle,
		reachRatio = 2 / 3,
		outerRatio = 1,
		gateWidth = 40,
		startLine = 200,
		startOffset = nmToMetres(0.05),
	} = params

	const ref = ORIGIN
	const m1 = offset(ref, axis, beat)
	const m2 = offset(m1, axis + 180 + angle, reachRatio * beat)
	const m3 = offset(m2, axis + 180, outerRatio * beat)
	const g3 = gate(m3, axis, gateWidth)
	const g4 = gate(ref, axis, gateWidth)

	// Square line: committee boat at the starboard end, pin on axis - 90 from it.
	const start = offset(ref, axis + 180, startOffset)
	const cb = offset(start, axis + 90, startLine / 2)
	const pin = offset(start, axis - 90, startLine / 2)

	return {
		ref, '1': m1, '2': m2, '3': m3,
		'3s': g3.s, '3p': g3.p, '4s': g4.s, '4p': g4.p,
		start, cb, pin,
	}
}

export interface WindwardLeewardParams {
	axis: number
	beat: number
	gateWidth?: number
	/** Offset (spreader) mark 1A: angle at mark 1 in degrees, 80 or 90. */
	offsetAngle?: number
	/** Distance from mark 1 to mark 1A in metres. Omit for no offset mark. */
	offsetDistance?: number
}

export interface WindwardLeewardMarks {
	ref: Vec
	'1': Vec
	'1a'?: Vec
	'2s': Vec
	'2p': Vec
}

export function windwardLeeward(params: WindwardLeewardParams): WindwardLeewardMarks {
	const { axis, beat, gateWidth = 40, offsetAngle = 90, offsetDistance } = params
	const ref = ORIGIN
	const m1 = offset(ref, axis, beat)
	const g = gate(ref, axis, gateWidth)
	const marks: WindwardLeewardMarks = { ref, '1': m1, '2s': g.s, '2p': g.p }
	if (offsetDistance) {
		marks['1a'] = offset(m1, axis + 180 + offsetAngle, offsetDistance)
	}
	return marks
}

/** Metres to move the pin to change start line bias by `biasDegrees`. */
export function pinAdjustment(lineLength: number, biasDegrees: number): number {
	return lineLength * Math.tan((biasDegrees * Math.PI) / 180)
}

/** Tide stick: current in knots from metres drifted over a time in seconds. */
export function tideStickKnots(metres: number, seconds: number): number {
	return (metres / seconds) * (3600 / 1852)
}
