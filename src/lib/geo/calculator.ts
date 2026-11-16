/**
 * Course angle calculator: the on-screen version of Paul Kimmens' laminated
 * dial. Each pointer sits at a fixed offset from the course axis; turning the
 * dial to the axis reads every mark-laying bearing at once.
 */

import { norm } from './bearing'

export interface Pointer {
	/** Label as printed on the physical calculator. */
	label: string
	/** Interior angle the pointer applies to, or 90 for square lines. */
	angle: 60 | 70 | 80 | 90 | 180
	/** Degrees clockwise from the course axis. */
	offset: number
}

export const POINTERS: readonly Pointer[] = [
	{ label: '2-1, 3-4', angle: 60, offset: 60 },
	{ label: '2-1, 3-4', angle: 70, offset: 70 },
	{ label: '2-1, 3-4', angle: 80, offset: 80 },
	{ label: 'Gate, Pin-CB', angle: 90, offset: 90 },
	{ label: '3-Finish', angle: 80, offset: 100 },
	{ label: '3-Finish', angle: 70, offset: 110 },
	{ label: '3-Finish', angle: 60, offset: 120 },
	{ label: 'Reciprocal', angle: 180, offset: 180 },
	{ label: '1-2, 4-3', angle: 60, offset: 240 },
	{ label: '1-2, 4-3', angle: 70, offset: 250 },
	{ label: '1-2, 4-3', angle: 80, offset: 260 },
	{ label: 'Gate, CB-Pin', angle: 90, offset: 270 },
	{ label: 'Finish-3', angle: 80, offset: 280 },
	{ label: 'Finish-3', angle: 70, offset: 290 },
	{ label: 'Finish-3', angle: 60, offset: 300 },
]

export interface Reading extends Pointer {
	bearing: number
}

/** Every pointer's bearing for a course axis. */
export function readCalculator(axis: number): Reading[] {
	return POINTERS.map((p) => ({ ...p, bearing: norm(axis + p.offset) }))
}
