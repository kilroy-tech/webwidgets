import { BODY_TYPES } from "../constants.js";
import { createSeededRandom } from "../random.js";
import { createFin, createHead, createRandomFin, createRandomHead, createRandomTail, createTail } from "./body-parts.js";
import { FishBody } from "./fish-body.js";
import { OctopusBody } from "./octopus-body.js";
import { SnakeBody } from "./snake-body.js";
import { StarBody } from "./star-body.js";
import { TurtleBody } from "./turtle-body.js";

export const BODY_TYPE_CONSTRUCTORS = Object.freeze({
  [BODY_TYPES.FISH]: FishBody,
  [BODY_TYPES.TURTLE]: TurtleBody,
  [BODY_TYPES.STAR]: StarBody,
  [BODY_TYPES.SNAKE]: SnakeBody,
  [BODY_TYPES.OCTOPUS]: OctopusBody,
});

const BODY_TYPE_LIST = Object.freeze(Object.values(BODY_TYPES));

export const createBody = (
  type = BODY_TYPES.FISH,
  { rng = createSeededRandom(), headType = null, tailType = null, finType = null, head = null, tail = null, fin = null } = {},
) => {
  const BodyType = BODY_TYPE_CONSTRUCTORS[type];
  if (!BodyType) {
    throw new Error(`Unknown aquarium body type: ${type}`);
  }

  return new BodyType({
    rng,
    head: head ?? (headType ? createHead(headType, { rng }) : createRandomHead(rng)),
    tail: tail ?? (tailType ? createTail(tailType, { rng }) : createRandomTail(rng)),
    fin: fin ?? (finType ? createFin(finType, { rng }) : createRandomFin(rng)),
  });
};

export const createRandomBody = (rng = createSeededRandom()) => createBody(BODY_TYPE_LIST[rng.int(0, BODY_TYPE_LIST.length)], { rng });

export const createTestBody = (rng = createSeededRandom()) =>
  createBody(BODY_TYPES.TURTLE, {
    rng,
    headType: "FrogHead",
    tailType: "noTail",
    finType: "LegFin",
  });

export default createBody;
