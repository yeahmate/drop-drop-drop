/**
 * Sizing helpers from the World Sailing Race Management Manual: start line
 * length (L.3.1) and gate width (J.2.3).
 */

export interface BoatClass {
	name: string
	/** Hull length in metres. */
	length: number
	/** Start line multiplier on the summed boat lengths. */
	lineFactor: number
}

export const BOAT_CLASSES: readonly BoatClass[] = [
	{ name: 'ILCA', length: 4.23, lineFactor: 1.5 },
	{ name: '420', length: 4.2, lineFactor: 1.5 },
	{ name: '470', length: 4.7, lineFactor: 1.5 },
	{ name: '29er', length: 4.45, lineFactor: 2 },
	{ name: '49er', length: 4.99, lineFactor: 2 },
	{ name: 'Nacra 17', length: 5.25, lineFactor: 2 },
	{ name: 'Optimist', length: 2.3, lineFactor: 1.5 },
	{ name: 'Topper', length: 3.4, lineFactor: 1.5 },
	{ name: 'Europe', length: 3.35, lineFactor: 1.5 },
	{ name: 'Solo', length: 3.78, lineFactor: 1.5 },
]

/** Start line length in metres: boats x boat length x factor (1.5 to 3). */
export function startLineLength(boats: number, boatLength: number, factor = 1.5): number {
	return boats * boatLength * factor
}

/** Gate width in metres: about 10 boat lengths, never fewer than 7. */
export function gateWidth(boatLength: number, boatLengths = 10): number {
	return boatLength * Math.max(7, boatLengths)
}

/** Whether a laid distance is inside a tolerance given as fractions. */
export function withinTolerance(actual: number, target: number, under: number, over: number): boolean {
	return actual >= target * (1 - under) && actual <= target * (1 + over)
}

/** Workbook Module 9 limits: gate -5% +15%, start line -5% +10%. */
export const gateWidthOk = (actual: number, target: number) => withinTolerance(actual, target, 0.05, 0.15)
export const startLineOk = (actual: number, target: number) => withinTolerance(actual, target, 0.05, 0.1)
