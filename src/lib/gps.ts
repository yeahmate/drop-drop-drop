/**
 * Phone GPS. Wraps the browser geolocation API so views can be tested with
 * a fake, and so a missing or refused GPS becomes a plain message.
 */

import type { LatLon } from './geo'

export interface Fix {
	position: LatLon
	/** Reported accuracy radius in metres. */
	accuracy: number
}

export type GpsError = 'unavailable' | 'denied' | 'no-fix'

export const GPS_MESSAGES: Record<GpsError, string> = {
	unavailable: 'This device has no GPS available to the browser.',
	denied: 'Location permission was refused. Allow it in the browser settings.',
	'no-fix': 'No GPS fix yet. Check the phone has a clear view of the sky.',
}

type Geo = Pick<Geolocation, 'watchPosition' | 'clearWatch' | 'getCurrentPosition'>

const OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }

const toFix = (p: GeolocationPosition): Fix => ({
	position: { lat: p.coords.latitude, lon: p.coords.longitude },
	accuracy: p.coords.accuracy,
})

const toError = (e: GeolocationPositionError): GpsError => (e.code === 1 ? 'denied' : 'no-fix')

function device(): Geo | undefined {
	return globalThis.navigator?.geolocation
}

/** Follow the position. Returns a function that stops following. */
export function watch(onFix: (fix: Fix) => void, onError: (error: GpsError) => void, geo = device()): () => void {
	if (!geo) {
		onError('unavailable')
		return () => {}
	}
	const id = geo.watchPosition((p) => onFix(toFix(p)), (e) => onError(toError(e)), OPTIONS)
	return () => geo.clearWatch(id)
}

/** One position, for pinging the reference point or a laid mark. */
export function ping(geo = device()): Promise<Fix> {
	return new Promise((resolve, reject) => {
		if (!geo) return reject('unavailable' satisfies GpsError)
		geo.getCurrentPosition((p) => resolve(toFix(p)), (e) => reject(toError(e)), OPTIONS)
	})
}
