import { BODY_PART_TYPES } from "../constants.js";
import { createSeededRandom } from "../random.js";
import { createFin, FIN_TYPES } from "./fin.js";
import { createHead, HEAD_TYPES } from "./head.js";
import { createTail, TAIL_TYPES } from "./tail.js";

const randomItem = (rng, items) => items[rng.int(0, items.length)];

export const createRandomHead = (rng = createSeededRandom()) => createHead(randomItem(rng, BODY_PART_TYPES.HEADS), { rng });

export const createRandomTail = (rng = createSeededRandom()) => createTail(randomItem(rng, BODY_PART_TYPES.RANDOM_TAILS), { rng });

export const createRandomFin = (rng = createSeededRandom()) => createFin(randomItem(rng, BODY_PART_TYPES.FINS), { rng });

export const BODY_PART_FACTORIES = Object.freeze({
  heads: HEAD_TYPES,
  tails: TAIL_TYPES,
  fins: FIN_TYPES,
});

export { createFin, createHead, createTail };
export * from "./fin.js";
export * from "./head.js";
export * from "./tail.js";
