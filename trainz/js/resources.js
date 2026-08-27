export const PRIMARY_COMMODITIES = ["COAL", "FRUIT", "BOTTLES"];
export const SECONDARY_COMMODITIES = ["WINE", "FOOD"];
export const COMMODITIES = [...PRIMARY_COMMODITIES, ...SECONDARY_COMMODITIES];
export const RECIPES = {
  WINE: { BOTTLES: 1, FRUIT: 1 },
  FOOD: { COAL: 1, FRUIT: 1 },
};
export const MAX_INVENTORY = 10;

function shuffled(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function emptyInventory() {
  return Object.fromEntries(COMMODITIES.map((commodity) => [commodity, 0]));
}

export function randomPrimaryInventory() {
  const inventory = emptyInventory();
  PRIMARY_COMMODITIES.forEach((commodity) => {
    inventory[commodity] = Math.floor(Math.random() * (MAX_INVENTORY + 1));
  });
  return inventory;
}

export function addInventory(station, commodity, amount = 1) {
  if (!COMMODITIES.includes(commodity)) return 0;
  const before = station.inventory[commodity] || 0;
  station.inventory[commodity] = Math.max(
    0,
    Math.min(MAX_INVENTORY, before + amount),
  );
  return station.inventory[commodity] - before;
}

export function removeInventory(station, commodity, amount = 1) {
  if (!COMMODITIES.includes(commodity)) return 0;
  const before = station.inventory[commodity] || 0;
  const removed = Math.max(0, Math.min(before, amount));
  station.inventory[commodity] = before - removed;
  return removed;
}

export function canProduce(station) {
  return Array.isArray(station.production) && station.production.length > 0;
}

export function produceCommodity(station, commodity) {
  if (!commodity || !COMMODITIES.includes(commodity)) return null;
  if (SECONDARY_COMMODITIES.includes(commodity)) {
    const recipe = RECIPES[commodity];
    if (
      !Object.entries(recipe).every(
        ([input, amount]) => (station.inventory[input] || 0) >= amount,
      )
    )
      return null;
    Object.entries(recipe).forEach(([input, amount]) =>
      removeInventory(station, input, amount),
    );
  }
  const produced = addInventory(station, commodity, 1);
  return produced > 0 ? { commodity, amount: produced } : null;
}

export function produceAtStation(station) {
  const commodity = station.production?.[0]?.commodity;
  return produceCommodity(station, commodity);
}

export function consumeCommodity(station, commodity) {
  if (!SECONDARY_COMMODITIES.includes(commodity)) return null;
  const consumed = removeInventory(station, commodity, 1);
  return consumed > 0 ? { commodity, amount: consumed } : null;
}

export function consumeAtStation(station) {
  const commodity = station.consumption?.[0]?.commodity;
  return consumeCommodity(station, commodity);
}

function roleIsValid(station, production, consumption) {
  if (production === consumption && SECONDARY_COMMODITIES.includes(production))
    return false;
  if (SECONDARY_COMMODITIES.includes(production)) {
    const inputs = Object.keys(RECIPES[production]);
    const producedInputs = inputs.filter((input) =>
      station.production?.some((producer) => producer.commodity === input),
    );
    if (producedInputs.length > 1) return false;
  }
  return true;
}

export function assignStationEconomy(stations) {
  if (stations.length < 2) return false;
  const producers = ["WINE", "FOOD", "COAL", "FRUIT", "BOTTLES"];
  // Role assignment was previously a fixed index % stations.length mapping,
  // so the same map always produced identical producer/consumer roles. Shuffle
  // which station gets which role each time, retrying if a shuffle happens to
  // violate a constraint (e.g. two-station maps have few valid arrangements).
  for (let attempt = 0; attempt < 25; attempt++) {
    stations.forEach((station) => {
      station.production = [];
      station.consumption = [];
      station.productionInputs = [];
      station.inventory = randomPrimaryInventory();
    });
    stations.forEach((station) => {
      station.inventory.WINE = 0;
      station.inventory.FOOD = 0;
    });
    const order = shuffled(stations);
    producers.forEach((commodity, index) => {
      const station = order[index % order.length];
      station.production.push({
        commodity,
        type: SECONDARY_COMMODITIES.includes(commodity)
          ? "secondary"
          : "primary",
      });
    });
    SECONDARY_COMMODITIES.forEach((commodity, index) => {
      const station = order[(index + 1) % order.length];
      station.consumption.push({ commodity, intervalSeconds: 60 });
    });
    stations.forEach((station) => {
      const secondaryProductions = station.production.filter(({ commodity }) =>
        SECONDARY_COMMODITIES.includes(commodity),
      );
      if (secondaryProductions.length) {
        station.productionInputs = Object.keys(
          RECIPES[secondaryProductions[0].commodity],
        ).filter((input) =>
          station.production.some((producer) => producer.commodity === input),
        );
      }
      if (
        !roleIsValid(
          station,
          secondaryProductions[0]?.commodity,
          station.consumption[0]?.commodity,
        )
      ) {
        station.productionInputs = [];
        station.consumption = station.consumption.filter(
          ({ commodity }) => commodity !== secondaryProductions[0]?.commodity,
        );
      }
    });
    if (validateStationEconomy(stations)) return true;
  }
  return false;
}

export function validateStationEconomy(stations) {
  if (stations.length < 2) return false;
  return (
    SECONDARY_COMMODITIES.every(
      (commodity) =>
        stations.some((station) =>
          station.production?.some(
            (producer) => producer.commodity === commodity,
          ),
        ) &&
        stations.some((station) =>
          station.consumption?.some(
            (consumer) => consumer.commodity === commodity,
          ),
        ),
    ) &&
    PRIMARY_COMMODITIES.every((commodity) =>
      stations.some((station) =>
        station.production?.some(
          (producer) => producer.commodity === commodity,
        ),
      ),
    )
  );
}

export function resetEconomyClock(state) {
  state.economy = {
    elapsedSeconds: 0,
    nextProductionAt: 30,
    nextConsumptionAt: 60,
  };
}

export function updateStationEconomy(state, dt) {
  if (!state.economy) resetEconomyClock(state);
  state.economy.elapsedSeconds += dt;
  const events = [];
  while (state.economy.elapsedSeconds >= state.economy.nextProductionAt) {
    state.pieces.forEach((piece) => {
      if (!piece.station) return;
      piece.station.production.forEach((producer) => {
        const result = produceCommodity(piece.station, producer.commodity);
        if (result)
          events.push({
            type: "production",
            stationId: piece.station.id,
            ...result,
          });
      });
    });
    state.economy.nextProductionAt += 30;
  }
  while (state.economy.elapsedSeconds >= state.economy.nextConsumptionAt) {
    state.pieces.forEach((piece) => {
      if (!piece.station) return;
      piece.station.consumption.forEach((consumer) => {
        const result = consumeCommodity(piece.station, consumer.commodity);
        if (result)
          events.push({
            type: "consumption",
            stationId: piece.station.id,
            ...result,
          });
      });
    });
    state.economy.nextConsumptionAt += 60;
  }
  return events;
}
