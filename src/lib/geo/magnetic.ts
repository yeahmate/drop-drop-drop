/**
 * Magnetic variation. Bearings are worked in whichever north the team
 * chooses; variation only matters when a bearing meets a real position
 * (latitude and longitude, or the phone's GPS), which is always true north.
 *
 * Variation comes from the World Magnetic Model and is positive east:
 * true = magnetic + variation.
 */

import geomagnetism from 'geomagnetism'
import { norm, type Vec } from './bearing'
import type { LatLon } from './position'
import type { WindReading } from './wind'

export type North = 'magnetic' | 'true'

/**
 * Variation in degrees at a position on a date, or null when the date is
 * outside the model's five-year life and the app needs updating.
 */
export function variation(position: LatLon, date: Date): number | null {
	try {
		return geomagnetism.model(date).point([position.lat, position.lon]).decl
	} catch {
		return null
	}
}

/** "0.5°E", "12.3°W" or "0.0°". */
export function formatVariation(degrees: number): string {
	const rounded = Math.round(Math.abs(degrees) * 10) / 10
	return `${rounded.toFixed(1)}°${rounded === 0 ? '' : degrees > 0 ? 'E' : 'W'}`
}

/** "M" or "T", for labelling a bearing. */
export function northLetter(north: North): 'M' | 'T' {
	return north === 'magnetic' ? 'M' : 'T'
}

/** A bearing with its north: "235°M". */
export function labelBearing(bearing: number, north: North): string {
	return `${String(Math.round(norm(bearing)) % 360).padStart(3, '0')}°${northLetter(north)}`
}

/** The variation to apply for a north setting: none when working in true. */
export function appliedVariation(north: North, variationDegrees: number | null): number {
	return north === 'magnetic' ? (variationDegrees ?? 0) : 0
}

export function toTrue(bearing: number, variationDegrees: number): number {
	return norm(bearing + variationDegrees)
}

export function fromTrue(bearing: number, variationDegrees: number): number {
	return norm(bearing - variationDegrees)
}

/** Turn a vector clockwise, so a point on bearing b moves to b + degrees. */
export function rotate(v: Vec, degrees: number): Vec {
	const r = (degrees * Math.PI) / 180
	return {
		e: v.e * Math.cos(r) + v.n * Math.sin(r),
		n: v.n * Math.cos(r) - v.e * Math.sin(r),
	}
}

/** Course offsets (in the team's north) to offsets from true north. */
export function courseToTrue(v: Vec, variationDegrees: number): Vec {
	return rotate(v, variationDegrees)
}

/** Offsets from true north (from a GPS fix) into the course's north. */
export function trueToCourse(v: Vec, variationDegrees: number): Vec {
	return rotate(v, -variationDegrees)
}

/**
 * Switch between magnetic and true without moving the course on the water:
 * the axis and logged wind directions are re-expressed in the new north.
 */
export function switchNorth<T extends { axis: number; north: North }>(
	spec: T, wind: WindReading[], to: North, variationDegrees: number | null,
): { spec: T; wind: WindReading[] } {
	if (spec.north === to) return { spec, wind }
	const shift = (to === 'true' ? 1 : -1) * (variationDegrees ?? 0)
	return {
		spec: { ...spec, north: to, axis: Math.round(norm(spec.axis + shift)) % 360 },
		wind: wind.map((w) => ({ ...w, direction: Math.round(norm(w.direction + shift)) % 360 })),
	}
}
