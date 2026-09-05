import { DEFAULT_PANEL_MODE_ID, PANEL_MODES } from "./constants.js";
import { writePackedPixelsToRGBAData } from "./framebuffer.js";

export const SCALE_MODES = Object.freeze({
  FIT: "fit",
  INTEGER: "integer",
  STRETCH: "stretch",
});

export const RENDER_STYLES = Object.freeze({
  DOTS: "dots",
  SQUARES: "squares",
});

const DEFAULT_ALIGN = 0.5;
const DOT_RADIUS_RATIO = 0.43;

const getMode = (modeId = DEFAULT_PANEL_MODE_ID) => {
  const mode = PANEL_MODES[modeId];
  if (!mode) {
    throw new Error(`Unknown aquarium panel mode: ${modeId}`);
  }
  return mode;
};

export const getDefaultTargetSize = (modeId = DEFAULT_PANEL_MODE_ID) => {
  const mode = getMode(modeId);
  return {
    width: mode.physicalWidth ?? mode.logicalWidth,
    height: mode.physicalHeight ?? mode.logicalHeight,
  };
};

export function calculateViewport({
  logicalWidth,
  logicalHeight,
  targetWidth,
  targetHeight,
  scaleMode = SCALE_MODES.FIT,
  alignX = DEFAULT_ALIGN,
  alignY = DEFAULT_ALIGN,
}) {
  if (logicalWidth <= 0 || logicalHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    throw new Error("Viewport dimensions must be positive");
  }

  if (scaleMode === SCALE_MODES.STRETCH) {
    return {
      x: 0,
      y: 0,
      width: targetWidth,
      height: targetHeight,
      scaleX: targetWidth / logicalWidth,
      scaleY: targetHeight / logicalHeight,
      scaleMode,
    };
  }

  const rawScale = Math.min(targetWidth / logicalWidth, targetHeight / logicalHeight);
  const scale = scaleMode === SCALE_MODES.INTEGER && rawScale >= 1 ? Math.max(1, Math.floor(rawScale)) : rawScale;
  const width = Math.max(1, Math.round(logicalWidth * scale));
  const height = Math.max(1, Math.round(logicalHeight * scale));
  const x = Math.round((targetWidth - width) * alignX);
  const y = Math.round((targetHeight - height) * alignY);

  return {
    x,
    y,
    width,
    height,
    scaleX: width / logicalWidth,
    scaleY: height / logicalHeight,
    scaleMode,
  };
}

export const disableImageSmoothing = (context) => {
  if (!context) return;
  context.imageSmoothingEnabled = false;
  context.mozImageSmoothingEnabled = false;
  context.oImageSmoothingEnabled = false;
  context.webkitImageSmoothingEnabled = false;
  context.msImageSmoothingEnabled = false;
};

export const applyPixelCanvasStyle = (canvas) => {
  if (!canvas?.style) return;
  canvas.style.imageRendering = "pixelated";
  canvas.style.msInterpolationMode = "nearest-neighbor";
};

export const applyDotCanvasStyle = (canvas) => {
  if (!canvas?.style) return;
  canvas.style.imageRendering = "auto";
  canvas.style.msInterpolationMode = "auto";
};

const createScratchCanvas = (width, height) => {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  return null;
};

const createImageDataForContext = (context, width, height) => {
  if (typeof ImageData !== "undefined") {
    return new ImageData(width, height);
  }
  return context.createImageData(width, height);
};

export class CanvasAquariumRenderer {
  constructor(canvas = null, options = {}) {
    this.canvas = null;
    this.context = null;
    this.modeId = options.modeId ?? DEFAULT_PANEL_MODE_ID;
    this.scaleMode = options.scaleMode ?? SCALE_MODES.FIT;
    this.renderStyle = options.renderStyle ?? RENDER_STYLES.DOTS;
    this.alignX = options.alignX ?? DEFAULT_ALIGN;
    this.alignY = options.alignY ?? DEFAULT_ALIGN;
    this.backgroundColor = options.backgroundColor ?? "black";
    this.targetWidth = options.targetWidth ?? null;
    this.targetHeight = options.targetHeight ?? null;
    this.scratchCanvas = null;
    this.scratchContext = null;
    this.imageData = null;
    this.viewport = null;
    this.lastDebugSnapshot = null;

    if (canvas) {
      this.setCanvas(canvas);
    }
  }

  setCanvas(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: false });
    disableImageSmoothing(this.context);
    applyPixelCanvasStyle(canvas);
    return this;
  }

  resolveTargetSize(framebuffer, options = {}) {
    const modeId = options.modeId ?? framebuffer?.modeId ?? this.modeId;
    const defaultSize = getDefaultTargetSize(modeId);
    return {
      width: options.targetWidth ?? this.targetWidth ?? defaultSize.width,
      height: options.targetHeight ?? this.targetHeight ?? defaultSize.height,
    };
  }

  ensureScratchCanvas(width, height) {
    if (this.scratchCanvas && this.scratchCanvas.width === width && this.scratchCanvas.height === height) {
      return;
    }

    this.scratchCanvas = createScratchCanvas(width, height);
    if (!this.scratchCanvas) {
      throw new Error("Canvas rendering is not available in this environment");
    }
    this.scratchCanvas.width = width;
    this.scratchCanvas.height = height;
    this.scratchContext = this.scratchCanvas.getContext("2d");
    disableImageSmoothing(this.scratchContext);
    this.imageData = null;
  }

  ensureImageData(width, height) {
    if (!this.imageData || this.imageData.width !== width || this.imageData.height !== height) {
      this.imageData = createImageDataForContext(this.scratchContext, width, height);
    }
    return this.imageData;
  }

  presentFramebuffer(framebuffer, options = {}) {
    if (!this.canvas || !this.context) {
      throw new Error("CanvasAquariumRenderer requires a canvas before presenting");
    }

    const pixels = options.pixels ?? framebuffer.compositeLayers({
      clearForeground: options.clearForeground ?? false,
    });

    return this.presentPixels({
      pixels,
      logicalWidth: framebuffer.width,
      logicalHeight: framebuffer.height,
      modeId: framebuffer.modeId,
      ...options,
    });
  }

  presentPixels({
    pixels,
    logicalWidth,
    logicalHeight,
    modeId = this.modeId,
    targetWidth,
    targetHeight,
    scaleMode = this.scaleMode,
    alignX = this.alignX,
    alignY = this.alignY,
    renderStyle = this.renderStyle,
  }) {
    if (!this.canvas || !this.context) {
      throw new Error("CanvasAquariumRenderer requires a canvas before presenting");
    }

    const target = {
      width: targetWidth ?? this.targetWidth ?? getDefaultTargetSize(modeId).width,
      height: targetHeight ?? this.targetHeight ?? getDefaultTargetSize(modeId).height,
    };

    if (this.canvas.width !== target.width || this.canvas.height !== target.height) {
      this.canvas.width = target.width;
      this.canvas.height = target.height;
      disableImageSmoothing(this.context);
    }

    const viewport = calculateViewport({
      logicalWidth,
      logicalHeight,
      targetWidth: target.width,
      targetHeight: target.height,
      scaleMode,
      alignX,
      alignY,
    });

    this.context.save();
    disableImageSmoothing(this.context);
    this.context.fillStyle = this.backgroundColor;
    this.context.fillRect(0, 0, target.width, target.height);

    if (renderStyle === RENDER_STYLES.DOTS) {
      applyDotCanvasStyle(this.canvas);
      this.drawDotPixels({ pixels, logicalWidth, logicalHeight, viewport });
    } else {
      applyPixelCanvasStyle(this.canvas);
      this.ensureScratchCanvas(logicalWidth, logicalHeight);
      const imageData = this.ensureImageData(logicalWidth, logicalHeight);
      writePackedPixelsToRGBAData(pixels, imageData.data);
      this.scratchContext.putImageData(imageData, 0, 0);
      this.context.drawImage(
        this.scratchCanvas,
        0,
        0,
        logicalWidth,
        logicalHeight,
        viewport.x,
        viewport.y,
        viewport.width,
        viewport.height,
      );
    }
    this.context.restore();

    this.viewport = viewport;
    this.lastDebugSnapshot = {
      mode: modeId,
      logicalWidth,
      logicalHeight,
      physicalWidth: target.width,
      physicalHeight: target.height,
      viewport,
      renderStyle,
      dotRadius:
        renderStyle === RENDER_STYLES.DOTS
          ? Math.max(0.5, Math.min(viewport.scaleX, viewport.scaleY) * DOT_RADIUS_RATIO)
          : null,
      smoothing: false,
    };

    return this.lastDebugSnapshot;
  }

  drawDotPixels({ pixels, logicalWidth, logicalHeight, viewport }) {
    const dotRadius = Math.max(0.5, Math.min(viewport.scaleX, viewport.scaleY) * DOT_RADIUS_RATIO);
    const context = this.context;

    for (let y = 0; y < logicalHeight; y += 1) {
      const centerY = viewport.y + (y + 0.5) * viewport.scaleY;
      for (let x = 0; x < logicalWidth; x += 1) {
        const packed = pixels[y * logicalWidth + x] >>> 0;
        const alpha = (packed >>> 24) & 255;
        if (alpha === 0) continue;

        const red = (packed >>> 16) & 255;
        const green = (packed >>> 8) & 255;
        const blue = packed & 255;
        if (red === 0 && green === 0 && blue === 0) continue;

        const centerX = viewport.x + (x + 0.5) * viewport.scaleX;
        context.fillStyle =
          alpha === 255
            ? `rgb(${red}, ${green}, ${blue})`
            : `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`;
        context.beginPath();
        context.arc(centerX, centerY, dotRadius, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  pointerToLogical(eventOrPoint, canvas = this.canvas, viewport = this.viewport) {
    if (!canvas || !viewport) return null;

    const rect = canvas.getBoundingClientRect();
    const clientX = eventOrPoint.clientX ?? eventOrPoint.x;
    const clientY = eventOrPoint.clientY ?? eventOrPoint.y;
    const canvasX = ((clientX - rect.left) / rect.width) * canvas.width;
    const canvasY = ((clientY - rect.top) / rect.height) * canvas.height;

    return mapCanvasPointToLogical(canvasX, canvasY, viewport);
  }
}

export function mapCanvasPointToLogical(canvasX, canvasY, viewport) {
  if (!viewport) return null;
  if (
    canvasX < viewport.x ||
    canvasY < viewport.y ||
    canvasX >= viewport.x + viewport.width ||
    canvasY >= viewport.y + viewport.height
  ) {
    return null;
  }

  return {
    x: Math.floor((canvasX - viewport.x) / viewport.scaleX),
    y: Math.floor((canvasY - viewport.y) / viewport.scaleY),
  };
}

export const createAquariumRenderer = (canvas, options = {}) => new CanvasAquariumRenderer(canvas, options);

export default CanvasAquariumRenderer;
