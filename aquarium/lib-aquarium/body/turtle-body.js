import { BODY_TYPES, TURTLE_BODY } from "../constants.js";
import { createSeededRandom } from "../random.js";
import { Body } from "./body.js";
import { ColorPalette } from "./color-palette.js";
import { getForeground } from "./utils.js";

export class TurtleBody extends Body {
  constructor({ rng = createSeededRandom(), head = null, tail = null, fin = null } = {}) {
    const length = rng.int(TURTLE_BODY.LENGTH.min, TURTLE_BODY.LENGTH.maxExclusive);
    const rad = rng.int(TURTLE_BODY.WIDTH.min, TURTLE_BODY.WIDTH.maxExclusive);
    super({
      type: BODY_TYPES.TURTLE,
      head,
      tail,
      fin,
      colorPalette: new ColorPalette(rad, { rng }),
    });
    this.length = length;
    this.rad = rad;
  }

  display({ framebuffer }) {
    const foreground = getForeground(framebuffer);
    const radToDraw = Math.max(1, this.rad * this.size);
    const lengthToDraw = Math.max(1, this.length * (1 + this.vel.mag() / 20) * this.size);
    foreground.drawCircleArray(
      this.pos.x,
      this.pos.y,
      radToDraw,
      lengthToDraw,
      this.angle + Math.PI / 2,
      this.colorPalette.colors[0],
    );
  }

  getDebugSnapshot() {
    return {
      ...super.getDebugSnapshot(),
      length: this.length,
      rad: this.rad,
    };
  }
}

export default TurtleBody;
