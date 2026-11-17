/**
 * Distance units. The engine works in metres. Display leads with nautical
 * miles and always shows metres alongside; a team may flip the order.
 */

export const METRES_PER_NM = 1852

export type DistanceUnit = 'nm' | 'm'

export function nmToMetres(nm: number): number {
	return nm * METRES_PER_NM
}

export function metresToNm(metres: number): number {
	return metres / METRES_PER_NM
}

/** Two decimals, or three under a tenth of a mile so gates and lines stay meaningful. */
export function formatNm(metres: number): string {
	const nm = metresToNm(metres)
	return `${nm.toFixed(nm < 0.1 ? 3 : 2)} NM`
}

export function formatMetres(metres: number): string {
	return `${Math.round(metres)} m`
}

/** Both units, primary first: "0.49 NM (900 m)" or "900 m (0.49 NM)". */
export function formatDistance(metres: number, primary: DistanceUnit = 'nm'): string {
	const nm = formatNm(metres)
	const m = formatMetres(metres)
	return primary === 'nm' ? `${nm} (${m})` : `${m} (${nm})`
}
