import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SPEC, type CourseSpec } from '../geo'
import TideHarness from './TideHarness.test.svelte'

afterEach(cleanup)

const spec: CourseSpec = { ...DEFAULT_SPEC, axis: 0 }
const text = (id: string) => screen.getByTestId(id).textContent?.replace(/\s+/g, ' ').trim()

describe('TideView', () => {
	it('turns a timed tide stick drift into the current rate', async () => {
		render(TideHarness, { initial: spec })
		await fireEvent.input(screen.getByLabelText('Drift (m)'), { target: { value: '20' } })
		await fireEvent.input(screen.getByLabelText('Time (s)'), { target: { value: '30' } })
		expect(text('stick')).toBe('1.3 knots')
		await fireEvent.click(screen.getByText("Use as the current's rate"))
		expect(text('tide')).toBe('0 1.3')
	})

	it('steps the set through north and the rate by tenths, never below zero', async () => {
		render(TideHarness, { initial: spec })
		await fireEvent.click(screen.getByLabelText('Set minus 5 degrees'))
		await fireEvent.click(screen.getByLabelText('Rate plus 0.1 knots'))
		await fireEvent.click(screen.getByLabelText('Rate plus 0.1 knots'))
		expect(text('tide')).toBe('355 0.2')
		for (let i = 0; i < 4; i++) await fireEvent.click(screen.getByLabelText('Rate minus 0.1 knots'))
		expect(text('tide')).toBe('355 0')
	})

	it('describes a cross tide on the course and the sailing wind it makes', () => {
		// Northerly 10 kn with 2 kn flowing east: the sailing wind veers to 011.
		render(TideHarness, { initial: spec, current: { set: 90, rate: 2 } })
		expect(text('along')).toBe('No current along the beat')
		expect(text('across')).toBe('2.0 kn across, to the right looking upwind')
		expect(text('sailing')).toBe('011 at 10.2 kn')
		expect(text('gates')).toBe('Gates and start line square to it: 101 / 281')
		expect(text('drift')).toContain('309 m in five minutes')
	})

	it('offers to move the axis to the sailing wind', async () => {
		render(TideHarness, { initial: spec, current: { set: 90, rate: 2 } })
		await fireEvent.click(screen.getByText('Set axis to 010'))
		expect(text('axis')).toBe('10')
		expect(screen.queryByText(/^Set axis to/)).toBeNull()
	})

	it('uses the wind log when there are readings', () => {
		const wind = [230, 240].map((direction, i) => ({ time: i, direction, speed: 12 }))
		render(TideHarness, { initial: { ...spec, axis: 235 }, wind, current: { set: 235, rate: 1.5 } })
		expect(text('ground')).toBe('Ground wind from the log: 235 at 12 kn')
		// Water flowing up the beat, into the wind: wind against tide.
		expect(text('along')).toBe('1.5 kn up the beat')
		expect(text('sailing')).toBe('235 at 13.5 kn')
		expect(screen.queryByLabelText('Ground wind from')).toBeNull()
	})

	it('asks for the current before describing it', () => {
		render(TideHarness, { initial: spec })
		expect(screen.getByText('Enter the current to see what it does to the course.')).toBeTruthy()
		expect(text('sailing')).toBe('000 at 10.0 kn')
	})
})
