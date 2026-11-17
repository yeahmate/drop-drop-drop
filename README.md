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
- **Lay**: one mark at a time in large type: bearing and distance from the
  reference (or from another mark), what the GPS should read, and how far
  upwind to drop the anchor. With the reference position set, the phone's
  GPS gives distance to run and metres off the line, and a ping records
  where each mark was actually laid.
- **Line**: square start line bearings, bias and pin move, where a pin-end
  boat anchors, and a tolerance check on the laid length.
- **Wind**: log readings with large buttons; mean, range, skew from the axis
  with shift advice, and the VHF wording for the report.
- **Change**: move the mark at the end of a leg. Gives the Charlie board
  display (bearing, green triangle or red rectangle, plus or minus), the
  mark boat's move, and whether the sailing instructions need a signal.
- **Brief**: who lays what with bearings, a load list, and the mark layer
  briefing checklist with the course's own answers filled in.
- **Share course**: the whole course travels in the link.

The course, reference point, wind log, laid marks and checklist are saved on
the device. Add `#t=lay`, `#t=line`, `#t=wind`, `#t=change`, `#t=brief` or
`#t=calc` to open a tool directly.

Not built yet: magnetic variation, tide tools, class speed data for leg
times, a map layer, live sync between boats.

## Develop

```sh
npm install
npm run dev      # local dev server
npm test         # geometry engine tests
npm run check    # type check
npm run build    # production build with service worker
```

## Deploy

Scripts for a Rocky Linux server (install, hardening, and `dddctl` for
start, stop, logs, update and rollback) are in [`deploy/`](deploy/README.md).

## Layout

- `src/lib/geo/` is the geometry engine. It has no UI dependencies.
  - `bearing.ts`: bearings, reciprocals, flat-plane vectors
  - `library.ts`: course types, rounding orders, lengths, the lay table
  - `course.ts`: standalone trapezoid and windward/leeward helpers, line and tide sums
  - `position.ts`: latitude and longitude, parsing and validation
  - `sizing.ts`: start line and gate sizing, laying tolerances
  - `calculator.ts`: course angle calculator pointers
  - `units.ts`: nautical miles and metres
  - `guidance.ts`, `startline.ts`, `wind.ts`: live guidance, start line and wind log sums
  - `change.ts`, `crew.ts`: course changes, mark boat assignments, equipment
- `src/lib/share.ts` encodes a course into a link and validates it on the way in.
- `src/lib/store.ts` saves state on the device; `src/lib/gps.ts` wraps the phone's GPS.
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
