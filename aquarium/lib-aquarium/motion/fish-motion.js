import { MOTION_PROFILES, MOTION_TYPES } from "../constants.js";
import { Motion } from "./base-motion.js";

export class FishMotion extends Motion {
  constructor(position, xResolution, yResolution, options = {}) {
    super(position, xResolution, yResolution, {
      ...options,
      type: MOTION_TYPES.FISH,
      profile: MOTION_PROFILES[MOTION_TYPES.FISH],
    });
  }

  doMotion(now) {
    this.sideSineMotion(now);
    this.noiseMotion();
  }
}

export default FishMotion;
