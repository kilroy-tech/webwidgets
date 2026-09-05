import { DEFAULT_PANEL_MODE_ID, PANEL_MODES } from "./constants.js";

const BYTE_MAX = 255;
const OPAQUE_ALPHA = 255;
const TRANSPARENT = 0;
const BLACK = Object.freeze({ r: 0, g: 0, b: 0, a: OPAQUE_ALPHA });

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const clampByte = (value) => Math.round(clamp(Number(value) || 0, 0, BYTE_MAX));

export const packColor = (color) => {
  const normalized = normalizeColor(color);
  return (
    ((normalized.a & BYTE_MAX) << 24) |
    ((normalized.r & BYTE_MAX) << 16) |
    ((normalized.g & BYTE_MAX) << 8) |
    (normalized.b & BYTE_MAX)
  ) >>> 0;
};

export const unpackColor = (packed) => ({
  r: (packed >>> 16) & BYTE_MAX,
  g: (packed >>> 8) & BYTE_MAX,
  b: packed & BYTE_MAX,
  a: (packed >>> 24) & BYTE_MAX,
});

export function normalizeColor(color) {
  if (typeof color === "number") {
    return unpackColor(color >>> 0);
  }

  if (Array.isArray(color)) {
    return {
      r: clampByte(color[0]),
      g: clampByte(color[1]),
      b: clampByte(color[2]),
      a: color.length > 3 ? clampByte(color[3]) : OPAQUE_ALPHA,
    };
  }

  if (color && typeof color === "object") {
    return {
      r: clampByte(color.r ?? color.red ?? 0),
      g: clampByte(color.g ?? color.green ?? 0),
      b: clampByte(color.b ?? color.blue ?? 0),
      a: color.a === undefined && color.alpha === undefined ? OPAQUE_ALPHA : clampByte(color.a ?? color.alpha),
    };
  }

  return BLACK;
}

export const blendPackedOver = (background, foreground) => {
  const foregroundAlpha = (foreground >>> 24) & BYTE_MAX;
  if (foregroundAlpha === 0) return background >>> 0;
  if (foregroundAlpha === OPAQUE_ALPHA) return foreground >>> 0;

  const backgroundAlpha = (background >>> 24) & BYTE_MAX;
  const inverseAlpha = OPAQUE_ALPHA - foregroundAlpha;
  const outputAlpha = foregroundAlpha + Math.round((backgroundAlpha * inverseAlpha) / OPAQUE_ALPHA);

  const foregroundColor = unpackColor(foreground);
  const backgroundColor = unpackColor(background);

  return packColor({
    r: (foregroundColor.r * foregroundAlpha + backgroundColor.r * inverseAlpha) / OPAQUE_ALPHA,
    g: (foregroundColor.g * foregroundAlpha + backgroundColor.g * inverseAlpha) / OPAQUE_ALPHA,
    b: (foregroundColor.b * foregroundAlpha + backgroundColor.b * inverseAlpha) / OPAQUE_ALPHA,
    a: outputAlpha,
  });
};

const roundCoord = (value) => Math.round(value);

const pointFromArgs = (x, y) => {
  if (x && typeof x === "object") {
    return { x: x.x, y: x.y };
  }
  return { x, y };
};

const edge = (a, b, x, y) => (x - a.x) * (b.y - a.y) - (y - a.y) * (b.x - a.x);

export class FramebufferLayer {
  constructor(width, height, options = {}) {
    this.width = width;
    this.height = height;
    this.name = options.name ?? "layer";
    this.transparent = options.transparent ?? false;
    this.clearColor = this.transparent ? TRANSPARENT : packColor(options.clearColor ?? BLACK);
    this.pixels = new Uint32Array(width * height);
    this.clear();
  }

  getWidth() {
    return this.width;
  }

  getHeight() {
    return this.height;
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  index(x, y) {
    return y * this.width + x;
  }

  clear(color = this.clearColor) {
    const packed = typeof color === "number" ? color >>> 0 : packColor(color);
    this.pixels.fill(packed);
    return this;
  }

  fill(color) {
    return this.clear(color);
  }

  clonePixels() {
    return new Uint32Array(this.pixels);
  }

  setPixel(x, y, color) {
    const px = roundCoord(x);
    const py = roundCoord(y);
    if (!this.inBounds(px, py)) return this;
    this.pixels[this.index(px, py)] = packColor(color);
    return this;
  }

  drawPixel(x, y, color) {
    return this.setPixel(x, y, color);
  }

  getPixelPacked(x, y) {
    const px = roundCoord(x);
    const py = roundCoord(y);
    if (!this.inBounds(px, py)) return TRANSPARENT;
    return this.pixels[this.index(px, py)] >>> 0;
  }

  getPixel(x, y) {
    return unpackColor(this.getPixelPacked(x, y));
  }

  drawLine(x0, y0, x1, y1, color) {
    let startX = roundCoord(x0);
    let startY = roundCoord(y0);
    const endX = roundCoord(x1);
    const endY = roundCoord(y1);
    const dx = Math.abs(endX - startX);
    const sx = startX < endX ? 1 : -1;
    const dy = -Math.abs(endY - startY);
    const sy = startY < endY ? 1 : -1;
    let error = dx + dy;

    for (;;) {
      this.setPixel(startX, startY, color);
      if (startX === endX && startY === endY) break;
      const doubledError = 2 * error;
      if (doubledError >= dy) {
        error += dy;
        startX += sx;
      }
      if (doubledError <= dx) {
        error += dx;
        startY += sy;
      }
    }

    return this;
  }

  fillRect(x, y, width, height, color) {
    const startX = Math.floor(x);
    const startY = Math.floor(y);
    const endX = Math.ceil(x + width);
    const endY = Math.ceil(y + height);

    for (let py = startY; py < endY; py += 1) {
      for (let px = startX; px < endX; px += 1) {
        this.setPixel(px, py, color);
      }
    }

    return this;
  }

  fillCircle(x, y, radius, color) {
    const centerX = roundCoord(x);
    const centerY = roundCoord(y);
    const r = Math.max(0, Math.ceil(radius));
    const radiusSq = radius * radius;

    for (let py = centerY - r; py <= centerY + r; py += 1) {
      for (let px = centerX - r; px <= centerX + r; px += 1) {
        const dx = px - x;
        const dy = py - y;
        if (dx * dx + dy * dy <= radiusSq) {
          this.setPixel(px, py, color);
        }
      }
    }

    return this;
  }

  fillTriangle(...args) {
    let a;
    let b;
    let c;
    let color;

    if (args.length === 4) {
      [a, b, c, color] = args;
      a = pointFromArgs(a);
      b = pointFromArgs(b);
      c = pointFromArgs(c);
    } else {
      a = { x: args[0], y: args[1] };
      b = { x: args[2], y: args[3] };
      c = { x: args[4], y: args[5] };
      color = args[6];
    }

    const minX = Math.floor(Math.min(a.x, b.x, c.x));
    const maxX = Math.ceil(Math.max(a.x, b.x, c.x));
    const minY = Math.floor(Math.min(a.y, b.y, c.y));
    const maxY = Math.ceil(Math.max(a.y, b.y, c.y));
    const area = edge(a, b, c.x, c.y);
    if (area === 0) {
      this.drawLine(a.x, a.y, b.x, b.y, color);
      this.drawLine(b.x, b.y, c.x, c.y, color);
      this.drawLine(c.x, c.y, a.x, a.y, color);
      return this;
    }

    for (let py = minY; py <= maxY; py += 1) {
      for (let px = minX; px <= maxX; px += 1) {
        const sampleX = px + 0.5;
        const sampleY = py + 0.5;
        const w0 = edge(b, c, sampleX, sampleY);
        const w1 = edge(c, a, sampleX, sampleY);
        const w2 = edge(a, b, sampleX, sampleY);
        const inside = area > 0 ? w0 >= 0 && w1 >= 0 && w2 >= 0 : w0 <= 0 && w1 <= 0 && w2 <= 0;
        if (inside) {
          this.setPixel(px, py, color);
        }
      }
    }

    return this;
  }

  drawTriangle(...args) {
    return this.fillTriangle(...args);
  }

  drawCircleArray(x, y, radius, lengthToDraw, angle, color) {
    const radiusX = Math.max(0.5, Math.abs(lengthToDraw));
    const radiusY = Math.max(0.5, Math.abs(radius));
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);
    const maxRadius = Math.ceil(Math.max(radiusX, radiusY));
    const minX = Math.floor(x - maxRadius);
    const maxX = Math.ceil(x + maxRadius);
    const minY = Math.floor(y - maxRadius);
    const maxY = Math.ceil(y + maxRadius);

    for (let py = minY; py <= maxY; py += 1) {
      for (let px = minX; px <= maxX; px += 1) {
        const dx = px + 0.5 - x;
        const dy = py + 0.5 - y;
        const localX = dx * cosAngle + dy * sinAngle;
        const localY = -dx * sinAngle + dy * cosAngle;
        const ellipseValue = (localX * localX) / (radiusX * radiusX) + (localY * localY) / (radiusY * radiusY);
        if (ellipseValue <= 1) {
          this.setPixel(px, py, color);
        }
      }
    }

    return this;
  }

  toRGBAData() {
    const data = new Uint8ClampedArray(this.width * this.height * 4);
    writePackedPixelsToRGBAData(this.pixels, data);
    return data;
  }
}

export class AquariumFramebuffer {
  constructor(modeIdOrMode = DEFAULT_PANEL_MODE_ID) {
    // Accept either a registered PANEL_MODES key or an ad-hoc custom mode object.
    const mode = typeof modeIdOrMode === "string" ? PANEL_MODES[modeIdOrMode] : modeIdOrMode;
    if (!mode) {
      throw new Error(`Unknown aquarium panel mode: ${modeIdOrMode}`);
    }

    this.mode = mode;
    this.modeId = mode.id;
    this.width = mode.logicalWidth;
    this.height = mode.logicalHeight;
    this.background = new FramebufferLayer(this.width, this.height, {
      name: "background",
      transparent: false,
      clearColor: BLACK,
    });
    this.foreground = new FramebufferLayer(this.width, this.height, {
      name: "foreground",
      transparent: true,
    });
    this.composite = new Uint32Array(this.width * this.height);
  }

  getXResolution() {
    return this.width;
  }

  getYResolution() {
    return this.height;
  }

  clearScreen() {
    this.background.clear();
    this.foreground.clear();
    this.composite.fill(TRANSPARENT);
    return this;
  }

  clearForeground() {
    this.foreground.clear();
    return this;
  }

  compositeLayers({ clearForeground = false } = {}) {
    for (let i = 0; i < this.composite.length; i += 1) {
      this.composite[i] = blendPackedOver(this.background.pixels[i], this.foreground.pixels[i]);
    }

    if (clearForeground) {
      this.clearForeground();
    }

    return this.composite;
  }

  toRGBAData(pixels = this.composite) {
    const data = new Uint8ClampedArray(this.width * this.height * 4);
    writePackedPixelsToRGBAData(pixels, data);
    return data;
  }

  getDebugSnapshot() {
    return {
      mode: this.modeId,
      logicalWidth: this.width,
      logicalHeight: this.height,
      physicalWidth: this.mode.physicalWidth ?? null,
      physicalHeight: this.mode.physicalHeight ?? null,
      backgroundPixels: this.background.pixels.length,
      foregroundPixels: this.foreground.pixels.length,
    };
  }
}

export const writePackedPixelsToRGBAData = (pixels, data) => {
  for (let i = 0; i < pixels.length; i += 1) {
    const packed = pixels[i] >>> 0;
    const offset = i * 4;
    data[offset] = (packed >>> 16) & BYTE_MAX;
    data[offset + 1] = (packed >>> 8) & BYTE_MAX;
    data[offset + 2] = packed & BYTE_MAX;
    data[offset + 3] = (packed >>> 24) & BYTE_MAX;
  }
  return data;
};

export const createAquariumFramebuffer = (modeId = DEFAULT_PANEL_MODE_ID) => new AquariumFramebuffer(modeId);

export default AquariumFramebuffer;

