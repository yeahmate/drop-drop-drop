/**
 * The mark layer briefing checklist (version 1.6 of the spreadsheet), with
 * the answers the app already knows filled in from the course.
 */

import {
	buildCourse, formatBearing, formatDistance, roundingOrder, signal,
	type CourseSpec, type DistanceUnit,
} from './geo'

export interface ChecklistItem {
	id: string
	text: string
}

export const CHECKLIST: readonly ChecklistItem[] = [
	{ id: 'area', text: 'Race area / colour' },
	{ id: 'marks', text: 'Description of marks / colour' },
	{ id: 'course', text: 'Course configuration' },
	{ id: 'fleets', text: 'No. of courses / fleets' },
	{ id: 'forecast', text: 'Forecast, including trends' },
	{ id: 'tides', text: 'Tides: HW and direction' },
	{ id: 'shipping', text: 'Shipping movements' },
	{ id: 'roles', text: 'Assign roles / call signs: Marks 1, Marks 4 etc.' },
	{ id: 'vhf', text: 'Agree VHF channels' },
	{ id: 'gps', text: 'GPS units: NM / m' },
	{ id: 'wind', text: 'Min / max wind strength' },
	{ id: 'flags', text: 'Oscar / Romeo: does it apply?' },
	{ id: 'fuel', text: 'Fuel top up: where, card?' },
	{ id: 'speed', text: 'Marina speed limits' },
	{ id: 'bridge', text: 'Bridge?' },
	{ id: 'target', text: 'Target times / laps' },
	{ id: 'recordings', text: 'Recordings: when and where required?' },
	{ id: 'running', text: 'Running line 1st sub?' },
	{ id: 'buoys', text: 'Start / finish line buoys required' },
	{ id: 'start', text: 'Start line: pin / length' },
	{ id: 'finish', text: 'Finish line: pin / length' },
	{ id: 'gate', text: 'Gate size' },
	{ id: 'launch', text: 'Launch time: mark boats / fleet' },
	{ id: 'phones', text: 'Mobile phone numbers (Race Officer, other mark layers)' },
]

export type BriefState = Record<string, { done: boolean; note: string }>

/** Answers the course already holds, keyed by checklist item. */
export function knownAnswers(spec: CourseSpec, unit: DistanceUnit): Record<string, string> {
	const course = buildCourse(spec)
	return {
		course: `${signal(spec)}, axis ${formatBearing(spec.axis)}: ${roundingOrder(course)}`,
		gps: unit === 'nm' ? 'Nautical miles first, metres alongside' : 'Metres first, nautical miles alongside',
		start: formatDistance(spec.startLine, unit),
		finish: formatDistance(spec.finishLine, unit),
		gate: formatDistance(spec.gateWidth, unit),
		target: `${spec.beats} beats`,
	}
}

export function progress(state: BriefState): { done: number; total: number } {
	return { done: CHECKLIST.filter((i) => state[i.id]?.done).length, total: CHECKLIST.length }
}
