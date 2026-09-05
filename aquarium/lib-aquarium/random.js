export class SeededRandom {
  constructor(seed = 0x5eed1234) {
    this.seed = seed >>> 0;
  }

  next() {
    let value = (this.seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  float(min = 0, maxExclusive = 1) {
    return min + this.next() * (maxExclusive - min);
  }

  int(min, maxExclusive) {
    return Math.floor(this.float(min, maxExclusive));
  }
}

export const createSeededRandom = (seed) => new SeededRandom(seed);

export default SeededRandom;
