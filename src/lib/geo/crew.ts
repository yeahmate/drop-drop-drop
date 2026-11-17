/**
 * Who lays what, and what to load: mark boat assignments and an equipment
 * count for a course.
 */

import type { BuiltCourse } from './library'

export interface BoatJob {
	boat: string
	marks: string[]
}

/**
 * The workbook's usual split: Marks 1 takes the windward end, Marks 3 the
 * outer gate, Marks 4 the leeward gate and the lines.
 */
export function assignments(course: BuiltCourse): BoatJob[] {
	const has = (name: string) => name in course.marks
	const pick = (...names: string[]) => names.filter(has)
	const jobs: BoatJob[] = [{ boat: 'Marks 1', marks: pick('1', '1a', '2') }]
	if (has('3s')) {
		jobs.push({ boat: 'Marks 3', marks: pick('3s', '3p', '5') })
		jobs.push({ boat: 'Marks 4', marks: [...pick('4s', '4p'), 'Pin', 'Finish pin'] })
	} else {
		// Windward/leeward: mark 2 here is the leeward gate, not a reach mark.
		jobs[0].marks = pick('1', '1a')
		jobs.push({ boat: 'Marks 2', marks: [...pick('2s', '2p'), 'Pin', 'Finish pin'] })
	}
	return jobs
}

export interface Equipment {
	/** Course marks, from the course itself. */
	courseMarks: number
	/** Start pin and finish pin buoys. */
	lineMarks: number
	spares: number
	/** Buoys to load in total; each needs its own anchor and warp. */
	total: number
}

export function equipment(course: BuiltCourse, options: { pinEndBoat?: boolean; spares?: number } = {}): Equipment {
	const courseMarks = Object.keys(course.marks).length
	// A pin-end boat replaces the start pin buoy. A finish at the start line
	// reuses the start pin.
	const finishAtStart = course.points.finish === course.points.start
	const lineMarks = (options.pinEndBoat ? 0 : 1) + (finishAtStart ? 0 : 1)
	const spares = options.spares ?? 1
	return { courseMarks, lineMarks, spares, total: courseMarks + lineMarks + spares }
}
