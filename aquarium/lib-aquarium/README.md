# Aquarium engine modules

This directory is the target home for the browser port of the original OpenMatrix Aquarium C++ code.

The current `ui/src/components/MatrixAquarium.svelte` component is only a prototype. Final simulator behavior should move into these modules so each browser class can be checked against the original source map.

Primary module targets:

- `constants.js`: original aquarium constants plus explicit `64x64-original`, `64x85-device`, `80x106-device`, and `96x128-device` preview modes.
- `vector.js`: JavaScript equivalent of `lib/Matrix/PVector.h`.
- `random.js`: Arduino-like random helpers and range semantics.
- `framebuffer.js`: background and foreground logical pixel layers.
- `renderer.js`: dot/square canvas presentation for logical panel pixels.
- `water.js`: port of `lib/Aquarium/Water.h`.
- `fastled-noise.js`: browser port of the FastLED/GFX_Lite `inoise8` path used by water shimmer.
- `plants.js`: port of `lib/Aquarium/Plants.h`.
- `food.js`: port of `lib/Aquarium/Food.h`.
- `boid.js`: port of `lib/EffectManager/Boid.*`.
- `boid-manager.js`: port of `lib/Aquarium/BoidManager.*`.
- `fish.js`: port of `lib/Aquarium/Fish.h`.
- `state.js`: browser equivalent of `AquariumStateManager`.
- `engine.js`: browser equivalent of `Aquarium`.

Reference documents:

- `docs/aquarium-source-map.md`
- `docs/aquarium-constants-map.md`
- `docs/aquarium-update-order.md`
- `docs/aquarium-simulator-creation-plan.md`

Runtime rule:

The engine should keep `update`, `compositeLayers`, and canvas presentation as separate steps, matching the original `aquarium.update`, `aquarium.display`, and `matrix.update` flow.
