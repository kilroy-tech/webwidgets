const PERMUTATION = Uint8Array.from([
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225,
  140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148,
  247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32,
  57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
  74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122,
  60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54,
  65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169,
  200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64,
  52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212,
  207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213,
  119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
  129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104,
  218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241,
  81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157,
  184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93,
  222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
  151,
]);

const u8 = (value) => value & 0xff;
const u16 = (value) => Math.trunc(value) & 0xffff;
const i8 = (value) => {
  const byte = value & 0xff;
  return byte > 0x7f ? byte - 0x100 : byte;
};

const p = (index) => PERMUTATION[index & 0xff];

const qadd8 = (left, right) => Math.min(0xff, u8(left) + u8(right));
const scale8 = (value, scale) => (u8(value) * (u8(scale) + 1)) >> 8;
const avg7 = (left, right) => i8((i8(left) >> 1) + (i8(right) >> 1) + (i8(left) & 1));

const ease8InOutQuad = (value) => {
  const input = u8(value);
  let folded = input;
  if (folded & 0x80) {
    folded = 0xff - folded;
  }

  let eased = scale8(folded, folded) << 1;
  if (input & 0x80) {
    eased = 0xff - eased;
  }

  return u8(eased);
};

const lerp7by8 = (left, right, fraction) => {
  const a = i8(left);
  const b = i8(right);
  const frac = u8(fraction);

  if (b > a) {
    return i8(a + scale8(b - a, frac));
  }

  return i8(a - scale8(a - b, frac));
};

const grad8 = (hashValue, inputX, inputY, inputZ) => {
  const hash = hashValue & 0x0f;
  const x = i8(inputX);
  const y = i8(inputY);
  const z = i8(inputZ);
  let u = hash & 0x08 ? y : x;
  let v = hash < 4 ? y : hash === 12 || hash === 14 ? x : z;

  if (hash & 1) {
    u = i8(-u);
  }
  if (hash & 2) {
    v = i8(-v);
  }

  return avg7(u, v);
};

export const inoise8Raw = (inputX, inputY, inputZ) => {
  const x = u16(inputX);
  const y = u16(inputY);
  const z = u16(inputZ);

  const cellX = x >> 8;
  const cellY = y >> 8;
  const cellZ = z >> 8;

  const a = u8(p(cellX) + cellY);
  const aa = u8(p(a) + cellZ);
  const ab = u8(p(a + 1) + cellZ);
  const b = u8(p(cellX + 1) + cellY);
  const ba = u8(p(b) + cellZ);
  const bb = u8(p(b + 1) + cellZ);

  const u = ease8InOutQuad(x);
  const v = ease8InOutQuad(y);
  const w = ease8InOutQuad(z);
  const xx = (u8(x) >> 1) & 0x7f;
  const yy = (u8(y) >> 1) & 0x7f;
  const zz = (u8(z) >> 1) & 0x7f;
  const n = 0x80;

  const x1 = lerp7by8(grad8(p(aa), xx, yy, zz), grad8(p(ba), xx - n, yy, zz), u);
  const x2 = lerp7by8(grad8(p(ab), xx, yy - n, zz), grad8(p(bb), xx - n, yy - n, zz), u);
  const x3 = lerp7by8(grad8(p(aa + 1), xx, yy, zz - n), grad8(p(ba + 1), xx - n, yy, zz - n), u);
  const x4 = lerp7by8(grad8(p(ab + 1), xx, yy - n, zz - n), grad8(p(bb + 1), xx - n, yy - n, zz - n), u);
  const y1 = lerp7by8(x1, x2, v);
  const y2 = lerp7by8(x3, x4, v);

  return lerp7by8(y1, y2, w);
};

export const inoise8 = (x, y, z) => {
  const shifted = u8(inoise8Raw(x, y, z) + 64);
  return qadd8(shifted, shifted);
};

export default inoise8;
