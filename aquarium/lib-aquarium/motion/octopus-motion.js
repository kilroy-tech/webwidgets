import { MOTION_PROFILES, MOTION_TYPES } from "../constants.js";
import { Motion } from "./base-motion.js";

export class OctopusMotion extends Motion {
  constructor(position, xResolution, yResolution, options = {}) {
    super(position, xResolution, yResolution, {
      ...options,
      type: MOTION_TYPES.OCTOPUS,
      profile: MOTION_PROFILES[MOTION_TYPES.OCTOPUS],
    });
  }

  doMotion(now) {
    this.frontSineMotion(now);
  }
}

export default OctopusMotion;
