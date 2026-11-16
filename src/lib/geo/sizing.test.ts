import { describe, expect, it } from 'vitest'
import { BOAT_CLASSES, gateWidth, gateWidthOk, startLineLength, startLineOk } from './index'

describe('sizing', () => {
	it('sizes a start line from fleet and boat length', () => {
		const ilca = BOAT_CLASSES.find((c) => c.name === 'ILCA')!
		expect(startLineLength(42, ilca.length, ilca.lineFactor)).toBeCloseTo(266.5, 1)
	})

	it('uses a longer line factor for skiffs', () => {
		expect(BOAT_CLASSES.find((c) => c.name === '49er')!.lineFactor).toBe(2)
	})

	it('sizes a gate at ten boat lengths and never under seven', () => {
		expect(gateWidth(4.23)).toBeCloseTo(42.3)
		expect(gateWidth(4.23, 5)).toBeCloseTo(29.61)
	})

	it('applies the workbook tolerances', () => {
		expect(gateWidthOk(38, 40)).toBe(true)
		expect(gateWidthOk(37.9, 40)).toBe(false)
		expect(gateWidthOk(46, 40)).toBe(true)
		expect(gateWidthOk(46.1, 40)).toBe(false)
		expect(startLineOk(275, 250)).toBe(true)
		expect(startLineOk(276, 250)).toBe(false)
		expect(startLineOk(237, 250)).toBe(false)
	})
})
