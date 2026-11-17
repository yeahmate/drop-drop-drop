import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SPEC, nmToMetres } from '../geo'
import AngleCalculator from './AngleCalculator.svelte'
import PlanView from './PlanHarness.test.svelte'

afterEach(cleanup)

const cells = (testId: string) =>
	Array.from(screen.getByTestId(testId).querySelectorAll('td')).map((td) => td.textContent?.trim())

describe('PlanView', () => {
	const spec = { ...DEFAULT_SPEC, type: 'IX' as const, beats: 2, axis: 75, beat: nmToMetres(0.9), angle: 70 }

	it('shows the workbook bearings, nautical miles first', () => {
		// Workbook Module 9 exercise 1, read from the reference outwards.
		render(PlanView, { initial: { ...spec } })
		expect(cells('lay-1')).toEqual(['1', '075', '0.90 NM (1667 m)', '255'])
		expect(cells('lay-2').slice(1)).toEqual(['036', '0.89 NM (1657 m)', '216'])
		expect(screen.getByTestId('rounding-order').textContent).toBe('Start – 1 – 4s/4p – 1 – 2 – 3p – 5 – Finish')
	})

	it('leads with metres when the team chooses metres', () => {
		render(PlanView, { initial: { ...spec }, unit: 'm' })
		expect(cells('lay-1')[2]).toBe('1667 m (0.90 NM)')
	})

	it('turns the axis in five degree steps and wraps at north', async () => {
		render(PlanView, { initial: { ...spec, axis: 355 } })
		await fireEvent.click(screen.getByLabelText('Axis plus 5 degrees'))
		expect(cells('lay-1')[1]).toBe('000')
		await fireEvent.click(screen.getByLabelText('Axis minus 5 degrees'))
		expect(cells('lay-1')[1]).toBe('355')
	})

	it('rejects an impossible reference and shows positions for a valid one', async () => {
		render(PlanView, { initial: { ...spec, axis: 0 } })
		const lat = screen.getByLabelText('Reference latitude')
		const lon = screen.getByLabelText('Reference longitude')
		await fireEvent.input(lat, { target: { value: "N 51° 97.010'" } })
		expect(screen.getByText('Minutes must be less than 60')).toBeTruthy()
		expect(screen.queryByText('Position')).toBeNull()

		await fireEvent.input(lat, { target: { value: "N 50° 35.000'" } })
		await fireEvent.input(lon, { target: { value: "W 002° 26.000'" } })
		expect(screen.getByText('Position')).toBeTruthy()
		// 0.9 NM due north is 0.9 minutes of latitude.
		expect(cells('lay-1')[4]).toContain("N 50° 35.900'")
		expect(cells('lay-1')[4]).toContain("W 002° 26.000'")
	})

	it('applies variation to positions for magnetic bearings but not for true', async () => {
		// 0.9 NM on 000 magnetic with 10 degrees east variation is 010 true:
		// 0.9 x cos(10) = 0.886 minutes north, and east of the reference.
		const enter = async () => {
			await fireEvent.input(screen.getByLabelText('Reference latitude'), { target: { value: "N 50° 35.000'" } })
			await fireEvent.input(screen.getByLabelText('Reference longitude'), { target: { value: "W 002° 26.000'" } })
		}
		render(PlanView, { initial: { ...spec, axis: 0 }, variation: 10 })
		await enter()
		expect(cells('lay-1')[4]).toContain("N 50° 35.886'")
		expect(cells('lay-1')[4]).toContain("W 002° 25.754'")
		cleanup()

		render(PlanView, { initial: { ...spec, axis: 0, north: 'true' }, variation: 10 })
		await enter()
		expect(cells('lay-1')[4]).toContain("N 50° 35.900'")
		expect(cells('lay-1')[4]).toContain("W 002° 26.000'")
	})

	it('sizes the line and gate from the fleet', async () => {
		render(PlanView, { initial: { ...spec } })
		await fireEvent.input(screen.getByLabelText('Boats'), { target: { value: '42' } })
		await fireEvent.click(screen.getByText('Set line and gate'))
		expect((screen.getByLabelText('Start line (m)') as HTMLInputElement).value).toBe('266')
		expect((screen.getByLabelText('Gate width (m)') as HTMLInputElement).value).toBe('42')
	})

	it('shows the two-thirds reach to three decimals and keeps it exact', async () => {
		render(PlanView, { initial: { ...spec } })
		const reach = screen.getByLabelText(/Reach, fraction of beat/) as HTMLInputElement
		expect(reach.value).toBe('0.667')
		await fireEvent.change(reach, { target: { value: '0.5' } })
		expect(cells('lay-2')[2]).toBe('0.86 NM (1588 m)')
		await fireEvent.change(reach, { target: { value: '0.667' } })
		expect(cells('lay-2').slice(1)).toEqual(['036', '0.89 NM (1657 m)', '216'])
	})

	it('hides trapezoid controls on a windward/leeward', () => {
		render(PlanView, { initial: { ...spec, type: 'LA' } })
		expect(screen.queryByLabelText('Interior angle')).toBeNull()
		expect(screen.getByLabelText('Offset mark 1a (m)')).toBeTruthy()
		expect(screen.getByTestId('lay-1a')).toBeTruthy()
	})
})

describe('AngleCalculator', () => {
	const reading = (label: string) =>
		Array.from(document.querySelectorAll('.readings tr'))
			.find((tr) => tr.querySelector('td')?.textContent === label)
			?.querySelectorAll('td')[1].textContent

	it('reads the 70 degree pointers for an axis', () => {
		render(AngleCalculator, { axis: 140, angle: 70 })
		expect(reading('Course axis')).toBe('140')
		expect(reading('2-1, 3-4')).toBe('210') // workbook Module 7 exercise 4
		expect(reading('Gate, Pin-CB')).toBe('230')
		expect(reading('Reciprocal')).toBe('320')
		expect(reading('1-2, 4-3')).toBe('030')
	})

	it('follows the dial as it turns', async () => {
		render(AngleCalculator, { axis: 355, angle: 80 })
		await fireEvent.click(screen.getByLabelText('Axis plus 5 degrees'))
		expect(reading('Course axis')).toBe('000')
		expect(reading('3-Finish')).toBe('100') // 80 degree reference chart
	})

	it('prints the pin-end adjustment table from the paper calculator', () => {
		render(AngleCalculator, { axis: 0, angle: 70 })
		const row = Array.from(document.querySelectorAll('tr')).find((tr) => tr.textContent?.startsWith('350 m'))
		expect(Array.from(row!.querySelectorAll('td')).map((td) => td.textContent)).toEqual(['350 m', '31', '62', '94', '127'])
	})
})
