/**
 * TrafficFlow-AI Pure Simulation Engine
 *
 * Implements deterministic safe traffic signal simulation:
 * - Mulberry32 seeded RNG with separate streams per approach for arrivals and discharge
 * - Bernoulli/Poisson arrivals from configurable cars/min rate with 100-car queue cap
 * - Safe opposing phases (NORTH_SOUTH vs EAST_WEST)
 * - Deterministic transitions: GREEN -> YELLOW (3s) -> ALL_RED (2s) -> GREEN
 * - AI Adaptive Controller: priority scoring, starvation prevention (wait >= maxWaitTime), dynamic green, emergency preemption
 * - Fixed-Timer Controller: strict alternating cycle (default 30s green), no preemption (ambulance waits at red)
 * - Per-approach Incidents (NORMAL, INCIDENT 50% discharge, ROAD_BLOCK 0 discharge & diverted arrivals)
 * - Structured decision logs ({ id, simTime, junction, type, message }, max 200)
 * - Comprehensive metrics: queue-weighted wait, time-averaged queue, peak queue, throughput (60s & total), starvation count
 */

import {
  JUNCTIONS,
  DIRECTIONS,
  SAFE_PHASES,
  DEFAULT_SIGNAL_CONFIG,
  DEFAULT_NETWORK_VEHICLES,
  DEFAULT_WAITING_TIMES,
  DEFAULT_INCIDENTS,
  EXIT_DIRECTIONS,
  MAX_QUEUE_CAP
} from './config.js';

import {
  findShortestRoute,
  getAmbulanceCoordinates as getGraphAmbulanceCoords,
  getActiveSegmentSvgPath,
  GRAPH_NODES,
  GRAPH_EDGES
} from './routing.js';
import {
  normalizeMode,
  getPhases,
  phaseForDirection,
  greenDirections,
  nextPhaseCandidates,
  getNextCyclePhase,
  selectNextPhase
} from './phases.js';
import { selectBest4Phase, FOUR_PHASES } from './phasing.js';

/**
 * 32-bit Mulberry32 seeded PRNG step function
 * @param {number} seed - Current 32-bit unsigned integer seed
 * @returns {{ nextSeed: number, value: number }}
 */
export function nextRng(seed) {
  const nextSeed = (seed + 0x6D2B79F5) >>> 0;
  let t = Math.imul(nextSeed ^ (nextSeed >>> 15), nextSeed | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const raw = ((t ^ (t >>> 14)) >>> 0);
  return { nextSeed, value: raw / 4294967296 };
}

/**
 * Generate a pseudo-random 32-bit unsigned integer from a seed and optional salt
 */
export function hashSeed(seed, salt = 0) {
  let s = (seed + salt + 0x6D2B79F5) >>> 0;
  let t = Math.imul(s ^ (s >>> 15), s | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0);
}

/**
 * Computes priority score for a single approach
 * Priority = (count * 1.0) + (wait * 0.5) + (congestionLevel * 2.0)
 * Congestion level: >50: 3, >20: 2, >0: 1, 0: 0
 */
export function computePriority(count, wait) {
  const c = Math.max(0, Number(count) || 0);
  const w = Math.max(0, Number(wait) || 0);
  const congestion = c > 50 ? 3 : c > 20 ? 2 : c > 0 ? 1 : 0;
  return Math.round(((c * 1.0) + (w * 0.5) + (congestion * 2.0)) * 10) / 10;
}

/**
 * Create a structured log entry
 */
export function createStructuredLog(simTime, junction, type, message, index = 0) {
  return {
    id: `${simTime}-${junction || 'all'}-${type}-${index}`,
    simTime,
    junction: junction || null,
    type, // 'emergency' | 'starvation' | 'phase_change' | 'clearance' | 'incident' | 'system'
    message
  };
}

/**
 * Validate and clamp signal configuration values
 */
export function validateSignalConfig(cfg = {}) {
  const getNum = (v, defaultVal) => {
    if (v === undefined || v === null || isNaN(Number(v))) return defaultVal;
    return Number(v);
  };

  const rawMinGreen = getNum(cfg.minGreenTime ?? cfg.minGreen, 15);
  const minGreen = Math.max(5, Math.min(30, rawMinGreen));

  const rawMaxGreen = getNum(cfg.maxGreenTime ?? cfg.maxGreen, 60);
  let maxGreen = Math.max(30, Math.min(120, rawMaxGreen));
  if (maxGreen <= minGreen) {
    maxGreen = minGreen + 5;
  }

  const rawYellow = getNum(cfg.yellowTime ?? cfg.yellow, 3);
  const yellow = Math.max(2, Math.min(6, rawYellow));

  const rawAllRed = getNum(cfg.allRedTime ?? cfg.allRed, 2);
  const allRed = Math.max(1, Math.min(5, rawAllRed));

  const rawStarvation = getNum(cfg.maxWaitTime ?? cfg.starvation, 60);
  const starvation = Math.max(30, Math.min(120, rawStarvation));

  const rawFactor = getNum(cfg.greenFactor, 0.5);
  const factor = Math.max(0.1, Math.min(1.0, rawFactor));

  return {
    minGreenTime: minGreen,
    maxGreenTime: maxGreen,
    yellowTime: yellow,
    allRedTime: allRed,
    maxWaitTime: starvation,
    greenFactor: Math.round(factor * 100) / 100
  };
}

/**
 * Estimate no-preemption baseline delay across junctions along a route
 * @param {string[]} route - Array of node IDs
 * @param {object} signalStates - Current signal states per junction
 * @param {object} activePhases - Current active phases per junction
 * @param {object} countdowns - Current countdowns per junction
 * @param {object} signalConfig - Signal configuration (yellowTime, allRedTime)
 * @returns {number} Estimated delay in seconds
 */
export function estimateNoPreemptionDelay(route, signalStates = {}, activePhases = {}, countdowns = {}, signalConfig = {}) {
  let totalDelay = 0;
  if (!Array.isArray(route) || route.length < 2) return 0;

  for (let i = 0; i < route.length - 1; i++) {
    const fromNode = route[i];
    const toNode = route[i + 1];
    if (!GRAPH_NODES[fromNode]?.isJunction) continue;

    const edge = GRAPH_EDGES.find((e) => e.from === fromNode && e.to === toNode);
    const requiredPhase = edge?.requiredPhase || 'EAST_WEST';

    const currState = signalStates[fromNode];
    const currPhase = activePhases[fromNode];

    // If currently GREEN in the required corridor phase, no wait expected at this junction
    if (currState === 'GREEN' && currPhase === requiredPhase) {
      continue;
    }

    // Delay without preemption = remaining conflicting green countdown + yellow clearance + all-red clearance
    const remCountdown = countdowns[fromNode] ?? 25;
    const yellow = signalConfig?.yellowTime ?? 3;
    const allRed = signalConfig?.allRedTime ?? 2;
    totalDelay += (remCountdown + yellow + allRed);
  }

  return totalDelay;
}

/**
 * Determine which junction the ambulance is physically located at based on route progress
 */
export function getAmbulanceCurrentJunction(startJunction, progress, path, targetHospital) {
  if (progress >= 100) return targetHospital || 'HOSPITAL';
  if (path && Array.isArray(path)) {
    const coords = getGraphAmbulanceCoords({ junction: startJunction, progress, path, totalDistance: 600 });
    if (coords) return coords.currentJunction;
  }
  if (startJunction === 'J1') {
    if (progress < 34) return 'J1';
    if (progress < 68) return 'J2';
    return 'J4';
  } else if (startJunction === 'J2') {
    if (progress < 50) return 'J2';
    return 'J4';
  } else if (startJunction === 'J3') {
    if (progress < 50) return 'J3';
    return 'J4';
  }
  return startJunction;
}

/**
 * Get SVG coordinates for the moving ambulance
 */
export function getAmbulanceCoordinates(ambulance) {
  if (!ambulance) return null;
  if (ambulance.path && ambulance.path.length >= 2) {
    const coords = getGraphAmbulanceCoords(ambulance);
    if (coords) return { x: coords.x, y: coords.y };
  }

  const p = Math.max(0, Math.min(100, ambulance.progress || 0));
  if (p >= 100) return { x: 600, y: 310 };

  if (ambulance.junction === 'J1') {
    if (p <= 33) {
      const r = p / 33;
      return { x: 180 + (440 - 180) * r, y: 130 };
    } else if (p <= 66) {
      const r = (p - 33) / 33;
      return { x: 440, y: 130 + (310 - 130) * r };
    } else {
      const r = Math.min(1, (p - 66) / 34);
      return { x: 440 + (600 - 440) * r, y: 310 };
    }
  } else if (ambulance.junction === 'J2') {
    if (p <= 50) {
      const r = p / 50;
      return { x: 440, y: 130 + (310 - 130) * r };
    } else {
      const r = Math.min(1, (p - 50) / 50);
      return { x: 440 + (600 - 440) * r, y: 310 };
    }
  } else { // J3
    if (p <= 50) {
      const r = p / 50;
      return { x: 180 + (440 - 180) * r, y: 310 };
    } else {
      const r = Math.min(1, (p - 50) / 50);
      return { x: 440 + (600 - 440) * r, y: 310 };
    }
  }
}

/**
 * Get active corridor segment SVG path for the junction where ambulance currently is
 */
export function getActiveSegmentPath(ambulance) {
  if (!ambulance || ambulance.progress >= 100) return null;
  if (ambulance.path && ambulance.path.length >= 2) {
    const p = getActiveSegmentSvgPath(ambulance);
    if (p) return p;
  }
  const currentJ = ambulance.currentJunction || ambulance.junction;
  if (currentJ === 'J1') return 'M 180 130 L 440 130';
  if (currentJ === 'J2') return 'M 440 130 L 440 310';
  if (currentJ === 'J3') return 'M 180 310 L 440 310';
  if (currentJ === 'J4') return 'M 440 310 L 600 310';
  return null;
}

/**
 * Initialize RNG streams per approach for arrivals and discharge
 */
function createInitialRngStreams(masterSeed) {
  let seedCursor = (masterSeed >>> 0) || 123456789;
  const arrivals = {};
  const discharge = {};

  for (const jId of Object.keys(JUNCTIONS)) {
    arrivals[jId] = {};
    discharge[jId] = {};
    for (const dir of DIRECTIONS) {
      seedCursor = hashSeed(seedCursor, 1);
      arrivals[jId][dir] = seedCursor;
      seedCursor = hashSeed(seedCursor, 2);
      discharge[jId][dir] = seedCursor;
    }
  }

  return {
    masterSeed: (masterSeed >>> 0) || 123456789,
    arrivals,
    discharge
  };
}

/**
 * Deep-clone vehicle counts, waiting times or incidents map
 */
export function cloneGridMap(gridMap) {
  if (!gridMap) return {};
  const result = {};
  for (const jId of Object.keys(gridMap)) {
    result[jId] = { ...gridMap[jId] };
  }
  return result;
}

/**
 * Create default multipliers (1.0 for all approaches)
 */
export function createDefaultMultipliers() {
  const result = {};
  for (const jId of Object.keys(JUNCTIONS)) {
    result[jId] = {};
    for (const dir of DIRECTIONS) {
      result[jId][dir] = 1.0;
    }
  }
  return result;
}

/**
 * Create initial pure simulation state
 * @param {object} config - Configuration overrides (optional)
 * @param {number} seed - Seed for PRNG (default: 42)
 * @returns {object} Pure simulation state
 */
export function createInitialState(config = {}, seed = 42) {
  const initialVehicles = config.initialVehicles
    ? cloneGridMap(config.initialVehicles)
    : cloneGridMap(DEFAULT_NETWORK_VEHICLES);

  const initialWaitingTimes = config.initialWaitingTimes
    ? cloneGridMap(config.initialWaitingTimes)
    : cloneGridMap(DEFAULT_WAITING_TIMES);

  const phasingMode = config.phasingMode
    ? normalizeMode(config.phasingMode)
    : (config.initialActivePhases
      ? (Object.values(config.initialActivePhases).some((p) => ['NORTH', 'EAST', 'SOUTH', 'WEST'].includes(p)) ? 'SINGLE' : 'PAIR')
      : 'PAIR');

  const defaultPhases = phasingMode === 'SINGLE' ? {
    J1: 'NORTH',
    J2: 'EAST',
    J3: 'SOUTH',
    J4: 'WEST'
  } : {
    J1: 'NORTH_SOUTH',
    J2: 'EAST_WEST',
    J3: 'NORTH_SOUTH',
    J4: 'NORTH_SOUTH'
  };

  const activePhases = config.initialActivePhases ? { ...config.initialActivePhases } : defaultPhases;

  const signalStates = config.initialSignalStates ? { ...config.initialSignalStates } : {
    J1: 'GREEN',
    J2: 'GREEN',
    J3: 'GREEN',
    J4: 'GREEN'
  };

  const pendingPhases = {
    J1: null,
    J2: null,
    J3: null,
    J4: null
  };

  const countdowns = config.initialCountdowns ? { ...config.initialCountdowns } : (
    config.controller === 'fixed' ? {
      J1: config.fixedGreenTime || 30,
      J2: config.fixedGreenTime || 30,
      J3: config.fixedGreenTime || 30,
      J4: config.fixedGreenTime || 30
    } : {
      J1: 25,
      J2: 20,
      J3: 15,
      J4: 30
    }
  );

  const defaultMaxWait = phasingMode === 'SINGLE' ? 90 : 60;
  const signalConfig = validateSignalConfig({
    ...DEFAULT_SIGNAL_CONFIG,
    maxWaitTime: config.signalConfig?.maxWaitTime ?? defaultMaxWait,
    ...(config.signalConfig || {})
  });

  const arrivalConfig = {
    globalRate: config.arrivalConfig?.globalRate ?? config.arrivalRate ?? 8, // default ~8 cars/min per approach
    isRushHour: config.arrivalConfig?.isRushHour ?? false,
    rushHourMultiplier: 2.5,
    multipliers: config.arrivalConfig?.multipliers
      ? cloneGridMap(config.arrivalConfig.multipliers)
      : createDefaultMultipliers()
  };

  const incidents = config.incidents
    ? cloneGridMap(config.incidents)
    : cloneGridMap(DEFAULT_INCIDENTS);

  const controller = config.controller || 'adaptive'; // 'adaptive' | 'fixed'
  const fixedGreenTime = config.fixedGreenTime || 30;

  const initialAmbulances = config.ambulances
    ? config.ambulances.map((a) => ({ ...a }))
    : (config.ambulance ? [{ ...config.ambulance }] : (config.initialAmbulance ? [{ ...config.initialAmbulance }] : []));

  return {
    vehicles: initialVehicles,
    waitingTimes: initialWaitingTimes,
    activePhases,
    signalStates,
    pendingPhases,
    countdowns,
    signalConfig,
    arrivalConfig,
    incidents,
    controller,
    fixedGreenTime,
    phasingMode,
    ambulances: initialAmbulances,
    ambulance: initialAmbulances[0] || null,
    tick: 0,
    logs: [],
    rng: createInitialRngStreams(seed),
    metrics: {
      totalDischarged: 0,
      totalArrived: 0,
      totalWaitAccumulated: 0,
      recentDischarges: [], // { tick, count }
      cumulativeQueueSum: 0,
      maxQueue: 0,
      starvationEventsCount: 0
    }
  };
}

/**
 * Step the traffic network simulation forward by one tick (1 second)
 * PURE FUNCTION: Does not mutate state or config. Returns a fresh state object.
 *
 * @param {object} state - Current simulation state
 * @param {object} config - Configuration object
 * @param {object} opts - Optional runtime parameters (controller: 'adaptive'|'fixed', arrivalRate, etc.)
 * @returns {object} Next simulation state
 */
export function stepNetwork(state, config = {}, opts = {}) {
  const controllerType = opts.controller || state.controller || 'adaptive';
  const fixedGreenDuration = opts.fixedGreenTime || state.fixedGreenTime || config.fixedGreenTime || 30;

  const signalConfig = validateSignalConfig(
    opts.signalConfig || config.SIGNAL_CONFIG || state.signalConfig || DEFAULT_SIGNAL_CONFIG
  );
  const safePhases = config.SAFE_PHASES || SAFE_PHASES;
  const junctions = config.JUNCTIONS || JUNCTIONS;
  const exitDirs = config.EXIT_DIRECTIONS || EXIT_DIRECTIONS;
  const anyLegacyActive = Object.values(state.activePhases || {}).some((p) => p === 'NORTH_SOUTH' || p === 'EAST_WEST');
  const phasingMode = opts.phasingMode
    ? normalizeMode(opts.phasingMode)
    : (state.phasingMode ? normalizeMode(state.phasingMode) : (anyLegacyActive ? 'PAIR' : 'SINGLE'));

  // Deep clone structures so input state is completely unmodified
  const nextVehicles = cloneGridMap(state.vehicles);
  const nextWaits = cloneGridMap(state.waitingTimes);
  const nextPhases = { ...state.activePhases };
  const nextStates = { ...state.signalStates };
  const nextPending = { ...state.pendingPhases };
  const nextCounts = { ...state.countdowns };
  const nextIncidents = cloneGridMap(state.incidents || DEFAULT_INCIDENTS);
  const nextLogs = [...state.logs];

  let logIndex = 0;
  const addLog = (jId, type, message) => {
    logIndex++;
    nextLogs.unshift(createStructuredLog(state.tick, jId, type, message, logIndex));
  };

  const nextRngArrivals = cloneGridMap(state.rng.arrivals);
  const nextRngDischarge = cloneGridMap(state.rng.discharge);

  let totalDischargedDelta = 0;
  let totalArrivedDelta = 0;
  let totalWaitDelta = 0;
  const dischargeEvents = [];

  // 1. Prepare multiple ambulances (up to 3)
  const rawAmbs = (Array.isArray(state.ambulances) && state.ambulances.length > 0)
    ? state.ambulances
    : (state.ambulance ? [state.ambulance] : []);
  const nextAmbulances = rawAmbs.map((amb) => ({ ...amb }));

  // Identify controlling junction and required exit corridor phase for each active ambulance
  for (const amb of nextAmbulances) {
    if (amb.progress >= 100) continue;

    const coords = getGraphAmbulanceCoords(amb);
    if (coords) {
      amb.x = coords.x;
      amb.y = coords.y;
      amb.currentJunction = coords.currentJunction;
    }

    let neededPhase = phaseForDirection(phasingMode, 'EAST');
    if (Array.isArray(amb.path)) {
      const jIdx = amb.path.indexOf(amb.currentJunction);
      if (jIdx !== -1 && jIdx < amb.path.length - 1) {
        const nextNode = amb.path[jIdx + 1];
        const edge = GRAPH_EDGES.find((e) => e.from === amb.currentJunction && e.to === nextNode);
        if (edge) neededPhase = phaseForDirection(phasingMode, edge.exitDirection);
      }
    } else {
      const exitDir = exitDirs[amb.currentJunction] || 'EAST';
      neededPhase = phaseForDirection(phasingMode, exitDir);
    }
    amb.neededPhase = neededPhase;
  }

  // 2. Process Arrivals and Discharges per approach
  // Separate RNG streams: arrivals RNG stream advances every tick for every approach regardless of signal state.
  const baseArrivalRate = opts.arrivalRate !== undefined
    ? opts.arrivalRate
    : (state.arrivalConfig?.globalRate ?? config.arrivalRate ?? 8);
  const isRushHourActive = opts.isRushHour !== undefined
    ? opts.isRushHour
    : (state.arrivalConfig?.isRushHour ?? false);
  const rushHourMultiplier = state.arrivalConfig?.rushHourMultiplier ?? 2.5;
  const effectiveGlobalArrivalRate = isRushHourActive
    ? (baseArrivalRate * rushHourMultiplier)
    : baseArrivalRate;

  const multipliers = state.arrivalConfig?.multipliers;

  for (const jId of Object.keys(junctions)) {
    const phase = nextPhases[jId];
    const sState = nextStates[jId];
    const greenDirs = sState === 'GREEN' ? greenDirections(phase) : [];

    for (const dir of DIRECTIONS) {
      const incident = nextIncidents[jId]?.[dir] || 'NORMAL';
      const isRoadBlock = incident === 'ROAD_BLOCK';
      const isIncident = incident === 'INCIDENT';

      // Step Arrival RNG stream deterministically for this approach
      const arrStep = nextRng(state.rng.arrivals[jId][dir]);
      nextRngArrivals[jId][dir] = arrStep.nextSeed;

      // Calculate arrivals (ROAD_BLOCK diverts all arrivals -> 0 new arrivals)
      if (!isRoadBlock && effectiveGlobalArrivalRate > 0) {
        const mult = multipliers?.[jId]?.[dir] ?? 1.0;
        const ratePerMin = effectiveGlobalArrivalRate * mult;
        const lambda = ratePerMin / 60; // cars per second

        let newArrivals = 0;
        if (lambda <= 1.0) {
          const prob = 1 - Math.exp(-lambda);
          if (arrStep.value < prob) newArrivals = 1;
        } else {
          const base = Math.floor(lambda);
          const rem = lambda - base;
          const extra = arrStep.value < (1 - Math.exp(-rem)) ? 1 : 0;
          newArrivals = base + extra;
        }

        if (newArrivals > 0) {
          const currentCount = nextVehicles[jId][dir];
          const allowed = Math.max(0, Math.min(newArrivals, MAX_QUEUE_CAP - currentCount));
          nextVehicles[jId][dir] = currentCount + allowed;
          totalArrivedDelta += allowed;
        }
      }

      if (greenDirs.includes(dir)) {
        // Flowing on Green: reset wait time
        nextWaits[jId][dir] = 0;
        const count = nextVehicles[jId][dir];

        if (count > 0 && !isRoadBlock) {
          // Step Discharge RNG stream for this approach
          const d1 = nextRng(state.rng.discharge[jId][dir]);
          const d2 = nextRng(d1.nextSeed);
          nextRngDischarge[jId][dir] = d2.nextSeed;

          // INCIDENT has 50% discharge capacity
          const dischargeThreshold = isIncident ? (0.75 * 0.5) : 0.75;
          const dischargeQty = d1.value < dischargeThreshold ? (d2.value < 0.35 ? 2 : 1) : 0;

          if (dischargeQty > 0) {
            const actualDischarge = Math.min(count, dischargeQty);
            nextVehicles[jId][dir] = count - actualDischarge;
            totalDischargedDelta += actualDischarge;
            if (actualDischarge > 0) {
              dischargeEvents.push({
                junction: jId,
                direction: dir,
                count: actualDischarge,
                tick: state.tick + 1
              });
            }
          }
        }
      } else {
        // Stopped on Red or Yellow/All-Red: accumulate wait time
        // Blocked approaches do not accumulate wait time
        if (nextVehicles[jId][dir] > 0 && !isRoadBlock) {
          nextWaits[jId][dir] = (nextWaits[jId][dir] || 0) + 1;
          totalWaitDelta += 1;
        }
      }
    }
  }

  // Helper to compute approach priority score (ROAD_BLOCK approach queues are ignored)
  const getApproachScore = (jId, dir) => {
    if (nextIncidents[jId]?.[dir] === 'ROAD_BLOCK') return 0;
    return computePriority(nextVehicles[jId][dir], nextWaits[jId][dir]);
  };

  // Track starvation events
  let newStarvationsCount = 0;

  // 3. Process Transitions and Dynamic Phase Selection for each junction
  for (const jId of Object.keys(junctions)) {
    const currentState = nextStates[jId];
    const currentPhase = nextPhases[jId];
    const currentCount = nextCounts[jId];

    // Decrement countdown
    const newCount = Math.max(0, currentCount - 1);
    nextCounts[jId] = newCount;

    const isTimerExpired = newCount <= 0;
    const greenDirs = greenDirections(currentPhase);

    // Check if green queue emptied (ignoring blocked roads)
    const greenCarsSum = greenDirs.reduce((sum, d) => {
      if (nextIncidents[jId]?.[d] === 'ROAD_BLOCK') return sum;
      return sum + nextVehicles[jId][d];
    }, 0);
    const isQueueEmpty = currentState === 'GREEN' && greenCarsSum === 0;

    // Check emergency preemption at this specific junction
    // Each junction serves the earliest-arrived ambulance first; ambulances needing the same phase pass together
    const ambsAtThisJunction = nextAmbulances.filter(
      (amb) => amb.progress < 100 && (amb.currentJunction || amb.junction) === jId
    );

    let isEmergencyAtThisJunction = false;
    let emergencyRequiredPhase = phaseForDirection(phasingMode, exitDirs[jId] || 'NORTH');

    if (ambsAtThisJunction.length > 0) {
      isEmergencyAtThisJunction = true;
      ambsAtThisJunction.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      emergencyRequiredPhase = ambsAtThisJunction[0].neededPhase || emergencyRequiredPhase;
    }

    if (currentState === 'YELLOW') {
      if (isTimerExpired) {
        // Step 2: YELLOW -> ALL_RED clearance
        nextStates[jId] = 'ALL_RED';
        nextCounts[jId] = signalConfig.allRedTime;
        addLog(jId, 'clearance', `🛑 ${jId}: All-Red clearance interval active (${signalConfig.allRedTime}s). Intersection cleared.`);
      }
    } else if (currentState === 'ALL_RED') {
      if (isTimerExpired) {
        // Step 3: ALL_RED -> NEXT SAFE GREEN PHASE
        const defaultNext = getNextCyclePhase(phasingMode, currentPhase);
        const targetNextPhase = nextPending[jId] || defaultNext;
        nextPhases[jId] = targetNextPhase;
        nextStates[jId] = 'GREEN';
        nextPending[jId] = null;

        if (controllerType === 'fixed') {
          // Fixed timer: fixed green duration
          nextCounts[jId] = fixedGreenDuration;
          addLog(jId, 'phase_change', `🟢 ${jId} [Fixed Timer]: Phase ${targetNextPhase} is GREEN (${fixedGreenDuration}s).`);
        } else {
          // AI Adaptive: dynamic green duration clamped to [minGreenTime, maxGreenTime]
          const targetDirs = greenDirections(targetNextPhase);
          const phasePriority = targetDirs.reduce((sum, d) => {
            if (nextIncidents[jId]?.[d] === 'ROAD_BLOCK') return sum;
            return sum + getApproachScore(jId, d);
          }, 0);

          const factor = signalConfig.greenFactor ?? 0.5;
          const dynamicGreen = Math.min(
            signalConfig.maxGreenTime,
            Math.max(signalConfig.minGreenTime, Math.round(signalConfig.minGreenTime + (phasePriority * factor)))
          );

          nextCounts[jId] = isEmergencyAtThisJunction ? 45 : dynamicGreen;
          addLog(jId, 'phase_change', `🟢 ${jId}: Transition complete! Safe Phase ${targetNextPhase} is now GREEN (${nextCounts[jId]}s).`);
        }
      }
    } else if (currentState === 'GREEN') {
      if (controllerType === 'fixed') {
        // FIXED-TIMER CONTROLLER
        // No emergency preemption, no queue-empty check: strictly runs for fixedGreenDuration
        if (isTimerExpired) {
          const alternatePhase = getNextCyclePhase(phasingMode, currentPhase);
          nextStates[jId] = 'YELLOW';
          nextPending[jId] = alternatePhase;
          nextCounts[jId] = signalConfig.yellowTime;
          addLog(jId, 'clearance', `⚠️ ${jId} [Fixed Timer Cycle]: Initiating yellow clearance (${signalConfig.yellowTime}s) to ${alternatePhase}.`);
        }
      } else {
        // AI ADAPTIVE CONTROLLER
        // If emergency arrives and conflicting phase is currently green:
        // Transition safely through YELLOW!
        if (isEmergencyAtThisJunction && currentPhase !== emergencyRequiredPhase) {
          nextStates[jId] = 'YELLOW';
          nextPending[jId] = emergencyRequiredPhase;
          nextCounts[jId] = signalConfig.yellowTime;
          addLog(jId, 'emergency', `🚑 ${jId}: Emergency Preemption! Switching to YELLOW (${signalConfig.yellowTime}s) before granting ${emergencyRequiredPhase} GREEN.`);
          continue;
        }

        if (isQueueEmpty || isTimerExpired) {
          const maxWaitTime = (phasingMode === 'PAIR' && signalConfig.maxWaitTime === 90) ? 60 : signalConfig.maxWaitTime;
          const decision = selectNextPhase({
            mode: phasingMode,
            currentPhase,
            approachScores: {
              north: getApproachScore(jId, 'north'),
              south: getApproachScore(jId, 'south'),
              east: getApproachScore(jId, 'east'),
              west: getApproachScore(jId, 'west')
            },
            waitingTimes: nextWaits[jId],
            vehicleCounts: nextVehicles[jId],
            maxWaitTime,
            emergencyDirection: isEmergencyAtThisJunction ? (exitDirs[jId] || 'NORTH') : null,
            isFixedTimer: false,
            incidents: nextIncidents[jId]
          });

          const targetPhase = decision.targetPhase;
          const reason = decision.reason;
          const changeType = decision.isEmergency ? 'emergency' : decision.isStarvation ? 'starvation' : 'phase_change';
          if (decision.isStarvation) newStarvationsCount++;

          if (targetPhase !== currentPhase) {
            // Step 1: CURRENT GREEN -> YELLOW clearance
            nextStates[jId] = 'YELLOW';
            nextPending[jId] = targetPhase;
            nextCounts[jId] = signalConfig.yellowTime;
            addLog(jId, changeType, `⚠️ ${jId} [${reason}]: Initiating safe transition to ${targetPhase}. Yellow clearance (${signalConfig.yellowTime}s).`);
          } else {
            // Same phase maintained: recalculate dynamic green duration clamped
            const targetDirs = greenDirections(targetPhase);
            const phasePriority = targetDirs.reduce((sum, d) => {
              if (nextIncidents[jId]?.[d] === 'ROAD_BLOCK') return sum;
              return sum + getApproachScore(jId, d);
            }, 0);
            const factor = signalConfig.greenFactor ?? 0.5;
            const dynamicGreen = Math.min(
              signalConfig.maxGreenTime,
              Math.max(signalConfig.minGreenTime, Math.round(signalConfig.minGreenTime + (phasePriority * factor)))
            );
            nextCounts[jId] = isEmergencyAtThisJunction ? 45 : dynamicGreen;
            addLog(jId, 'system', `🔄 ${jId} [${reason}]: Extended Phase ${targetPhase} GREEN (${nextCounts[jId]}s).`);
          }
        }
      }
    }
  }

  // 4. Advance or halt each active ambulance
  for (const amb of nextAmbulances) {
    if (amb.progress >= 100) continue;

    const currJ = amb.currentJunction || amb.junction;
    const isHospital = currJ === 'HOSPITAL' || currJ === 'H2' || currJ === amb.targetHospital;

    let canProgress = false;
    if (isHospital) {
      canProgress = true;
    } else {
      const neededDirs = greenDirections(amb.neededPhase);
      const activeDirs = greenDirections(nextPhases[currJ]);
      const hasMatchingGreen = neededDirs.some((d) => activeDirs.includes(d));
      const isGreen = nextStates[currJ] === 'GREEN' && (nextPhases[currJ] === amb.neededPhase || hasMatchingGreen);
      canProgress = isGreen;
    }

    if (canProgress) {
      const ambSpeed = opts.ambulanceSpeed ?? 2;
      const nextProgress = Math.min(100, (amb.progress || 0) + ambSpeed);
      const prevProg = amb.progress;
      amb.progress = nextProgress;
      amb.isWaitingAtRed = false;

      const updatedCoords = getGraphAmbulanceCoords(amb);
      if (updatedCoords) {
        amb.x = updatedCoords.x;
        amb.y = updatedCoords.y;
        const prevJunc = amb.currentJunction;
        amb.currentJunction = updatedCoords.currentJunction;

        if (amb.currentJunction !== prevJunc) {
          if (amb.currentJunction === 'HOSPITAL' || amb.currentJunction === 'H2' || amb.currentJunction === amb.targetHospital) {
            addLog(amb.currentJunction, 'emergency', `🏥 Ambulance arrived safely at ${amb.hospitalName || amb.targetHospital || 'Hospital'}! Total transit: ${state.tick}s.`);
          } else {
            addLog(amb.currentJunction, 'emergency', `🚨 Ambulance reached ${amb.currentJunction}!`);
          }
        }
      }

      if (nextProgress >= 100 && prevProg < 100) {
        amb.arrived = true;
        amb.eta = 0;
      } else {
        amb.eta = Math.max(0, Math.ceil((100 - nextProgress) / ambSpeed));
      }
    } else {
      amb.isWaitingAtRed = true;
      amb.redWaitTicks = (amb.redWaitTicks || 0) + 1;
      amb.actualDelay = (amb.actualDelay || 0) + 1;
    }

    if (controllerType === 'fixed') {
      amb.timeSaved = 0;
    } else {
      amb.timeSaved = Math.max(0, (amb.estimatedNoPreemptionDelay || 0) - (amb.actualDelay || 0));
    }
  }

  const primaryAmbulance = nextAmbulances[0] || null;

  // Calculate current total network queue
  let currentTotalQueue = 0;
  for (const jId of Object.keys(junctions)) {
    for (const dir of DIRECTIONS) {
      currentTotalQueue += (nextVehicles[jId]?.[dir] || 0);
    }
  }

  // Update rolling 60s recent discharges
  const currentTick = state.tick;
  const prevRecent = state.metrics?.recentDischarges || [];
  const filteredRecent = prevRecent.filter((item) => item.tick > currentTick - 60);
  if (totalDischargedDelta > 0) {
    filteredRecent.push({ tick: currentTick, count: totalDischargedDelta });
  }

  const prevCumulativeQueue = state.metrics?.cumulativeQueueSum || 0;
  const prevMaxQueue = state.metrics?.maxQueue || 0;
  const prevStarvations = state.metrics?.starvationEventsCount || 0;

  return {
    vehicles: nextVehicles,
    waitingTimes: nextWaits,
    activePhases: nextPhases,
    signalStates: nextStates,
    pendingPhases: nextPending,
    countdowns: nextCounts,
    signalConfig,
    dischargeEvents,
    arrivalConfig: {
      globalRate: baseArrivalRate,
      isRushHour: isRushHourActive,
      rushHourMultiplier,
      multipliers: multipliers ? cloneGridMap(multipliers) : createDefaultMultipliers()
    },
    incidents: nextIncidents,
    controller: controllerType,
    fixedGreenTime: fixedGreenDuration,
    phasingMode,
    ambulances: nextAmbulances,
    ambulance: primaryAmbulance,
    tick: state.tick + 1,
    logs: nextLogs.slice(0, 200),
    rng: {
      masterSeed: state.rng.masterSeed,
      arrivals: nextRngArrivals,
      discharge: nextRngDischarge
    },
    metrics: {
      totalDischarged: state.metrics.totalDischarged + totalDischargedDelta,
      totalArrived: state.metrics.totalArrived + totalArrivedDelta,
      totalWaitAccumulated: state.metrics.totalWaitAccumulated + totalWaitDelta,
      recentDischarges: filteredRecent,
      cumulativeQueueSum: prevCumulativeQueue + currentTotalQueue,
      maxQueue: Math.max(prevMaxQueue, currentTotalQueue),
      starvationEventsCount: prevStarvations + newStarvationsCount
    }
  };
}

/**
 * Validate that the state does not violate safety invariants:
 * 1. Conflicting directions (NS and EW) are NEVER green simultaneously.
 * 2. In SINGLE mode, at most ONE direction is green at a time.
 * 3. In PAIR mode, only opposite approaches can be green together.
 */
export function checkSafetyInvariant(state, config = {}) {
  const junctions = config.JUNCTIONS || JUNCTIONS;
  const mode = normalizeMode(state.phasingMode || config.phasingMode);

  for (const jId of Object.keys(junctions)) {
    const sState = state.signalStates[jId];
    const phase = state.activePhases[jId];

    if (sState === 'GREEN') {
      const activeDirs = greenDirections(phase);

      if (mode === 'SINGLE') {
        if (activeDirs.length > 1) {
          return {
            valid: false,
            junction: jId,
            reason: `SINGLE mode violation: more than 1 direction green at ${jId} (${activeDirs.join(', ')})`
          };
        }
      } else {
        const hasNS = activeDirs.includes('north') || activeDirs.includes('south');
        const hasEW = activeDirs.includes('east') || activeDirs.includes('west');

        if (hasNS && hasEW) {
          return {
            valid: false,
            junction: jId,
            reason: `Conflicting directions green simultaneously at ${jId} (Phase: ${phase})`
          };
        }
        if (activeDirs.length > 2) {
          return {
            valid: false,
            junction: jId,
            reason: `More than 2 directions green simultaneously at ${jId} (${activeDirs.length} green)`
          };
        }
      }
    }
  }

  return { valid: true };
}
