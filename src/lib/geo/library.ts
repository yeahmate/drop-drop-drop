/**
 * Course library. A course spec plus a signal (for example I2) gives the
 * marks to lay, the rounding order and the sailed length.
 *
 * Signals follow World Sailing: the letter is the course, the number is the
 * count of beats. X adds mark 5 and a finish at the committee boat.
 */

import { ORIGIN, distanceBetween, offset, type Vec } from './bearing'
import type { North } from './magnetic'
import { nmToMetres } from './units'

export type CourseType = 'L' | 'LA' | 'LR' | 'LRA' | 'I' | 'O' | 'IX' | 'OX'

export const COURSE_TYPES: readonly { type: CourseType; name: string }[] = [
	{ type: 'L', name: 'Windward/leeward' },
	{ type: 'LA', name: 'Windward/leeward, offset mark' },
	{ type: 'LR', name: 'Windward/leeward, reaching finish' },
	{ type: 'LRA', name: 'Windward/leeward, offset mark, reaching finish' },
	{ type: 'I', name: 'Inner trapezoid' },
	{ type: 'O', name: 'Outer trapezoid' },
	{ type: 'IX', name: 'Inner trapezoid, mark 5, committee boat finish' },
	{ type: 'OX', name: 'Outer trapezoid, mark 5, committee boat finish' },
]

export interface CourseSpec {
	type: CourseType
	/** Which north the axis and every bearing are given in. */
	north: North
	/** Number of beats, the number in the course signal. */
	beats: number
	/** Course axis: bearing from the reference point to mark 1. */
	axis: number
	/** Beat length in metres, reference point to mark 1. */
	beat: number
	/** Trapezoid interior angle at mark 1. */
	angle: number
	/** Trapezoid reach 1 to 2 as a fraction of the beat. */
	reachRatio: number
	/** Trapezoid outer beat 2 to 3 as a fraction of the beat. */
	outerRatio: number
	/** Gate width in metres. */
	gateWidth: number
	/** Start line length in metres. */
	startLine: number
	/** Metres from the reference point down to the start line. */
	startOffset: number
	/** Offset mark 1A: angle at mark 1, 80 or 90. */
	offsetAngle: number
	/** Offset mark 1A: metres from mark 1. */
	offsetDistance: number
	/** Finish line length in metres. */
	finishLine: number
	/** Reaching finish without mark 5: metres from gate 3 to the finish. */
	finishReach: number
	/** Mark 5: metres downwind of the start line centre. */
	mark5Offset: number
}

export const DEFAULT_SPEC: CourseSpec = {
	type: 'I',
	north: 'magnetic',
	beats: 2,
	axis: 0,
	beat: nmToMetres(0.5),
	angle: 70,
	reachRatio: 2 / 3,
	outerRatio: 1,
	gateWidth: 40,
	startLine: 200,
	startOffset: nmToMetres(0.05),
	offsetAngle: 90,
	offsetDistance: 75,
	finishLine: 50,
	finishReach: nmToMetres(0.15),
	mark5Offset: 150,
}

export function isTrapezoid(type: CourseType): boolean {
	return type === 'I' || type === 'O' || type === 'IX' || type === 'OX'
}

export function hasOffsetMark(type: CourseType): boolean {
	return type === 'LA' || type === 'LRA'
}

export function hasMark5(type: CourseType): boolean {
	return type === 'IX' || type === 'OX'
}

export function signal(spec: Pick<CourseSpec, 'type' | 'beats'>): string {
	return `${spec.type}${spec.beats}`
}

export interface Waypoint {
	/** Label for the rounding order, for example "4s/4p". */
	label: string
	position: Vec
}

export interface BuiltCourse {
	/** Marks to lay, keyed by name. Gate centres are not marks. */
	marks: Record<string, Vec>
	/** Named points that are not laid marks: reference, line centres. */
	points: { ref: Vec; start: Vec; cb: Vec; pin: Vec; finish: Vec }
	/** Start, each rounding in order, Finish. */
	sequence: Waypoint[]
	/** Sailed length in metres, straight lines between waypoints. */
	length: number
}

function gate(centre: Vec, axis: number, width: number): { s: Vec; p: Vec } {
	// Named for the side boats leave them on sailing downwind through the
	// gate, so looking upwind the port mark is on the right.
	return {
		s: offset(centre, axis - 90, width / 2),
		p: offset(centre, axis + 90, width / 2),
	}
}

function repeat<T>(items: T[], times: number): T[] {
	return Array.from({ length: Math.max(0, times) }, () => items).flat()
}

export function buildCourse(spec: CourseSpec): BuiltCourse {
	const { type, axis, beat } = spec
	const beats = Math.max(1, Math.round(spec.beats))
	const trapezoid = isTrapezoid(type)

	const ref = ORIGIN
	const start = offset(ref, axis + 180, spec.startOffset)
	const cb = offset(start, axis + 90, spec.startLine / 2)
	const pin = offset(start, axis - 90, spec.startLine / 2)
	const m1 = offset(ref, axis, beat)
	const lee = gate(ref, axis, spec.gateWidth)

	const wp = (label: string, position: Vec): Waypoint => ({ label, position })
	const marks: Record<string, Vec> = { '1': m1 }
	const sequence: Waypoint[] = [wp('Start', start), wp('1', m1)]
	let finish: Vec

	if (trapezoid) {
		const m2 = offset(m1, axis + 180 + spec.angle, spec.reachRatio * beat)
		const c3 = offset(m2, axis + 180, spec.outerRatio * beat)
		const g3 = gate(c3, axis, spec.gateWidth)
		Object.assign(marks, { '2': m2, '3s': g3.s, '3p': g3.p, '4s': lee.s, '4p': lee.p })

		const w2 = wp('2', m2)
		if (type === 'I' || type === 'IX') {
			sequence.push(...repeat([wp('4s/4p', ref), wp('1', m1)], beats - 1), w2)
		} else {
			sequence.push(w2, ...repeat([wp('3s/3p', c3), w2], beats - 1))
		}
		sequence.push(wp('3p', g3.p))

		if (hasMark5(type)) {
			const m5 = offset(start, axis + 180, spec.mark5Offset)
			marks['5'] = m5
			sequence.push(wp('5', m5))
			// Finish line runs astern of the committee boat.
			finish = offset(cb, axis + 180, spec.finishLine / 2)
		} else {
			finish = offset(c3, axis + 180 - spec.angle, spec.finishReach)
		}
	} else {
		Object.assign(marks, { '2s': lee.s, '2p': lee.p })
		const top: Waypoint[] = [wp('1', m1)]
		if (hasOffsetMark(type)) {
			const m1a = offset(m1, axis + 180 + spec.offsetAngle, spec.offsetDistance)
			marks['1a'] = m1a
			top.push(wp('1a', m1a))
			sequence.push(wp('1a', m1a))
		}
		sequence.push(...repeat([wp('2s/2p', ref), ...top], beats - 1))
		if (type === 'LR' || type === 'LRA') {
			// Reaching finish: round 2p, finish line off the committee boat's
			// starboard side.
			sequence.push(wp('2p', lee.p))
			finish = offset(cb, axis + 90, spec.finishLine / 2)
		} else {
			finish = start
		}
	}

	sequence.push(wp('Finish', finish))

	let length = 0
	for (let i = 1; i < sequence.length; i++) {
		length += distanceBetween(sequence[i - 1].position, sequence[i].position)
	}

	return { marks, points: { ref, start, cb, pin, finish }, sequence, length }
}

/** Rounding order as text: "Start – 1 – 4s/4p – 1 – 2 – 3p – Finish". */
export function roundingOrder(course: BuiltCourse): string {
	return course.sequence.map((w) => w.label).join(' – ')
}

/** Estimated minutes for the first boat at an average speed in knots. */
export function estimatedMinutes(lengthMetres: number, knots: number): number {
	return (lengthMetres / 1852 / knots) * 60
}

export interface LayRow {
	mark: string
	/** Bearing from the reference point to the mark. */
	bearing: number
	/** What a GPS set to GoTo the reference reads at the mark. */
	gpsReads: number
	/** Metres from the reference point. */
	distance: number
	position: Vec
}

/**
 * The mark layer's table: every mark as a bearing and distance from the
 * reference point, plus the start line ends.
 */
export function layTable(course: BuiltCourse): LayRow[] {
	const row = (mark: string, position: Vec): LayRow => {
		const distance = distanceBetween(ORIGIN, position)
		const bearing = (Math.atan2(position.e, position.n) * 180) / Math.PI
		const b = ((bearing % 360) + 360) % 360
		return { mark, bearing: b, gpsReads: (b + 180) % 360, distance, position }
	}
	const order = (name: string) => name.replace(/^(\d+)([a-z]?)$/, (_, n, s) => n.padStart(2, '0') + s)
	const marks = Object.keys(course.marks)
		.sort((a, b) => order(a).localeCompare(order(b)))
		.map((name) => row(name, course.marks[name]))
	return [...marks, row('CB', course.points.cb), row('Pin', course.points.pin)]
}
