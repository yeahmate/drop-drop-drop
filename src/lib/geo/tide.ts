/**
 * Tide: measuring the current with a tide stick, and what a current does to
 * the wind the fleet sails in and to the legs of the course.
 */

import { norm } from './bearing'
import { angleDiff, type WindReading } from './wind'

const KNOTS_PER_METRE_PER_SECOND = 3600 / 1852

/** Current in knots from metres drifted over seconds. */
export function stickKnots(metres: number, seconds: number): number {
	return seconds > 0 ? (metres / seconds) * KNOTS_PER_METRE_PER_SECOND : 0
}

/** The afloat rule of thumb: knots = 2 x metres / seconds (3% high). */
export function stickRuleOfThumb(metres: number, seconds: number): number {
	return seconds > 0 ? (2 * metres) / seconds : 0
}

/** The course angle calculator's version: feet drifted / (minutes x 100). */
export function stickFeetRule(feet: number, minutes: number): number {
	return minutes > 0 ? feet / (minutes * 100) : 0
}

export interface Current {
	/** Direction the water is flowing towards, degrees. */
	set: number
	/** Speed in knots. */
	rate: number
}

export interface Wind {
	/** Direction the wind is from, degrees. */
	direction: number
	/** Speed in knots. */
	speed: number
}

const rad = (deg: number) => (deg * Math.PI) / 180

/**
 * The sailing wind: what a boat carried along by the current feels, and so
 * the wind the fleet actually races in. Wind against tide strengthens it;
 * a cross tide swings it towards where the water is going.
 */
export function sailingWind(ground: Wind, current: Current): Wind {
	// Air velocity over the ground, minus the water's velocity.
	const e = -ground.speed * Math.sin(rad(ground.direction)) - current.rate * Math.sin(rad(current.set))
	const n = -ground.speed * Math.cos(rad(ground.direction)) - current.rate * Math.cos(rad(current.set))
	const speed = Math.hypot(e, n)
	return {
		direction: speed < 1e-9 ? norm(ground.direction) : norm((Math.atan2(-e, -n) * 180) / Math.PI),
		speed,
	}
}

/**
 * Put a mixed log on one footing. Readings taken at anchor are corrected for
 * the current; readings taken drifting already are the sailing wind.
 */
export function asSailingWind(readings: WindReading[], current: Current): WindReading[] {
	return readings.map((r) => {
		if (!r.anchored || current.rate <= 0) return r
		const s = sailingWind(r, current)
		return { ...r, direction: s.direction, speed: s.speed }
	})
}

export interface AxisCurrent {
	/** Knots along the axis; positive carries boats up the beat. */
	along: number
	/** Knots across the axis; positive pushes to the right looking upwind. */
	across: number
	alongWord: 'up the beat' | 'down the beat' | 'none'
	acrossWord: 'to the right' | 'to the left' | 'none'
}

/** Split a current into the parts along and across the course axis. */
export function currentOnAxis(axis: number, current: Current): AxisCurrent {
	const off = rad(angleDiff(current.set, axis))
	const along = current.rate * Math.cos(off)
	const across = current.rate * Math.sin(off)
	const word = (v: number, pos: string, neg: string) => (Math.abs(v) < 0.05 ? 'none' : v > 0 ? pos : neg)
	return {
		along,
		across,
		alongWord: word(along, 'up the beat', 'down the beat') as AxisCurrent['alongWord'],
		acrossWord: word(across, 'to the right', 'to the left') as AxisCurrent['acrossWord'],
	}
}

/** Metres a free-floating object drifts in a time at a rate in knots. */
export function drift(rate: number, minutes: number): number {
	return (rate * 1852 * minutes) / 60
}
