# Aquarium motion modules

This directory contains the JavaScript ports of the original motion classes.

Implemented source mapping:

- `Motion.h` -> `base-motion.js`
- `FishMotion.h` -> `fish-motion.js`
- `TurtleMotion.h` -> `turtle-motion.js`
- `StarMotion.h` -> `star-motion.js`
- `SnakeMotion.h` -> `snake-motion.js`
- `OctopusMotion.h` -> `octopus-motion.js`
- `MotionFactory.h` -> `motion-factory.js`

The motion contract mirrors the original C++: position, velocity, and resolution are in `PHYSICS_SCALE` units. Future `fish.js` divides `motion.getPosition()` by `PHYSICS_SCALE` before passing logical panel coordinates to body rendering.

Food following preserves the original timing nuance: `Fish::update()` assigns the food target after `motion.update()`, so steering toward food affects the next frame.
