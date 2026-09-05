const GLYPHS = Object.freeze({
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  A: ["010", "101", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  C: ["111", "100", "100", "100", "111"],
  D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "111", "100", "111"],
  F: ["111", "100", "111", "100", "100"],
  G: ["111", "100", "101", "101", "111"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  J: ["001", "001", "001", "101", "111"],
  K: ["101", "101", "110", "101", "101"],
  L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "111", "101", "101"],
  N: ["101", "111", "111", "111", "101"],
  O: ["111", "101", "101", "101", "111"],
  P: ["111", "101", "111", "100", "100"],
  Q: ["111", "101", "101", "111", "001"],
  R: ["111", "101", "111", "110", "101"],
  S: ["111", "100", "111", "001", "111"],
  T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"],
  V: ["101", "101", "101", "101", "010"],
  W: ["101", "101", "111", "111", "101"],
  X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"],
  Z: ["111", "001", "010", "100", "111"],
  ":": ["0", "1", "0", "1", "0"],
  ".": ["0", "0", "0", "0", "1"],
  "/": ["001", "001", "010", "100", "100"],
  "-": ["000", "000", "111", "000", "000"],
  " ": ["0", "0", "0", "0", "0"],
});

const DEFAULT_COLOR = Object.freeze({ r: 210, g: 248, b: 232, a: 230 });
const DEFAULT_SHADOW = Object.freeze({ r: 0, g: 6, b: 8, a: 160 });

export const measurePixelText = (text, { scale = 1, letterSpacing = 1 } = {}) => {
  const chars = String(text ?? "").toUpperCase().split("");
  if (!chars.length) return { width: 0, height: 0 };

  const width = chars.reduce((sum, char, index) => {
    const glyph = GLYPHS[char] ?? GLYPHS[" "];
    const glyphWidth = Math.max(...glyph.map((row) => row.length)) * scale;
    return sum + glyphWidth + (index < chars.length - 1 ? letterSpacing : 0);
  }, 0);

  return { width, height: 5 * scale };
};

export const drawPixelText = (
  layer,
  text,
  x,
  y,
  { color = DEFAULT_COLOR, shadowColor = DEFAULT_SHADOW, scale = 1, letterSpacing = 1 } = {},
) => {
  if (!layer) return { width: 0, height: 0 };

  const chars = String(text ?? "").toUpperCase().split("");
  let cursorX = Math.round(x);
  const startY = Math.round(y);

  const drawGlyph = (glyph, gx, gy, drawColor) => {
    for (let row = 0; row < glyph.length; row += 1) {
      for (let col = 0; col < glyph[row].length; col += 1) {
        if (glyph[row][col] !== "1") continue;
        layer.fillRect(gx + col * scale, gy + row * scale, scale, scale, drawColor);
      }
    }
  };

  for (const char of chars) {
    const glyph = GLYPHS[char] ?? GLYPHS[" "];
    const glyphWidth = Math.max(...glyph.map((row) => row.length)) * scale;

    if (shadowColor) {
      drawGlyph(glyph, cursorX + 1, startY + 1, shadowColor);
    }
    drawGlyph(glyph, cursorX, startY, color);

    cursorX += glyphWidth + letterSpacing;
  }

  return { width: cursorX - Math.round(x) - letterSpacing, height: 5 * scale };
};

export const drawCenteredPixelText = (layer, text, centerX, y, options = {}) => {
  const size = measurePixelText(text, options);
  const x = Math.round(centerX - size.width / 2);
  drawPixelText(layer, text, x, y, options);
  return { ...size, x, y };
};
