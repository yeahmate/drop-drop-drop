/**
 * Wind log: mean, range and trend of readings, and the skew from the course
 * axis that decides whether the course needs moving.
 */

import { norm } from './bearing'

export interface WindReading {
	/** Milliseconds since the epoch. */
	time: number
	/** Direction the wind is from, degrees. */
	direction: number
	/** Speed in knots. */
	speed: number
}

/** Signed difference a - b in the range -180 (exclusive) to 180. */
export function angleDiff(a: number, b: number): number {
	const d = norm(a - b)
	return d > 180 ? d - 360 : d
}

/** Circular mean of directions, so 350 and 010 average to 000. */
export function meanDirection(directions: number[]): number {
	let e = 0
	let n = 0
	for (const d of directions) {
		e += Math.sin((d * Math.PI) / 180)
		n += Math.cos((d * Math.PI) / 180)
	}
	return norm((Math.atan2(e, n) * 180) / Math.PI)
}

export interface WindSummary {
	count: number
	mean: number
	/** Furthest readings left and right of the mean. */
	low: number
	high: number
	meanSpeed: number
	minSpeed: number
	maxSpeed: number
	/** Degrees per reading the direction is moving; positive is veering. */
	trend: number
}

export function summarise(readings: WindReading[]): WindSummary | null {
	if (readings.length === 0) return null
	const mean = meanDirection(readings.map((r) => r.direction))
	const offsets = readings.map((r) => angleDiff(r.direction, mean))
	const speeds = readings.map((r) => r.speed)
	// Least-squares slope of offset against reading index.
	const n = offsets.length
	const xm = (n - 1) / 2
	const ym = offsets.reduce((s, y) => s + y, 0) / n
	let num = 0
	let den = 0
	offsets.forEach((y, x) => {
		num += (x - xm) * (y - ym)
		den += (x - xm) * (x - xm)
	})
	return {
		count: n,
		mean,
		low: norm(mean + Math.min(...offsets)),
		high: norm(mean + Math.max(...offsets)),
		meanSpeed: speeds.reduce((s, v) => s + v, 0) / n,
		minSpeed: Math.min(...speeds),
		maxSpeed: Math.max(...speeds),
		trend: den ? num / den : 0,
	}
}

export type ShiftAdvice = 'hold' | 'watch' | 'change'

export interface Skew {
	/** Degrees the mean wind is off the axis, always positive. */
	degrees: number
	/** Left is backed (anticlockwise of the axis), right is veered. */
	side: 'left' | 'right' | 'on'
	advice: ShiftAdvice
}

/**
 * World Sailing RM Manual L.6.4: usually no change under 15 degrees, start
 * considering one from 20.
 */
export function skewFromAxis(meanWind: number, axis: number): Skew {
	const diff = angleDiff(meanWind, axis)
	const degrees = Math.abs(diff)
	return {
		degrees,
		side: degrees < 0.5 ? 'on' : diff > 0 ? 'right' : 'left',
		advice: degrees >= 20 ? 'change' : degrees >= 15 ? 'watch' : 'hold',
	}
}

const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

/** Digits spoken singly, as on VHF: 240 is "two four zero". */
export function spokenDigits(text: string): string {
	return text
		.split('')
		.filter((c) => c >= '0' && c <= '9')
		.map((c) => DIGITS[Number(c)])
		.join(' ')
}

/** The workbook's wind report: "Committee wind, wind at Mark 1, ..." */
export function windReport(station: string, direction: number, speed: number): string {
	const bearing = String(Math.round(norm(direction)) % 360).padStart(3, '0')
	return `Committee wind, wind at ${station}, ${spokenDigits(bearing)} degrees, ${spokenDigits(String(Math.round(speed)))} knots`
}
