/**
 * TrafficFlow-AI Scenario Management (#7)
 * Schema: { name, seed, vehicles, arrivalConfig, signalConfig, incidents, fixedTimerCycle }
 */

export const STORAGE_KEY = 'trafficflow_saved_scenarios';

const JUNCTION_IDS = ['J1', 'J2', 'J3', 'J4'];
const DIRECTIONS = ['north', 'south', 'east', 'west'];
const VALID_INCIDENT_STATES = ['NORMAL', 'INCIDENT', 'ROAD_BLOCK'];

/**
 * 3 Built-in Scenarios:
 * 1. Proposal Default
 * 2. Morning Rush
 * 3. Hospital Run
 */
export const BUILT_IN_SCENARIOS = {
  PROPOSAL_DEFAULT: {
    name: 'Proposal Default',
    description: 'Baseline proposal scenario with balanced multi-junction traffic and default adaptive signal configuration.',
    seed: 1337,
    vehicles: {
      J1: { north: 12, south: 8, east: 15, west: 10 },
      J2: { north: 25, south: 18, east: 8, west: 12 },
      J3: { north: 6, south: 9, east: 14, west: 7 },
      J4: { north: 20, south: 22, east: 18, west: 15 }
    },
    arrivalConfig: {
      globalRate: 15,
      multipliers: {
        J1: { north: 1.0, south: 1.0, east: 1.0, west: 1.0 },
        J2: { north: 1.0, south: 1.0, east: 1.0, west: 1.0 },
        J3: { north: 1.0, south: 1.0, east: 1.0, west: 1.0 },
        J4: { north: 1.0, south: 1.0, east: 1.0, west: 1.0 }
      }
    },
    signalConfig: {
      minGreenTime: 15,
      maxGreenTime: 60,
      yellowTime: 3,
      allRedTime: 2,
      maxWaitTime: 60,
      greenFactor: 0.5
    },
    incidents: {
      J1: { north: 'NORMAL', south: 'NORMAL', east: 'NORMAL', west: 'NORMAL' },
      J2: { north: 'NORMAL', south: 'NORMAL', east: 'NORMAL', west: 'NORMAL' },
      J3: { north: 'NORMAL', south: 'NORMAL', east: 'NORMAL', west: 'NORMAL' },
      J4: { north: 'NORMAL', south: 'NORMAL', east: 'NORMAL', west: 'NORMAL' }
    },
    fixedTimerCycle: 30
  },

  MORNING_RUSH: {
    name: 'Morning Rush',
    description: 'Heavy morning rush hour commuter traffic skewed towards J4 expressway and J2-east corridor with elevated arrival rates.',
    seed: 2024,
    vehicles: {
      J1: { north: 22, south: 16, east: 28, west: 20 },
      J2: { north: 35, south: 18, east: 45, west: 14 },
      J3: { north: 15, south: 18, east: 24, west: 16 },
      J4: { north: 55, south: 48, east: 38, west: 42 }
    },
    arrivalConfig: {
      globalRate: 35,
      multipliers: {
        J1: { north: 1.0, south: 1.0, east: 1.2, west: 1.0 },
        J2: { north: 1.4, south: 1.0, east: 2.2, west: 1.0 },
        J3: { north: 1.0, south: 1.2, east: 1.4, west: 1.0 },
        J4: { north: 2.5, south: 2.2, east: 1.8, west: 2.0 }
      }
    },
    signalConfig: {
      minGreenTime: 20,
      maxGreenTime: 75,
      yellowTime: 3,
      allRedTime: 2,
      maxWaitTime: 50,
      greenFactor: 0.6
    },
    incidents: {
      J1: { north: 'NORMAL', south: 'NORMAL', east: 'NORMAL', west: 'NORMAL' },
      J2: { north: 'NORMAL', south: 'NORMAL', east: 'NORMAL', west: 'NORMAL' },
      J3: { north: 'NORMAL', south: 'NORMAL', east: 'NORMAL', west: 'NORMAL' },
      J4: { north: 'NORMAL', south: 'NORMAL', east: 'NORMAL', west: 'NORMAL' }
    },
    fixedTimerCycle: 40
  },

  HOSPITAL_RUN: {
    name: 'Hospital Run',
    description: 'Emergency response scenario heading toward City Hospital (H1) and Trauma Center (H2) through heavy congestion with a roadblock on Grand Ave.',
    seed: 999,
    vehicles: {
      J1: { north: 35, south: 40, east: 38, west: 25 },
      J2: { north: 25, south: 20, east: 45, west: 30 },
      J3: { north: 22, south: 28, east: 40, west: 35 },
      J4: { north: 45, south: 38, east: 50, west: 42 }
    },
    arrivalConfig: {
      globalRate: 22,
      multipliers: {
        J1: { north: 1.0, south: 1.0, east: 1.0, west: 1.0 },
        J2: { north: 1.0, south: 1.0, east: 1.2, west: 1.0 },
        J3: { north: 1.0, south: 1.0, east: 1.2, west: 1.0 },
        J4: { north: 1.5, south: 1.2, east: 1.5, west: 1.2 }
      }
    },
    signalConfig: {
      minGreenTime: 15,
      maxGreenTime: 60,
      yellowTime: 3,
      allRedTime: 2,
      maxWaitTime: 45,
      greenFactor: 0.5
    },
    incidents: {
      J1: { north: 'NORMAL', south: 'ROAD_BLOCK', east: 'NORMAL', west: 'NORMAL' },
      J2: { north: 'NORMAL', south: 'NORMAL', east: 'NORMAL', west: 'NORMAL' },
      J3: { north: 'NORMAL', south: 'NORMAL', east: 'NORMAL', west: 'NORMAL' },
      J4: { north: 'NORMAL', south: 'NORMAL', east: 'NORMAL', west: 'NORMAL' }
    },
    fixedTimerCycle: 30
  }
};

/**
 * Validates a Scenario object according to the system schema.
 * Supports camelCase, snake_case, and spaced property names.
 * 
 * @param {object} input - Raw scenario object
 * @returns {{ valid: boolean, errors: string[], sanitizedScenario: object|null }}
 */
export function validateScenario(input) {
  const errors = [];
  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Scenario must be a valid JSON object.'], sanitizedScenario: null };
  }

  // 1. Name validation
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    errors.push('Scenario "name" must be a non-empty string.');
  }

  // 2. Seed validation
  const seedNum = Number(input.seed);
  if (!Number.isFinite(seedNum) || seedNum < 0) {
    errors.push('Scenario "seed" must be a non-negative finite number.');
  }

  // 3. Vehicles validation
  const vehiclesInput = input.vehicles || input.initialVehicles;
  if (!vehiclesInput || typeof vehiclesInput !== 'object') {
    errors.push('Scenario "vehicles" must be an object containing J1, J2, J3, J4.');
  }

  const sanitizedVehicles = {};
  for (const jId of JUNCTION_IDS) {
    sanitizedVehicles[jId] = {};
    const jData = vehiclesInput?.[jId];
    if (!jData || typeof jData !== 'object') {
      errors.push(`Scenario "vehicles.${jId}" is missing or invalid.`);
      for (const dir of DIRECTIONS) sanitizedVehicles[jId][dir] = 10;
    } else {
      for (const dir of DIRECTIONS) {
        const count = Number(jData[dir]);
        if (!Number.isFinite(count) || count < 0) {
          errors.push(`Scenario vehicles.${jId}.${dir} must be a non-negative number.`);
          sanitizedVehicles[jId][dir] = 0;
        } else {
          sanitizedVehicles[jId][dir] = Math.min(100, Math.round(count));
        }
      }
    }
  }

  // 4. Arrival config validation (handles arrivalConfig, "arrival config", arrival_config)
  const arrivalInput = input.arrivalConfig || input['arrival config'] || input.arrival_config;
  const sanitizedArrivalConfig = {
    globalRate: 15,
    multipliers: {}
  };

  if (!arrivalInput || typeof arrivalInput !== 'object') {
    errors.push('Scenario "arrivalConfig" must be an object with globalRate and multipliers.');
  } else {
    const rate = Number(arrivalInput.globalRate ?? arrivalInput.rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 60) {
      errors.push('arrivalConfig.globalRate must be between 0 and 60 cars/min.');
      sanitizedArrivalConfig.globalRate = 15;
    } else {
      sanitizedArrivalConfig.globalRate = Math.round(rate);
    }

    const multInput = arrivalInput.multipliers || arrivalInput.approachMultipliers;
    for (const jId of JUNCTION_IDS) {
      sanitizedArrivalConfig.multipliers[jId] = {};
      for (const dir of DIRECTIONS) {
        const mult = Number(multInput?.[jId]?.[dir] ?? 1.0);
        sanitizedArrivalConfig.multipliers[jId][dir] = Number.isFinite(mult) && mult >= 0 && mult <= 5
          ? Math.round(mult * 10) / 10
          : 1.0;
      }
    }
  }

  // 5. Signal config validation (handles signalConfig, "signal config", signal_config)
  const signalInput = input.signalConfig || input['signal config'] || input.signal_config;
  const sanitizedSignalConfig = {
    minGreenTime: 15,
    maxGreenTime: 60,
    yellowTime: 3,
    allRedTime: 2,
    maxWaitTime: 60,
    greenFactor: 0.5
  };

  if (!signalInput || typeof signalInput !== 'object') {
    errors.push('Scenario "signalConfig" must be an object with timing parameters.');
  } else {
    const minG = Number(signalInput.minGreenTime ?? signalInput.minGreen ?? 15);
    const maxG = Number(signalInput.maxGreenTime ?? signalInput.maxGreen ?? 60);
    const yellow = Number(signalInput.yellowTime ?? signalInput.yellow ?? 3);
    const allRed = Number(signalInput.allRedTime ?? signalInput.allRed ?? 2);
    const wait = Number(signalInput.maxWaitTime ?? signalInput.starvationThreshold ?? 60);
    const factor = Number(signalInput.greenFactor ?? 0.5);

    if (minG < 5 || minG > 30) errors.push('signalConfig.minGreenTime must be between 5 and 30.');
    if (maxG < 30 || maxG > 120) errors.push('signalConfig.maxGreenTime must be between 30 and 120.');
    if (minG >= maxG) errors.push('signalConfig.minGreenTime must be strictly less than maxGreenTime.');
    if (yellow < 1 || yellow > 6) errors.push('signalConfig.yellowTime must be between 1 and 6.');
    if (allRed < 1 || allRed > 5) errors.push('signalConfig.allRedTime must be between 1 and 5.');
    if (wait < 30 || wait > 120) errors.push('signalConfig.maxWaitTime must be between 30 and 120.');
    if (factor < 0.1 || factor > 1.0) errors.push('signalConfig.greenFactor must be between 0.1 and 1.0.');

    sanitizedSignalConfig.minGreenTime = Math.min(30, Math.max(5, Math.round(minG)));
    sanitizedSignalConfig.maxGreenTime = Math.min(120, Math.max(sanitizedSignalConfig.minGreenTime + 5, Math.round(maxG)));
    sanitizedSignalConfig.yellowTime = Math.min(6, Math.max(1, Math.round(yellow)));
    sanitizedSignalConfig.allRedTime = Math.min(5, Math.max(1, Math.round(allRed)));
    sanitizedSignalConfig.maxWaitTime = Math.min(120, Math.max(30, Math.round(wait)));
    sanitizedSignalConfig.greenFactor = Math.min(1.0, Math.max(0.1, Math.round(factor * 10) / 10));
  }

  // 6. Incidents validation
  const incidentsInput = input.incidents;
  const sanitizedIncidents = {};
  for (const jId of JUNCTION_IDS) {
    sanitizedIncidents[jId] = {};
    for (const dir of DIRECTIONS) {
      const state = incidentsInput?.[jId]?.[dir];
      if (state && !VALID_INCIDENT_STATES.includes(state)) {
        errors.push(`Invalid incident state "${state}" for ${jId}.${dir}. Expected NORMAL, INCIDENT, or ROAD_BLOCK.`);
      }
      sanitizedIncidents[jId][dir] = VALID_INCIDENT_STATES.includes(state) ? state : 'NORMAL';
    }
  }

  // 7. Fixed-timer cycle validation (fixedTimerCycle, "fixed-timer cycle", fixed_timer_cycle, fixedGreenTime)
  const fixedCycleInput = input.fixedTimerCycle ?? input['fixed-timer cycle'] ?? input.fixed_timer_cycle ?? input.fixedGreenTime;
  let fixedCycle = Number(fixedCycleInput ?? 30);
  if (!Number.isFinite(fixedCycle) || fixedCycle < 10 || fixedCycle > 120) {
    errors.push('Scenario "fixedTimerCycle" must be a number between 10 and 120 seconds.');
    fixedCycle = 30;
  }

  const valid = errors.length === 0;
  const sanitizedScenario = {
    name,
    seed: Math.round(seedNum || 1337),
    vehicles: sanitizedVehicles,
    arrivalConfig: sanitizedArrivalConfig,
    signalConfig: sanitizedSignalConfig,
    incidents: sanitizedIncidents,
    fixedTimerCycle: Math.round(fixedCycle)
  };

  return {
    valid,
    errors,
    sanitizedScenario
  };
}

/**
 * Read saved user scenarios from localStorage safely wrapped in try/catch.
 * @returns {Array<object>}
 */
export function getSavedScenarios() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const result = validateScenario(item);
        return result.valid ? result.sanitizedScenario : null;
      })
      .filter(Boolean);
  } catch (err) {
    console.warn('Failed to read saved scenarios from localStorage:', err.message);
    return [];
  }
}

/**
 * Save a scenario to localStorage safely wrapped in try/catch.
 * @param {object} scenario
 * @returns {object} Sanitized saved scenario
 */
export function saveScenario(scenario) {
  const { valid, errors, sanitizedScenario } = validateScenario(scenario);
  if (!valid || !sanitizedScenario) {
    throw new Error(`Cannot save invalid scenario: ${errors.join(', ')}`);
  }

  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return sanitizedScenario;
  }

  try {
    const current = getSavedScenarios();
    const filtered = current.filter((s) => s.name.toLowerCase() !== sanitizedScenario.name.toLowerCase());
    filtered.unshift(sanitizedScenario);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return sanitizedScenario;
  } catch (err) {
    console.warn('Failed to save scenario to localStorage:', err.message);
    throw err;
  }
}

/**
 * Delete a user scenario from localStorage safely wrapped in try/catch.
 * @param {string} name
 * @returns {boolean}
 */
export function deleteScenario(name) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }
  try {
    const current = getSavedScenarios();
    const updated = current.filter((s) => s.name.toLowerCase() !== name.toLowerCase());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (err) {
    console.warn('Failed to delete scenario from localStorage:', err.message);
    return false;
  }
}

/**
 * Export scenario as formatted JSON string.
 * @param {object} scenario
 * @returns {string}
 */
export function exportScenarioAsJson(scenario) {
  const { sanitizedScenario } = validateScenario(scenario);
  const data = sanitizedScenario || scenario;
  return JSON.stringify(data, null, 2);
}

/**
 * Import and validate scenario from raw JSON string.
 * @param {string} jsonString
 * @returns {{ valid: boolean, errors: string[], scenario: object|null }}
 */
export function importScenarioFromJson(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    return { valid: false, errors: [`JSON parse error: ${err.message}`], scenario: null };
  }

  const { valid, errors, sanitizedScenario } = validateScenario(parsed);
  return {
    valid,
    errors,
    scenario: valid ? sanitizedScenario : null
  };
}

/**
 * Serialize current simulation state into a scenario object.
 * @param {object} state - Engine simulation state
 * @param {string} name - User-defined scenario name
 * @param {number} seed - Simulation seed
 * @param {number} fixedTimerCycle - Fixed timer cycle duration
 * @returns {object}
 */
export function serializeCurrentState(state, name = 'Custom Scenario', seed = 1337, fixedTimerCycle = 30) {
  return {
    name,
    seed: Number(seed) || 1337,
    vehicles: state.vehicles,
    arrivalConfig: state.arrivalConfig,
    signalConfig: state.signalConfig,
    incidents: state.incidents,
    fixedTimerCycle: Number(fixedTimerCycle) || Number(state.fixedGreenTime) || 30
  };
}
