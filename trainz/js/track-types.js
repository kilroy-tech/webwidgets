export const DIRECTIONS = ["N", "E", "S", "W"];
export const TRACK_TYPES = {
  straight: { label: "Straight", icon: "↕", paths: [["N", "S", "straight"]] },
  curve: { label: "90° Curve", icon: "⌜", paths: [["N", "E", "curve"]] },
  doubleCurve: {
    label: "Double Curve",
    icon: "⌁",
    paths: [
      ["N", "E", "curve"],
      ["S", "W", "curve"],
    ],
  },
  intersection: {
    label: "Intersection",
    icon: "+",
    paths: [
      ["N", "S", "straight"],
      ["W", "E", "straight"],
    ],
  },
  switchLeft: {
    label: "Switch Left",
    icon: "╰",
    paths: [["S", "N", "straight"]],
    routes: {
      straight: [["S", "N", "straight"]],
      branch: [["S", "W", "curve"]],
    },
  },
  switchRight: {
    label: "Switch Right",
    icon: "╯",
    paths: [["S", "N", "straight"]],
    routes: {
      straight: [["S", "N", "straight"]],
      branch: [["S", "E", "curve"]],
    },
  },
  deadEnd: { label: "Dead End", icon: "⊣", paths: [["W", null, "deadEnd"]] },
  station: { label: "Station", icon: "▣", paths: [["W", "E", "straight"]] },
};

export function rotateDirection(direction, turns) {
  if (!direction) return null;
  return DIRECTIONS[(DIRECTIONS.indexOf(direction) + turns + 4) % 4];
}
export function rotatePaths(paths, turns) {
  return paths.map(([from, to, geometry]) => [
    rotateDirection(from, turns),
    rotateDirection(to, turns),
    geometry,
  ]);
}
export function getPiecePaths(piece) {
  if (piece.paths)
    return piece.paths.map(({ entry, exit, geometry }) => [
      entry,
      exit,
      geometry,
    ]);
  const definition = TRACK_TYPES[piece.type];
  const paths = piece.type.startsWith("switch")
    ? definition.routes[piece.switchState || "straight"]
    : definition.paths;
  return rotatePaths(paths, piece.rotation / 90);
}
export function getAllSwitchPaths(piece) {
  const definition = TRACK_TYPES[piece.type];
  if (!piece.type.startsWith("switch")) return [];
  return Object.entries(definition.routes).flatMap(([route, paths]) =>
    rotatePaths(paths, piece.rotation / 90).map((path) => [
      ...path,
      route === (piece.switchState || "straight"),
    ]),
  );
}
export function getSwitchRoutes(piece) {
  const definition = TRACK_TYPES[piece.type];
  if (!piece.type.startsWith("switch")) return {};
  return Object.fromEntries(
    Object.entries(definition.routes).map(([route, paths]) => [
      route,
      rotatePaths(paths, piece.rotation / 90),
    ]),
  );
}
export function hasEndpoint(piece, direction) {
  return getPiecePaths(piece).some(
    ([from, to]) => from === direction || to === direction,
  );
}
export function opposite(direction) {
  return DIRECTIONS[(DIRECTIONS.indexOf(direction) + 2) % 4];
}
export function normalizePiece(piece) {
  const definition = TRACK_TYPES[piece.type];
  const sourcePaths = piece.type.startsWith("switch")
    ? definition.routes[piece.switchState || "straight"]
    : definition.paths;
  const paths = rotatePaths(sourcePaths, piece.rotation / 90).map(
    ([entry, exit, geometry]) => ({ entry, exit, geometry }),
  );
  piece.paths = paths;
  piece.connections = [
    ...new Set(
      paths.flatMap((path) => [path.entry, path.exit]).filter(Boolean),
    ),
  ];
  return piece;
}
