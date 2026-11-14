/**
 * Traffic Signal Phasing Management (Compatibility layer delegating to phases.js)
 */

import {
  SIGNAL_MODES,
  PHASING_MODES,
  SINGLE_PHASE_ORDER,
  PAIR_PHASE_ORDER,
  SINGLE_PHASES,
  PAIR_PHASES,
  normalizeMode,
  getPhases,
  phaseForDirection,
  greenDirections,
  nextPhaseCandidates,
  getNextCyclePhase,
  getDirectionalSignalStates,
  selectNextPhase
} from './phases.js';

export {
  SIGNAL_MODES,
  PHASING_MODES,
  SINGLE_PHASE_ORDER,
  PAIR_PHASE_ORDER,
  SINGLE_PHASES,
  PAIR_PHASES,
  normalizeMode,
  getPhases,
  phaseForDirection,
  greenDirections,
  nextPhaseCandidates,
  getNextCyclePhase,
  getDirectionalSignalStates,
  selectNextPhase
};

export const FOUR_PHASE_ORDER = SINGLE_PHASE_ORDER;
export const FOUR_PHASES = SINGLE_PHASES;
export const TWO_PHASES = PAIR_PHASES;

export function selectBest4Phase({
  currentPhase = 'NORTH',
  approachScores = { north: 0, south: 0, east: 0, west: 0 },
  waitingTimes = { north: 0, south: 0, east: 0, west: 0 },
  vehicleCounts = { north: 0, south: 0, east: 0, west: 0 },
  maxWaitTime = 90,
  emergencyDirection = null,
  isFixedTimer = false,
  incidents = null
}) {
  return selectNextPhase({
    mode: 'SINGLE',
    currentPhase,
    approachScores,
    waitingTimes,
    vehicleCounts,
    maxWaitTime,
    emergencyDirection,
    isFixedTimer,
    incidents
  });
}
