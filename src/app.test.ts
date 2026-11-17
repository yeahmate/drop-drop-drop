import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App.svelte'
import { DEFAULT_SPEC } from './lib/geo'
import { encodeCourse } from './lib/share'

beforeEach(() => {
	localStorage.clear()
	history.replaceState(null, '', '/')
})
afterEach(cleanup)

const text = (id: string) => screen.getByTestId(id).textContent?.replace(/\s+/g, ' ').trim()

describe('App', () => {
	it('opens on Plan and every tool renders', async () => {
		render(App)
		expect(screen.getByTestId('rounding-order')).toBeTruthy()
		for (const [tab, marker] of [
			['Lay', 'Your GPS reads'], ['Line', 'Pin-end boat'], ['Wind', 'New reading'], ['Tide', 'Tide stick'],
			['Change', 'Charlie board'], ['Brief', 'Briefing checklist'], ['Angles', 'Tide stick'], ['Plan', 'Size from the fleet'],
		]) {
			await fireEvent.click(screen.getByRole('button', { name: tab }))
			expect(screen.getAllByText(new RegExp(marker)).length).toBeGreaterThan(0)
		}
	})

	it('opens a shared link on Lay with that course', () => {
		history.replaceState(null, '', `/#c=${encodeCourse({ ...DEFAULT_SPEC, type: 'OX', beats: 3, axis: 75 })}`)
		render(App)
		expect(screen.getByText(/OX3 axis 075°M/)).toBeTruthy()
		expect(text('bearing')).toBe('075')
	})

	it('remembers the course and reference across a reload', async () => {
		const first = render(App)
		await fireEvent.click(screen.getByLabelText('Axis plus 5 degrees'))
		await fireEvent.input(screen.getByLabelText('Reference latitude'), { target: { value: "N 50° 35.212'" } })
		first.unmount()
		render(App)
		expect(screen.getByText(/axis 240°M/)).toBeTruthy()
		expect((screen.getByLabelText('Reference latitude') as HTMLInputElement).value).toBe("N 50° 35.212'")
	})

	it('says what magnetic means until a reference is set, then shows the variation', async () => {
		render(App)
		expect(text('variation')).toContain('Set the reference position')
		await fireEvent.input(screen.getByLabelText('Reference latitude'), { target: { value: "N 50° 35.212'" } })
		await fireEvent.input(screen.getByLabelText('Reference longitude'), { target: { value: "W 002° 26.874'" } })
		expect(text('variation')).toMatch(/^Variation at the reference: \d\.\d°[EW]?$/)
	})

	it('switches to true by relabelling and shifting the axis by the variation', async () => {
		// Near Vancouver the variation is large and easterly, so the shift shows.
		render(App)
		await fireEvent.input(screen.getByLabelText('Reference latitude'), { target: { value: "N 49° 17.000'" } })
		await fireEvent.input(screen.getByLabelText('Reference longitude'), { target: { value: "W 123° 07.000'" } })
		const shown = Number(/(\d+\.\d)°E/.exec(text('variation')!)![1])
		expect(shown).toBeGreaterThan(10)
		await fireEvent.change(screen.getByLabelText('Bearings'), { target: { value: 'true' } })
		const axis = Number(/axis (\d{3})°T/.exec(document.body.textContent!)![1])
		// The banner rounds to a tenth, so allow a degree either way.
		expect(Math.abs(axis - (235 + shown))).toBeLessThanOrEqual(1)
	})
})
