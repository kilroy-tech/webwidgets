import { MOTION_PROFILES, MOTION_TYPES } from "../constants.js";
import { Motion } from "./base-motion.js";

export class SnakeMotion extends Motion {
  constructor(position, xResolution, yResolution, options = {}) {
    super(position, xResolution, yResolution, {
      ...options,
      type: MOTION_TYPES.SNAKE,
      profile: MOTION_PROFILES[MOTION_TYPES.SNAKE],
    });
  }

  doMotion(now) {
    this.sideSineMotion(now);
    this.noiseMotion();
  }
}

export default SnakeMotion;
