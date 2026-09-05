# Aquarium body modules

This directory contains the JavaScript ports of the original body rendering classes.

Implemented source mapping:

- `Head.h`, `TriangleHead.h`, `FrogHead.h`, `NeedleHead.h` -> `head.js`
- `Tail.h`, `TriangleTail.h`, `CurvyTail.h`, `WavyTail.h` -> `tail.js`
- `Fin.h`, `TriangleFin.h`, `EllipseFin.h`, `LegFin.h`, `RoundFin.h` -> `fin.js`
- `Body.h` -> `body.js`
- `ColorPalette.h` -> `color-palette.js`
- `FishBody.h` -> `fish-body.js`
- `TurtleBody.h` -> `turtle-body.js`
- `StarBody.h` -> `star-body.js`
- `SnakeBody.h` -> `snake-body.js`
- `OctopusBody.h` -> `octopus-body.js`
- `BodyFactory.h` -> `body-factory.js`

The factory supports both random creation and exact restoration from saved state strings.

Known intentional differences are recorded in `constants.js` under `SOURCE_ODDITIES`.
