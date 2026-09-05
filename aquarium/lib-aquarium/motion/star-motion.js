import { MOTION_PROFILES, MOTION_TYPES } from "../constants.js";
import { Motion } from "./base-motion.js";

export class StarMotion extends Motion {
  constructor(position, xResolution, yResolution, options = {}) {
    super(position, xResolution, yResolution, {
      ...options,
      type: MOTION_TYPES.STAR,
      profile: MOTION_PROFILES[MOTION_TYPES.STAR],
    });
  }

  doMotion(now) {
    this.frontSineMotion(now);
    this.noiseMotion();
  }
}

export default StarMotion;
