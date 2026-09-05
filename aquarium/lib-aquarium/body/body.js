import { Vector2 } from "../vector.js";
import { getForeground } from "./utils.js";

const cloneVector = (value) => (value instanceof Vector2 ? value.clone() : new Vector2(value?.x ?? 0, value?.y ?? 0));

export class Body {
  constructor({ type = "Body", head = null, tail = null, fin = null, colorPalette = null } = {}) {
    this.type = type;
    this.pos = new Vector2();
    this.vel = new Vector2();
    this.angle = 0;
    this.size = 0.8;
    this.health = 1;
    this.gapBetweenSegments = 1;
    this.head = head;
    this.tail = tail;
    this.fin = fin;
    this.colorPalette = colorPalette;
    this.segments = [];
    this.segmentPositions = [];
  }

  update({ position, pos = position, velocity, vel = velocity, angle = 0, age = 0.8, health = 1 } = {}) {
    this.pos = cloneVector(pos);
    this.vel = cloneVector(vel);
    this.angle = angle;
    this.size = age;
    this.health = health;

    if (this.colorPalette) {
      this.colorPalette.adjustColorByAgeAndHealth(age, health);
    }

    return this;
  }

  displayEgg({ framebuffer }) {
    const foreground = getForeground(framebuffer);
    const color = this.colorPalette?.colors?.[0] ?? { r: 0, g: 0, b: 200 };
    foreground.drawPixel(this.pos.x, this.pos.y, color);
  }

  getHeadType() {
    return this.head?.type ?? "";
  }

  getTailType() {
    return this.tail?.type ?? "";
  }

  getFinType() {
    return this.fin?.type ?? "";
  }

  getColorPaletteHSV() {
    return this.colorPalette?.getColorsHSV?.() ?? [];
  }

  setColorPaletteHSV(colorsHSV = []) {
    this.colorPalette?.setColors?.(colorsHSV);
    return this;
  }

  getDebugSnapshot() {
    return {
      type: this.type,
      headType: this.getHeadType(),
      tailType: this.getTailType(),
      finType: this.getFinType(),
      age: this.size,
      health: this.health,
      segments: this.segments.slice(),
      colorPalette: this.colorPalette?.getDebugSnapshot?.() ?? null,
    };
  }
}

export default Body;
