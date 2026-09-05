import { AQUARIUM, MOTION_TYPES } from "../constants.js";
import { createSeededRandom } from "../random.js";
import { Vector2 } from "../vector.js";
import { FishMotion } from "./fish-motion.js";
import { OctopusMotion } from "./octopus-motion.js";
import { SnakeMotion } from "./snake-motion.js";
import { StarMotion } from "./star-motion.js";
import { TurtleMotion } from "./turtle-motion.js";

export const MOTION_TYPE_CONSTRUCTORS = Object.freeze({
  [MOTION_TYPES.FISH]: FishMotion,
  [MOTION_TYPES.TURTLE]: TurtleMotion,
  [MOTION_TYPES.STAR]: StarMotion,
  [MOTION_TYPES.SNAKE]: SnakeMotion,
  [MOTION_TYPES.OCTOPUS]: OctopusMotion,
});

export const createMotion = (type, positionOrOptions = new Vector2(), xResolution, yResolution, options = {}) => {
  let position = positionOrOptions;
  let nextOptions = options;
  let nextXResolution = xResolution;
  let nextYResolution = yResolution;

  if (positionOrOptions && typeof positionOrOptions === "object" && "position" in positionOrOptions) {
    position = positionOrOptions.position;
    nextXResolution = positionOrOptions.xResolution;
    nextYResolution = positionOrOptions.yResolution;
    nextOptions = positionOrOptions;
  }

  const MotionType = MOTION_TYPE_CONSTRUCTORS[type];
  if (!MotionType) {
    throw new Error(`Unknown aquarium motion type: ${type}`);
  }

  return new MotionType(position, nextXResolution, nextYResolution, {
    rng: nextOptions.rng ?? createSeededRandom(),
  });
};

export const createMotionFromLogicalPanel = (
  type,
  { position = new Vector2(), width = 0, height = 0, physicsScale = AQUARIUM.PHYSICS_SCALE, rng = createSeededRandom() } = {},
) => {
  const logicalPosition = position instanceof Vector2 ? position : new Vector2(position.x ?? 0, position.y ?? 0);
  return createMotion(type, logicalPosition.multiply(physicsScale), width * physicsScale, height * physicsScale, {
    rng,
  });
};

export default createMotion;
