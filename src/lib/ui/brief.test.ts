import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SPEC, type CourseSpec } from '../geo'
import BriefView from './BriefView.svelte'
import ChangeHarness from './ChangeHarness.test.svelte'

afterEach(cleanup)

const spec: CourseSpec = { ...DEFAULT_SPEC, type: 'IX', beats: 2, axis: 235, beat: 900, angle: 70, startLine: 270, gateWidth: 42 }
const text = (id: string) => screen.getByTestId(id).textContent?.replace(/\s+/g, ' ').trim()

describe('ChangeView', () => {
	it('starts with no change', () => {
		render(ChangeHarness, { initial: spec })
		expect(text('current')).toBe('Now 235 · 900 m (0.49 NM) · magnetic')
		expect(text('signal')).toBe('No change')
	})

	it('shows the Charlie board and the move for a starboard shift', async () => {
		render(ChangeHarness, { initial: spec })
		for (let i = 0; i < 3; i++) await fireEvent.click(screen.getByLabelText('Bearing plus 5 degrees'))
		expect(text('signal')).toBe('Flag C with repetitive sounds: 250, 15° to starboard')
		expect(screen.getByRole('img', { name: 'green triangle' })).toBeTruthy()
		// Chord of 15 degrees at 900 m is 235 m; the new mark is at 250 from the reference.
		expect(text('move')).toContain('235 m')
		expect(text('move')).toContain('New position from the reference: 250 · 900 m (0.49 NM), GPS reads 070')
	})

	it('shows a red rectangle and a minus for a shorter leg to port', async () => {
		render(ChangeHarness, { initial: spec })
		await fireEvent.click(screen.getByLabelText('Bearing minus 5 degrees'))
		await fireEvent.change(screen.getByLabelText('New length (m)'), { target: { value: '720' } })
		expect(text('signal')).toBe('Flag C with repetitive sounds: 230, 5° to port, 20% shorter')
		expect(screen.getByRole('img', { name: 'red rectangle' })).toBeTruthy()
		expect(text('board')).toContain('−')
	})

	it('needs no signal inside the limit the sailing instructions allow', async () => {
		render(ChangeHarness, { initial: spec })
		await fireEvent.input(screen.getByLabelText(/without a signal/), { target: { value: '100' } })
		await fireEvent.change(screen.getByLabelText('New length (m)'), { target: { value: '980' } })
		expect(text('signal')).toBe('No signal needed: the move is within 100 m')
	})

	it('re-points the whole course when the beat changes', async () => {
		render(ChangeHarness, { initial: spec })
		await fireEvent.click(screen.getByLabelText('Bearing plus 5 degrees'))
		await fireEvent.change(screen.getByLabelText('New length (m)'), { target: { value: '1000' } })
		await fireEvent.click(screen.getByText('Re-point the whole course to this'))
		expect(text('axis')).toBe('240')
		expect(text('beat')).toBe('1000')
		expect(text('signal')).toBe('No change')
	})

	it('changes the reach leg from mark 1 to mark 2', async () => {
		render(ChangeHarness, { initial: spec })
		await fireEvent.change(screen.getByLabelText('Mark to move'), { target: { value: '2' } })
		await fireEvent.change(screen.getByLabelText('Leg starts at'), { target: { value: '1' } })
		expect(text('current')).toBe('Now 125 · 600 m (0.32 NM) · magnetic')
		expect(screen.queryByText('Re-point the whole course to this')).toBeNull()
	})
})

describe('BriefView', () => {
	it('shows who lays what with bearings from the reference', () => {
		render(BriefView, { spec })
		expect(text('job-Marks 1')).toContain('1 235 · 0.49 NM (900 m) · GPS reads 055')
		expect(text('job-Marks 3')).toContain('5')
		expect(text('job-Marks 4')).toContain('Finish pin')
	})

	it('counts the load and allows for a pin-end boat', async () => {
		render(BriefView, { spec })
		expect(text('kit')).toBe('10 buoys, each with anchor and warp')
		await fireEvent.click(screen.getByLabelText('A pin-end boat replaces the start pin buoy'))
		expect(text('kit')).toBe('9 buoys, each with anchor and warp')
	})

	it('fills in what the course knows and tracks ticks and notes', async () => {
		render(BriefView, { spec })
		expect(screen.getByText('IX2, axis 235: Start – 1 – 4s/4p – 1 – 2 – 3p – 5 – Finish')).toBeTruthy()
		expect(screen.getByText('0.023 NM (42 m)')).toBeTruthy()
		expect(text('progress')).toBe('0 of 24')

		await fireEvent.click(screen.getByLabelText('Agree VHF channels'))
		await fireEvent.change(screen.getByLabelText('Notes: Agree VHF channels'), { target: { value: 'Ch 72' } })
		expect(text('progress')).toBe('1 of 24')
		expect((screen.getByLabelText('Notes: Agree VHF channels') as HTMLInputElement).value).toBe('Ch 72')

		await fireEvent.click(screen.getByText('Clear ticks and notes'))
		expect(text('progress')).toBe('0 of 24')
	})
})
