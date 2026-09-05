import { Vector2 } from "../vector.js";

export const WHITE = Object.freeze({ r: 255, g: 255, b: 255 });

export const getForeground = (framebuffer) => {
  if (!framebuffer?.foreground) {
    throw new Error("Body part rendering requires a framebuffer with a foreground layer");
  }
  return framebuffer.foreground;
};

export const asVector = (value) => (value instanceof Vector2 ? value : new Vector2(value.x, value.y));

export const fromAngle = (angle, magnitude = 1) => Vector2.fromAngle(angle).multiplySelf(magnitude);

export const normalizeColor = (color = WHITE) => ({
  r: color.r ?? 255,
  g: color.g ?? 255,
  b: color.b ?? 255,
});

export const swappedColor = (color = WHITE) => ({
  r: color.b ?? 255,
  g: color.g ?? 255,
  b: color.r ?? 255,
});

export const offsetPosition = (position, xOffset = 0, yOffset = 0) => asVector(position).add(new Vector2(xOffset, yOffset));
