/**
 * Start line: bearings between the pin and the committee boat, with bias,
 * and where a pin-end boat anchors to leave room for adjustment.
 */

import { norm } from './bearing'

export interface StartLine {
	/** Bearing from the pin to the committee boat. */
	pinToCb: number
	/** Bearing from the committee boat to the pin. */
	cbToPin: number
	/** Metres the pin moves up or down the course for the bias. */
	pinMove: number
}

/**
 * A square line is 90 degrees to the axis. Positive bias moves the pin
 * upwind (favouring the pin end), negative moves it downwind.
 */
export function startLine(axis: number, length: number, bias = 0): StartLine {
	return {
		pinToCb: norm(axis + 90 + bias),
		cbToPin: norm(axis - 90 + bias),
		pinMove: length * Math.tan((Math.abs(bias) * Math.PI) / 180),
	}
}

/**
 * A pin-end boat drops its anchor 12 to 15 degrees high of the line bearing,
 * then falls back onto the line, leaving about 10 degrees either way.
 */
export function pinBoatAnchorBearings(axis: number): { from: number; to: number } {
	const square = norm(axis + 90)
	return { from: norm(square + 12), to: norm(square + 15) }
}
