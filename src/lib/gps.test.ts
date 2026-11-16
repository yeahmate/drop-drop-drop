import { describe, expect, it, vi } from 'vitest'
import { ping, watch } from './gps'

const position = { coords: { latitude: 50.5, longitude: -2.4, accuracy: 4 } } as GeolocationPosition

describe('gps', () => {
	it('passes fixes on and stops when asked', () => {
		const geo = {
			watchPosition: vi.fn((ok: PositionCallback) => { ok(position); return 7 }),
			clearWatch: vi.fn(),
			getCurrentPosition: vi.fn(),
		}
		const onFix = vi.fn()
		const stop = watch(onFix, vi.fn(), geo)
		expect(onFix).toHaveBeenCalledWith({ position: { lat: 50.5, lon: -2.4 }, accuracy: 4 })
		stop()
		expect(geo.clearWatch).toHaveBeenCalledWith(7)
	})

	it('reports refusal, no fix and no GPS', () => {
		const failing = (code: number) => ({
			watchPosition: (_ok: PositionCallback, err?: PositionErrorCallback | null) => {
				err?.({ code } as GeolocationPositionError)
				return 1
			},
			clearWatch: vi.fn(),
			getCurrentPosition: vi.fn(),
		})
		const onError = vi.fn()
		watch(vi.fn(), onError, failing(1))
		watch(vi.fn(), onError, failing(3))
		watch(vi.fn(), onError, null as never)
		expect(onError.mock.calls.map((c) => c[0])).toEqual(['denied', 'no-fix', 'unavailable'])
	})

	it('pings one position', async () => {
		const geo = {
			watchPosition: vi.fn(),
			clearWatch: vi.fn(),
			getCurrentPosition: (ok: PositionCallback) => ok(position),
		}
		await expect(ping(geo)).resolves.toEqual({ position: { lat: 50.5, lon: -2.4 }, accuracy: 4 })
		await expect(ping(null as never)).rejects.toBe('unavailable')
	})
})
