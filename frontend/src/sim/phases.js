/**
 * Traffic Signal Phases Management (Generalised Single vs Opposing-Pair)
 *
 * Supports two operational signal modes:
 * 1. SINGLE (Default):
 *    - 4 dedicated phases: NORTH, EAST, SOUTH, WEST
 *    - Exactly ONE green approach at a time (zero conflicting movements)
 *    - Default cycle: NORTH -> EAST -> SOUTH -> WEST
 *    - Adaptive priority scoring chooses the next phase among the remaining candidates
 *    - Starvation threshold defaults to 90s
 * 
 * 2. PAIR (Legacy 2-phase):
 *    - 2 opposing phases: NORTH_SOUTH and EAST_WEST
 *    - Default cycle: NORTH_SOUTH -> EAST_WEST
 *    - Starvation threshold defaults to 60s
 */

export const SIGNAL_MODES = {
  SINGLE: 'SINGLE',
  PAIR: 'PAIR'
};

export const PHASING_MODES = {
  SINGLE: 'SINGLE',
  PAIR: 'PAIR',
  '4_PHASE': 'SINGLE',
  '2_PHASE': 'PAIR'
};

export const SINGLE_PHASE_ORDER = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
export const PAIR_PHASE_ORDER = ['NORTH_SOUTH', 'EAST_WEST'];

export const SINGLE_PHASES = {
  NORTH: {
    id: 'NORTH',
    label: 'Phase North (Single Green)',
    shortLabel: 'NORTH',
    greenDirections: ['north'],
    conflictingDirections: ['south', 'east', 'west'],
    nextPhase: 'EAST'
  },
  EAST: {
    id: 'EAST',
    label: 'Phase East (Single Green)',
    shortLabel: 'EAST',
    greenDirections: ['east'],
    conflictingDirections: ['north', 'south', 'west'],
    nextPhase: 'SOUTH'
  },
  SOUTH: {
    id: 'SOUTH',
    label: 'Phase South (Single Green)',
    shortLabel: 'SOUTH',
    greenDirections: ['south'],
    conflictingDirections: ['north', 'east', 'west'],
    nextPhase: 'WEST'
  },
  WEST: {
    id: 'WEST',
    label: 'Phase West (Single Green)',
    shortLabel: 'WEST',
    greenDirections: ['west'],
    conflictingDirections: ['north', 'south', 'east'],
    nextPhase: 'NORTH'
  }
};

export const PAIR_PHASES = {
  NORTH_SOUTH: {
    id: 'NORTH_SOUTH',
    label: 'Phase 1: NORTH / SOUTH',
    shortLabel: 'P1(NS)',
    greenDirections: ['north', 'south'],
    conflictingDirections: ['east', 'west'],
    nextPhase: 'EAST_WEST'
  },
  EAST_WEST: {
    id: 'EAST_WEST',
    label: 'Phase 2: EAST / WEST',
    shortLabel: 'P2(EW)',
    greenDirections: ['east', 'west'],
    conflictingDirections: ['north', 'south'],
    nextPhase: 'NORTH_SOUTH'
  }
};

/**
 * Normalizes input mode string to 'SINGLE' or 'PAIR'
 * @param {string} [mode='SINGLE']
 * @returns {'SINGLE'|'PAIR'}
 */
export function normalizeMode(mode) {
  if (!mode) return 'SINGLE';
  const m = String(mode).toUpperCase();
  if (m === 'PAIR' || m === '2_PHASE') return 'PAIR';
  return 'SINGLE';
}

/**
 * Returns the list of phases for a given mode.
 * The returned array is indexed by position and also provides phase objects by key.
 * 
 * @param {string} [mode='SINGLE'] - 'SINGLE' or 'PAIR'
 * @returns {string[]} Array of phase IDs (with attached phase definitions)
 */
export function getPhases(mode = 'SINGLE') {
  const norm = normalizeMode(mode);
  if (norm === 'SINGLE') {
    const list = [...SINGLE_PHASE_ORDER];
    for (const key of SINGLE_PHASE_ORDER) {
      Object.defineProperty(list, key, {
        value: SINGLE_PHASES[key],
        enumerable: false,
        configurable: true
      });
    }
    Object.defineProperty(list, 'definitions', {
      value: { ...SINGLE_PHASES },
      enumerable: false,
      configurable: true
    });
    return list;
  } else {
    const list = [...PAIR_PHASE_ORDER];
    for (const key of PAIR_PHASE_ORDER) {
      Object.defineProperty(list, key, {
        value: PAIR_PHASES[key],
        enumerable: false,
        configurable: true
      });
    }
    Object.defineProperty(list, 'definitions', {
      value: { ...PAIR_PHASES },
      enumerable: false,
      configurable: true
    });
    return list;
  }
}

/**
 * Returns which phase serves a given approach direction under the current mode.
 * 
 * @param {string} mode - 'SINGLE' or 'PAIR'
 * @param {string} dir - 'north' | 'south' | 'east' | 'west'
 * @returns {string} Phase ID ('NORTH', 'EAST', etc. in SINGLE; 'NORTH_SOUTH' or 'EAST_WEST' in PAIR)
 */
export function phaseForDirection(mode, dir) {
  const normMode = normalizeMode(mode);
  const d = String(dir || '').toLowerCase();

  if (normMode === 'SINGLE') {
    if (d === 'north') return 'NORTH';
    if (d === 'east') return 'EAST';
    if (d === 'south') return 'SOUTH';
    if (d === 'west') return 'WEST';
    return 'NORTH';
  } else {
    if (d === 'north' || d === 'south') return 'NORTH_SOUTH';
    if (d === 'east' || d === 'west') return 'EAST_WEST';
    return 'NORTH_SOUTH';
  }
}

/**
 * Returns array of green directions served by a given phase.
 * 
 * @param {string} phase - Phase ID (e.g. 'NORTH', 'NORTH_SOUTH', etc.)
 * @returns {string[]} Lowercase direction names, e.g. ['north'] or ['north', 'south']
 */
export function greenDirections(phase) {
  if (!phase) return [];
  const p = String(phase).toUpperCase();

  if (p === 'NORTH') return ['north'];
  if (p === 'EAST') return ['east'];
  if (p === 'SOUTH') return ['south'];
  if (p === 'WEST') return ['west'];
  if (p === 'NORTH_SOUTH') return ['north', 'south'];
  if (p === 'EAST_WEST') return ['east', 'west'];

  if (SINGLE_PHASES[p]) return [...SINGLE_PHASES[p].greenDirections];
  if (PAIR_PHASES[p]) return [...PAIR_PHASES[p].greenDirections];

  return [];
}

/**
 * Returns candidate next phases among the others (excluding the currently active phase).
 * 
 * @param {string} mode - 'SINGLE' or 'PAIR'
 * @param {string} [current] - Currently active phase
 * @returns {string[]}
 */
export function nextPhaseCandidates(mode, current) {
  const normMode = normalizeMode(mode);
  const allPhases = normMode === 'SINGLE' ? SINGLE_PHASE_ORDER : PAIR_PHASE_ORDER;

  if (!current) return [...allPhases];
  const curr = String(current).toUpperCase();
  const filtered = allPhases.filter((p) => p !== curr);
  return filtered.length > 0 ? filtered : [...allPhases];
}

/**
 * Returns the next phase in the default sequential cycle (e.g. for fixed-timer).
 * SINGLE mode: N -> E -> S -> W -> N
 * PAIR mode: NORTH_SOUTH -> EAST_WEST -> NORTH_SOUTH
 * 
 * @param {string} mode - 'SINGLE' or 'PAIR'
 * @param {string} current - Current phase
 * @returns {string}
 */
export function getNextCyclePhase(mode, current) {
  const normMode = normalizeMode(mode);
  if (normMode === 'SINGLE') {
    const idx = SINGLE_PHASE_ORDER.indexOf(String(current).toUpperCase());
    const nextIdx = (idx + 1) % SINGLE_PHASE_ORDER.length;
    return SINGLE_PHASE_ORDER[nextIdx >= 0 ? nextIdx : 0];
  } else {
    return String(current).toUpperCase() === 'NORTH_SOUTH' ? 'EAST_WEST' : 'NORTH_SOUTH';
  }
}

/**
 * Returns which directions have GREEN, YELLOW, or RED for a junction approach.
 * Guarantees hard invariant:
 * - In SINGLE mode: at most ONE approach is green at a time
 * - Never green+yellow mix across approaches
 * - In ALL_RED state: all 4 approaches are red
 * - In PAIR mode: only opposing pairs can be green together
 * 
 * @param {string} activePhase - 'NORTH', 'EAST', 'SOUTH', 'WEST', 'NORTH_SOUTH', 'EAST_WEST'
 * @param {string} signalState - 'GREEN' | 'YELLOW' | 'ALL_RED'
 * @returns {{ north: string, south: string, east: string, west: string }}
 */
export function getDirectionalSignalStates(activePhase, signalState = 'GREEN') {
  const result = { north: 'RED', south: 'RED', east: 'RED', west: 'RED' };

  if (signalState === 'ALL_RED') {
    return result; // All red
  }

  const greenDirs = greenDirections(activePhase);
  const color = signalState === 'YELLOW' ? 'YELLOW' : 'GREEN';

  for (const dir of greenDirs) {
    result[dir] = color;
  }

  return result;
}

/**
 * Unified next adaptive phase selector
 * 
 * @param {object} params
 * @param {string} [params.mode='SINGLE'] - 'SINGLE' or 'PAIR'
 * @param {string} params.currentPhase - Currently active phase
 * @param {object} params.approachScores - { north, south, east, west }
 * @param {object} params.waitingTimes - { north, south, east, west }
 * @param {object} params.vehicleCounts - { north, south, east, west }
 * @param {number} [params.maxWaitTime=90] - Starvation threshold
 * @param {string|null} [params.emergencyDirection=null] - Direction needing preemption
 * @param {boolean} [params.isFixedTimer=false] - Fixed cycle mode
 * @param {object} [params.incidents=null] - Incident states { north, south, east, west }
 * @returns {{ targetPhase: string, reason: string, isStarvation: boolean, isEmergency: boolean }}
 */
export function selectNextPhase({
  mode = 'SINGLE',
  currentPhase = 'NORTH',
  approachScores = { north: 0, south: 0, east: 0, west: 0 },
  waitingTimes = { north: 0, south: 0, east: 0, west: 0 },
  vehicleCounts = { north: 0, south: 0, east: 0, west: 0 },
  maxWaitTime = 90,
  emergencyDirection = null,
  isFixedTimer = false,
  incidents = null
}) {
  const normMode = normalizeMode(mode);

  // 1. Fixed Timer: strict default cycle rotation
  if (isFixedTimer) {
    const targetPhase = getNextCyclePhase(normMode, currentPhase);
    return {
      targetPhase,
      reason: `Fixed Timer Rotation (${targetPhase})`,
      isStarvation: false,
      isEmergency: false
    };
  }

  // 2. Emergency Preemption: overrides everything
  if (emergencyDirection) {
    const targetPhase = phaseForDirection(normMode, emergencyDirection);
    return {
      targetPhase,
      reason: `Emergency Preemption (${targetPhase})`,
      isStarvation: false,
      isEmergency: true
    };
  }

  // 3. Starvation Override: check unblocked approaches waiting >= maxWaitTime with queue > 0
  let maxWaitFound = -1;
  let starvedDir = null;
  const dirs = ['north', 'east', 'south', 'west'];

  for (const dir of dirs) {
    if (incidents?.[dir] === 'ROAD_BLOCK') continue; // Road blocks do not starve
    const wait = waitingTimes[dir] || 0;
    const count = vehicleCounts[dir] || 0;
    if (wait >= maxWaitTime && count > 0) {
      if (wait > maxWaitFound) {
        maxWaitFound = wait;
        starvedDir = dir;
      }
    }
  }

  if (starvedDir) {
    const targetPhase = phaseForDirection(normMode, starvedDir);
    return {
      targetPhase,
      reason: `Starvation Override (${starvedDir.toUpperCase()} waited ${waitingTimes[starvedDir]}s)`,
      isStarvation: true,
      isEmergency: false
    };
  }

  // 4. Adaptive Priority Scoring:
  if (normMode === 'PAIR') {
    // In legacy PAIR mode, compare opposing pairs: NS vs EW
    const nsDirs = greenDirections('NORTH_SOUTH');
    const ewDirs = greenDirections('EAST_WEST');
    const nsScore = nsDirs.reduce((sum, d) => (incidents?.[d] === 'ROAD_BLOCK' ? sum : sum + (Number(approachScores[d]) || 0)), 0);
    const ewScore = ewDirs.reduce((sum, d) => (incidents?.[d] === 'ROAD_BLOCK' ? sum : sum + (Number(approachScores[d]) || 0)), 0);
    const targetPhase = nsScore >= ewScore ? 'NORTH_SOUTH' : 'EAST_WEST';
    return {
      targetPhase,
      reason: `Adaptive Priority (NS: ${nsScore} vs EW: ${ewScore})`,
      isStarvation: false,
      isEmergency: false
    };
  }

  // In SINGLE mode, existing priority scoring chooses the next phase among the others
  const candidates = nextPhaseCandidates('SINGLE', currentPhase);
  let bestPhase = candidates[0] || 'NORTH';
  let bestScore = -1;

  for (const candidate of candidates) {
    const candidateDirs = greenDirections(candidate);
    const score = candidateDirs.reduce((sum, d) => {
      if (incidents?.[d] === 'ROAD_BLOCK') return sum;
      return sum + (Number(approachScores[d]) || 0);
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestPhase = candidate;
    }
  }

  return {
    targetPhase: bestPhase,
    reason: `Adaptive Priority (Target: ${bestPhase}, Score: ${bestScore})`,
    isStarvation: false,
    isEmergency: false
  };
}
