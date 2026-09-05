import { MOTION_PROFILES, MOTION_TYPES } from "../constants.js";
import { Motion } from "./base-motion.js";

export class TurtleMotion extends Motion {
  constructor(position, xResolution, yResolution, options = {}) {
    super(position, xResolution, yResolution, {
      ...options,
      type: MOTION_TYPES.TURTLE,
      profile: MOTION_PROFILES[MOTION_TYPES.TURTLE],
    });
  }

  doMotion(now) {
    this.frontSineMotion(now);
    this.noiseMotion();
  }
}

export default TurtleMotion;
