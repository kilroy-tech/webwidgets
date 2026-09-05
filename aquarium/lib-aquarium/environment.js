import { ENVIRONMENT } from "./constants.js";

export const FIXED_ENVIRONMENT = Object.freeze({
  temperatureC: ENVIRONMENT.NORMAL_TEMPERATURE_C,
  temperatureF: ENVIRONMENT.NORMAL_TEMPERATURE_F,
  co2Ppm: ENVIRONMENT.NORMAL_CO2_PPM,
  humidityPercent: ENVIRONMENT.NORMAL_HUMIDITY_PERCENT,
});

export const createFixedEnvironment = () => ({ ...FIXED_ENVIRONMENT });

export const normalizeFixedEnvironment = () => createFixedEnvironment();

export default createFixedEnvironment;
