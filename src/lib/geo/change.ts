/**
 * Course change: move the mark at the end of the next leg and work out what
 * the mark boat does and what the Charlie board shows.
 *
 * Racing Rules of Sailing 33: flag C with repetitive sounds, plus the new
 * compass bearing or a green triangle (to starboard) or red rectangle (to
 * port), and a plus or minus if the leg's length changes.
 */

import { leg, offset, type Leg, type Vec } from './bearing'
import { angleDiff } from './wind'

export interface LegChange {
	/** Where the changed leg starts: the mark boats round before it. */
	from: Vec
	/** Where the mark at the end of the leg is now. */
	mark: Vec
	/** New bearing of the leg; omit to keep it. */
	bearing?: number
	/** New length of the leg in metres; omit to keep it. */
	length?: number
	/** Metres a mark may move without a signal. Zero unless the SIs say otherwise. */
	noSignalWithin?: number
}

export interface ChangeResult {
	/** The leg as it is now, and as it will be. */
	before: Leg
	after: Leg
	position: Vec
	/** How the mark boat gets from the old position to the new one. */
	move: Leg
	/** Degrees the leg turns, always positive. */
	turn: number
	direction: 'starboard' | 'port' | 'none'
	/** Change in length as a fraction of the old length; negative is shorter. */
	lengthChange: number
	length: 'longer' | 'shorter' | 'same'
	signal: {
		needed: boolean
		/** New bearing for the board, three digits. */
		bearing: string
		shape: 'green triangle' | 'red rectangle' | null
		sign: '+' | '−' | null
	}
}

export function changeLeg(change: LegChange): ChangeResult {
	const before = leg(change.from, change.mark)
	const bearing = change.bearing ?? before.bearing
	const length = change.length ?? before.distance
	const position = offset(change.from, bearing, length)
	const after = leg(change.from, position)
	const move = leg(change.mark, position)

	const diff = angleDiff(bearing, before.bearing)
	const turn = Math.abs(diff)
	const direction = turn < 0.5 ? 'none' : diff > 0 ? 'starboard' : 'port'
	const lengthChange = before.distance ? (length - before.distance) / before.distance : 0
	const changedLength = Math.abs(length - before.distance) >= 1
	const lengthWord = !changedLength ? 'same' : lengthChange > 0 ? 'longer' : 'shorter'

	return {
		before,
		after,
		position,
		move,
		turn,
		direction,
		lengthChange,
		length: lengthWord,
		signal: {
			needed: move.distance > (change.noSignalWithin ?? 0) && move.distance >= 1,
			bearing: String(Math.round(after.bearing) % 360).padStart(3, '0'),
			shape: direction === 'starboard' ? 'green triangle' : direction === 'port' ? 'red rectangle' : null,
			sign: lengthWord === 'longer' ? '+' : lengthWord === 'shorter' ? '−' : null,
		},
	}
}
