# Drop Drop Drop

Course planning and mark laying tools for sailing race teams. An installable,
offline-first web app with two modes over one shared course:

- **Plan** for the race officer: course type, axis, lengths and angles.
- **Lay** for each mark boat: bearing and distance from the reference point to
  their mark, and the reciprocal their GPS should read.

Distances are shown in nautical miles first with metres alongside.

## Status

Working so far:

- **Plan**: pick a course (L, LA, LR, LRA, I, O, IX, OX) and number of beats,
  set axis and dimensions, see the course drawn to scale, its rounding order
  and length, and every mark as a bearing and distance from the reference
  point with the reciprocal a GPS reads. Enter the reference position to get
  each mark's latitude and longitude.
- **Angle calculator**: the on-screen version of the laminated course angle
  calculator, with its reference tables. Open it directly with `#t=calc`.
- **Share course**: the whole course travels in the link.

Not built yet: Lay mode for mark boats, wind log, course change tool,
checklists, magnetic variation.

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
  - `library.ts`: course types, rounding orders, lengths, the lay table
  - `course.ts`: standalone trapezoid and windward/leeward helpers, line and tide sums
  - `position.ts`: latitude and longitude, parsing and validation
  - `sizing.ts`: start line and gate sizing, laying tolerances
  - `calculator.ts`: course angle calculator pointers
  - `units.ts`: nautical miles and metres
- `src/lib/share.ts` encodes a course into a link and validates it on the way in.
- `src/lib/ui/` holds the Svelte components.

## Tests

`npm test` runs everything. Each feature lands with tests:

- The engine is checked against the K2 Training Marklaying workbook exercises
  (Modules 6, 7 and 9), the 60, 70 and 80 degree trapezoid reference charts,
  the Europe Nationals 2022 sailing instructions (rounding orders), and the
  tables on Paul Kimmens' course angle calculator.
- Components are rendered in jsdom and checked for the values a mark layer
  would read.

## Assumptions to confirm

- Mark 5 (IX, OX) defaults to 150 m downwind of the start line centre, with
  the finish line running astern of the committee boat.
- The reaching finish on LR and LRA runs off the committee boat's starboard side.

## Conventions

Tabs for indentation (see `.editorconfig`).
