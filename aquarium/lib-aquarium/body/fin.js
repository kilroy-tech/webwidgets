import { fromAngle, getForeground, normalizeColor, swappedColor, asVector } from "./utils.js";

export class Fin {
  constructor({ type = "Fin" } = {}) {
    this.type = type;
  }

  display() {}
}

export class TriangleFin extends Fin {
  constructor() {
    super({ type: "TriangleFin" });
  }

  display({ framebuffer, position, angle, size, color }) {
    const foreground = getForeground(framebuffer);
    const pos = asVector(position);
    const drawColor = normalizeColor(color);
    const heading = fromAngle(angle);
    const pt1 = heading.clone().setMag(size).addSelf(pos);
    const pt2 = heading.clone().setMag(-size / 2).addSelf(pos);
    heading.multiplySelf(3);

    let pt3 = fromAngle(angle + Math.PI / 2).setMag(size * 2).subtractSelf(heading).addSelf(pos);
    foreground.fillTriangle(pt1, pt2, pt3, drawColor);

    pt3 = fromAngle(angle + Math.PI / 2).setMag(-size * 2).subtractSelf(heading).addSelf(pos);
    foreground.fillTriangle(pt1, pt2, pt3, drawColor);
  }
}

export class EllipseFin extends Fin {
  constructor() {
    super({ type: "EllipseFin" });
  }

  display({ framebuffer, position, angle, size, color }) {
    const foreground = getForeground(framebuffer);
    const pos = asVector(position);
    foreground.drawCircleArray(pos.x, pos.y, size * 3, size / 3, angle, normalizeColor(color));
  }
}

export class LegFin extends Fin {
  constructor() {
    super({ type: "LegFin" });
  }

  display({ framebuffer, position, angle, size, color }) {
    const foreground = getForeground(framebuffer);
    const pos = asVector(position);
    const drawColor = normalizeColor(color);
    let pt = fromAngle(angle + Math.PI / 2).setMag(size * 2).addSelf(pos);
    foreground.drawLine(pt.x, pt.y, pos.x, pos.y, drawColor);
    pt = fromAngle(angle + Math.PI / 2).setMag(-size * 2).addSelf(pos);
    foreground.drawLine(pt.x, pt.y, pos.x, pos.y, drawColor);
  }
}

export class RoundFin extends Fin {
  constructor() {
    super({ type: "RoundFin" });
  }

  display({ framebuffer, position, angle, size, color }) {
    const foreground = getForeground(framebuffer);
    const pos = asVector(position);
    const drawColor = normalizeColor(color);
    const roundColor = swappedColor(drawColor);
    let pt = fromAngle(angle + Math.PI / 2).setMag(size * 2).addSelf(pos);
    foreground.drawLine(pt.x, pt.y, pos.x, pos.y, drawColor);
    foreground.fillCircle(pt.x, pt.y, size / 3, roundColor);
    pt = fromAngle(angle + Math.PI / 2).setMag(-size * 2).addSelf(pos);
    foreground.drawLine(pt.x, pt.y, pos.x, pos.y, drawColor);
    foreground.fillCircle(pt.x, pt.y, size / 3, roundColor);
  }
}

export const FIN_TYPES = Object.freeze({
  TriangleFin,
  EllipseFin,
  LegFin,
  RoundFin,
});

export const createFin = (type, options = {}) => {
  const FinType = FIN_TYPES[type];
  if (!FinType) {
    throw new Error(`Unknown aquarium fin type: ${type}`);
  }
  return new FinType(options);
};

export default Fin;
