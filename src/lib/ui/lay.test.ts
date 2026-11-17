import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SPEC, offset, ORIGIN, toLatLon, type CourseSpec } from '../geo'
import type { Fix, GpsError } from '../gps'
import LayView from './LayView.svelte'
import LineView from './LineView.svelte'
import WindHarness from './WindHarness.test.svelte'

afterEach(cleanup)

const spec: CourseSpec = { ...DEFAULT_SPEC, type: 'IX', beats: 2, axis: 235, beat: 900, angle: 70, startLine: 250 }
const text = (id: string) => screen.getByTestId(id).textContent?.replace(/\s+/g, ' ').trim()

describe('LayView', () => {
	const refLat = "N 50° 35.000'"
	const refLon = "W 002° 26.000'"
	const reference = { lat: 50 + 35 / 60, lon: -(2 + 26 / 60) }
	const fixAt = (bearing: number, distance: number, side = 0): Fix => ({
		position: toLatLon(reference, offset(offset(ORIGIN, bearing, distance), bearing - 90, side)),
		accuracy: 4,
	})

	function fakeGps() {
		let send: (fix: Fix) => void = () => {}
		let fail: (error: GpsError) => void = () => {}
		const stop = vi.fn()
		const gpsWatch = (onFix: (fix: Fix) => void, onError: (e: GpsError) => void) => {
			send = onFix
			fail = onError
			return stop
		}
		return { gpsWatch, stop, send: (f: Fix) => send(f), fail: (e: GpsError) => fail(e) }
	}

	it('shows the instruction for mark 1 with the GPS reciprocal', () => {
		// Workbook Module 9: axis 235 and 900 m, GPS shows 055.
		render(LayView, { spec })
		expect(text('bearing')).toBe('235')
		expect(text('distance')).toBe('0.49 NM (900 m)')
		expect(text('gps-reads')).toContain('055')
	})

	it('switches mark and can lay from another mark', async () => {
		render(LayView, { spec })
		await fireEvent.click(screen.getByRole('button', { name: 'Mark 2' }))
		expect(text('bearing')).toBe('196')
		// From mark 1 the reach is axis + 180 + 70 at two thirds of the beat.
		await fireEvent.change(screen.getByLabelText('Lay from'), { target: { value: '1' } })
		expect(text('bearing')).toBe('125')
		expect(text('distance')).toBe('0.32 NM (600 m)')
		expect(text('gps-reads')).toContain('305')
	})

	it('works out the anchor drop from depth and warp', async () => {
		render(LayView, { spec, depth: 12, warp: 25 })
		expect(text('drop')).toBe('22 m upwind or up-tide')
		await fireEvent.input(screen.getByLabelText('Warp (m)'), { target: { value: '10' } })
		expect(text('drop')).toBe('0 m upwind or up-tide')
	})

	it('will not guide without a reference position', () => {
		render(LayView, { spec })
		expect((screen.getByText('Guide me with phone GPS') as HTMLButtonElement).disabled).toBe(true)
		expect((screen.getByText('Ping: mark laid here') as HTMLButtonElement).disabled).toBe(true)
	})

	it('guides the boat down the line and calls on station', async () => {
		const gps = fakeGps()
		render(LayView, { spec, refLat, refLon, gpsWatch: gps.gpsWatch })
		await fireEvent.click(screen.getByText('Guide me with phone GPS'))
		expect(screen.getByText('Waiting for a GPS fix…')).toBeTruthy()

		// 140 m short and 18 m left of the line (left looking down 235 is 145).
		gps.send(fixAt(235, 760, 18))
		await tick()
		expect(text('live')).toContain('140 m')
		expect(text('live')).toContain('18 m')
		expect(text('live')).toContain('left of line, steer right')
		expect(text('live')).toContain('GPS ±4 m')

		gps.send(fixAt(235, 895))
		await tick()
		expect(text('live')).toContain('On station: drop')

		await fireEvent.click(screen.getByText('Stop guidance'))
		expect(gps.stop).toHaveBeenCalled()
		expect(screen.queryByTestId('live')).toBeNull()
	})

	it('turns GPS positions into magnetic before guiding', async () => {
		// With 10 degrees east variation the 235 magnetic line runs 245 true.
		const gps = fakeGps()
		render(LayView, { spec, refLat, refLon, variation: 10, gpsWatch: gps.gpsWatch })
		await fireEvent.click(screen.getByText('Guide me with phone GPS'))
		gps.send(fixAt(245, 760))
		await tick()
		expect(text('live')).toContain('140 m')
		expect(text('live')).toContain('On the line')
		expect(text('live')).toContain('now 055')

		// The same fix read as true bearings would be well off the line.
		cleanup()
		const gps2 = fakeGps()
		render(LayView, { spec: { ...spec, north: 'true' }, refLat, refLon, variation: 10, gpsWatch: gps2.gpsWatch })
		await fireEvent.click(screen.getByText('Guide me with phone GPS'))
		gps2.send(fixAt(245, 760))
		await tick()
		expect(text('live')).toContain('right of line, steer left')
	})

	it('explains a refused location permission', async () => {
		const gps = fakeGps()
		render(LayView, { spec, refLat, refLon, gpsWatch: gps.gpsWatch })
		await fireEvent.click(screen.getByText('Guide me with phone GPS'))
		gps.fail('denied')
		await tick()
		expect(screen.getByRole('alert').textContent).toContain('Location permission was refused')
	})

	it('pings the reference and records a laid mark against its plan', async () => {
		const gpsPing = vi.fn()
			.mockResolvedValueOnce({ position: reference, accuracy: 3 })
			.mockResolvedValueOnce(fixAt(235, 908))
		render(LayView, { spec, gpsPing })
		await fireEvent.click(screen.getByText('Ping reference here'))
		await tick()
		expect((screen.getByLabelText('Latitude') as HTMLInputElement).value).toBe(refLat)
		expect((screen.getByLabelText('Longitude') as HTMLInputElement).value).toBe(refLon)

		await fireEvent.click(screen.getByText('Ping: mark laid here'))
		await tick()
		await tick()
		expect(screen.getByText('laid, 8 m off').className).toContain('ok')
	})

	it('flags a mark laid outside tolerance', () => {
		render(LayView, { spec, refLat, refLon, laid: { '1': offset(ORIGIN, 235, 940) } })
		expect(screen.getByText('laid, 40 m off').className).not.toContain('ok')
		expect(screen.getByRole('button', { name: 'Mark 1, laid, 40 m off' }).className).toContain('off')
	})
})

describe('LineView', () => {
	it('gives square line bearings and the pin boat anchor bearings', () => {
		// Workbook Module 9 exercises 4 and 5, axis 175.
		render(LineView, { spec: { ...spec, axis: 175 } })
		expect(text('pin-to-cb')).toBe('265')
		expect(text('cb-to-pin')).toBe('085')
		expect(text('anchor')).toBe('Drop the anchor at 277 to 280 to the committee boat')
	})

	it('applies bias and says how far to move the pin', async () => {
		render(LineView, { spec: { ...spec, axis: 175 } })
		await fireEvent.click(screen.getByLabelText('Bias plus 5 degrees'))
		expect(text('pin-to-cb')).toBe('270')
		expect(text('pin-move')).toBe('Move the pin 22 m upwind') // calculator table: 250 m, 5 degrees
		await fireEvent.click(screen.getByLabelText('Bias minus 5 degrees'))
		await fireEvent.click(screen.getByLabelText('Bias minus 5 degrees'))
		expect(text('pin-move')).toBe('Move the pin 22 m downwind')
	})

	it('checks a measured line against the tolerance', async () => {
		render(LineView, { spec })
		const input = screen.getByLabelText('Measured length (m)')
		await fireEvent.input(input, { target: { value: '270' } })
		expect(text('line-check')).toBe('Within tolerance (238 to 275 m)')
		await fireEvent.input(input, { target: { value: '230' } })
		expect(text('line-check')).toContain('Outside tolerance')
	})
})

describe('WindView', () => {
	const readings = (dirs: number[]) => dirs.map((direction, i) => ({ time: i, direction, speed: 10 + (i % 3) }))

	it('summarises the log against the axis', () => {
		render(WindHarness, { initial: spec, readings: readings([232, 238, 240, 235, 230]) })
		expect(text('mean')).toBe('235')
		expect(text('range')).toBe('230–240')
		expect(text('skew')).toBe('0°')
		expect(text('advice')).toBe('No change needed')
	})

	it('logs a reading with the stepper and words the VHF call', async () => {
		render(WindHarness, { initial: spec })
		expect(screen.getByText(/No readings yet/)).toBeTruthy()
		await fireEvent.click(screen.getByLabelText('Direction plus 5'))
		await fireEvent.click(screen.getByLabelText('Speed plus 1'))
		expect(text('vhf')).toBe('Say on VHF: Committee wind, wind at Mark 1, two four zero degrees, one one knots.')
		await fireEvent.click(screen.getByText('Log reading'))
		expect(text('count')).toBe('1')
		expect(text('mean')).toBe('240')
		await fireEvent.click(screen.getByText('Undo last reading'))
		expect(text('count')).toBe('0')
	})

	it('advises a change at 20 degrees and can re-point the axis', async () => {
		render(WindHarness, { initial: spec, readings: readings([256, 258, 254, 256]) })
		expect(text('skew')).toBe('21° R')
		expect(text('advice')).toContain('Consider moving the course')
		await fireEvent.click(screen.getByText('Set axis to mean wind'))
		expect(text('axis')).toBe('255')
		expect(text('advice')).toBe('No change needed')
	})

	it('wraps the stepper through north', async () => {
		render(WindHarness, { initial: { ...spec, axis: 0 } })
		await fireEvent.click(screen.getByLabelText('Direction minus 5'))
		expect(text('vhf')).toContain('three five five degrees')
	})
})
