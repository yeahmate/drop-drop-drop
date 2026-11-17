// The package ships its own types but not as a default export.
declare module 'geomagnetism' {
	interface Point {
		decl: number
	}
	interface Model {
		point(position: [lat: number, lon: number]): Point
	}
	const geomagnetism: { model(date?: Date): Model }
	export default geomagnetism
}
