# Drop Drop Drop

Course planning and mark laying tools for sailing race teams. An installable,
offline-first web app with two modes over one shared course:

- **Plan** for the race officer: course type, axis, lengths and angles.
- **Lay** for each mark boat: bearing and distance from the reference point to
  their mark, and the reciprocal their GPS should read.

Distances are shown in nautical miles first with metres alongside.

## Status

Phase 1 of the plan: the geometry engine, its tests, and a minimal page that
lists reference-point bearings and course angle calculator readings for a
trapezoid.

## Develop

```sh
npm install
npm run dev      # local dev server
npm test         # geometry engine tests
npm run check    # type check
npm run build    # production build with service worker
```

## Layout

- `src/lib/geo/` is the geometry engine. It has no UI dependencies.
  - `bearing.ts`: bearings, reciprocals, flat-plane vectors
  - `course.ts`: trapezoid and windward/leeward mark positions, line and tide helpers
  - `calculator.ts`: course angle calculator pointers
  - `units.ts`: nautical miles and metres
- `src/App.svelte` is the placeholder page.

## Tests

The engine is tested against the K2 Training Marklaying workbook exercises
(Modules 7 and 9), the trapezoid reference charts, and the pin-end adjustment
table on Paul Kimmens' course angle calculator.

## Conventions

Tabs for indentation (see `.editorconfig`).
