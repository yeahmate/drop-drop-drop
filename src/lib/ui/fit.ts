import type { Vec } from '../geo'

export interface Fit {
	/** Pixels per metre. */
	scale: number
	x: (v: Vec) => number
	y: (v: Vec) => number
}

/** Fit points into a width x height box, north up, with padding on all sides. */
export function fitPoints(points: Vec[], width: number, height: number, pad: number): Fit {
	const es = points.map((p) => p.e)
	const ns = points.map((p) => p.n)
	const minE = Math.min(...es)
	const maxE = Math.max(...es)
	const minN = Math.min(...ns)
	const maxN = Math.max(...ns)
	const spanE = Math.max(maxE - minE, 1)
	const spanN = Math.max(maxN - minN, 1)
	const scale = Math.min((width - 2 * pad) / spanE, (height - 2 * pad) / spanN)
	const left = (width - spanE * scale) / 2
	const upper = (height - spanN * scale) / 2
	return {
		scale,
		x: (v) => left + (v.e - minE) * scale,
		y: (v) => upper + (maxN - v.n) * scale,
	}
}

/** A round scale-bar length in metres that is at most `maxPixels` wide. */
export function scaleBar(scale: number, maxPixels: number): number {
	const steps = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000]
	const fitting = steps.filter((m) => m * scale <= maxPixels)
	return fitting.length ? fitting[fitting.length - 1] : steps[0]
}

export interface MarkLabel {
	text: string
	position: Vec
}

/** One label per single mark and one per gate ("4s/4p" at the gate centre). */
export function markLabels(marks: Record<string, Vec>): MarkLabel[] {
	const labels: MarkLabel[] = []
	for (const [name, position] of Object.entries(marks)) {
		const gate = /^(\d+)s$/.exec(name)
		const port = gate && marks[`${gate[1]}p`]
		if (gate && port) {
			labels.push({
				text: `${gate[1]}s/${gate[1]}p`,
				position: { e: (position.e + port.e) / 2, n: (position.n + port.n) / 2 },
			})
		} else if (!(/^\d+p$/.test(name) && marks[name.replace('p', 's')])) {
			labels.push({ text: name, position })
		}
	}
	return labels
}
