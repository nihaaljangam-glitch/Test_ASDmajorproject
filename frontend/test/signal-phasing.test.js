import test from 'node:test';
import assert from 'node:assert/strict';

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
} from '../src/sim/phases.js';

import {
  createInitialState,
  stepNetwork,
  checkSafetyInvariant
} from '../src/sim/engine.js';

import {
  SIGNAL_CONFIG,
  SAFE_PHASES,
  JUNCTIONS,
  DIRECTIONS
} from '../src/sim/config.js';

test('phases: getPhases returns 4 phases for SINGLE and 2 for PAIR', () => {
  const singlePhases = getPhases('SINGLE');
  assert.equal(singlePhases.length, 4);
  assert.deepEqual([...singlePhases], ['NORTH', 'EAST', 'SOUTH', 'WEST']);
  assert.ok(singlePhases.NORTH);
  assert.ok(singlePhases.EAST);
  assert.ok(singlePhases.SOUTH);
  assert.ok(singlePhases.WEST);

  const pairPhases = getPhases('PAIR');
  assert.equal(pairPhases.length, 2);
  assert.deepEqual([...pairPhases], ['NORTH_SOUTH', 'EAST_WEST']);
  assert.ok(pairPhases.NORTH_SOUTH);
  assert.ok(pairPhases.EAST_WEST);

  // Default mode without arguments is SINGLE
  const defaultPhases = getPhases();
  assert.equal(defaultPhases.length, 4);
  assert.deepEqual([...defaultPhases], ['NORTH', 'EAST', 'SOUTH', 'WEST']);
});

test('phases: phaseForDirection maps correctly in SINGLE and PAIR modes', () => {
  // SINGLE mode: each direction has its own phase
  assert.equal(phaseForDirection('SINGLE', 'north'), 'NORTH');
  assert.equal(phaseForDirection('SINGLE', 'east'), 'EAST');
  assert.equal(phaseForDirection('SINGLE', 'south'), 'SOUTH');
  assert.equal(phaseForDirection('SINGLE', 'west'), 'WEST');
  assert.equal(phaseForDirection('SINGLE', 'NORTH'), 'NORTH');

  // PAIR mode: opposing approaches share phases
  assert.equal(phaseForDirection('PAIR', 'north'), 'NORTH_SOUTH');
  assert.equal(phaseForDirection('PAIR', 'south'), 'NORTH_SOUTH');
  assert.equal(phaseForDirection('PAIR', 'east'), 'EAST_WEST');
  assert.equal(phaseForDirection('PAIR', 'west'), 'EAST_WEST');
  assert.equal(phaseForDirection('PAIR', 'NORTH'), 'NORTH_SOUTH');
});

test('phases: greenDirections returns correct green approaches per phase', () => {
  assert.deepEqual(greenDirections('NORTH'), ['north']);
  assert.deepEqual(greenDirections('EAST'), ['east']);
  assert.deepEqual(greenDirections('SOUTH'), ['south']);
  assert.deepEqual(greenDirections('WEST'), ['west']);

  assert.deepEqual(greenDirections('NORTH_SOUTH'), ['north', 'south']);
  assert.deepEqual(greenDirections('EAST_WEST'), ['east', 'west']);
  assert.deepEqual(greenDirections('INVALID'), []);
});

test('phases: nextPhaseCandidates returns remaining candidates excluding current', () => {
  // SINGLE mode: 3 candidates excluding current
  assert.deepEqual(nextPhaseCandidates('SINGLE', 'NORTH'), ['EAST', 'SOUTH', 'WEST']);
  assert.deepEqual(nextPhaseCandidates('SINGLE', 'EAST'), ['NORTH', 'SOUTH', 'WEST']);
  assert.deepEqual(nextPhaseCandidates('SINGLE', 'SOUTH'), ['NORTH', 'EAST', 'WEST']);
  assert.deepEqual(nextPhaseCandidates('SINGLE', 'WEST'), ['NORTH', 'EAST', 'SOUTH']);
  assert.deepEqual(nextPhaseCandidates('SINGLE', null), ['NORTH', 'EAST', 'SOUTH', 'WEST']);

  // PAIR mode: alternate phase
  assert.deepEqual(nextPhaseCandidates('PAIR', 'NORTH_SOUTH'), ['EAST_WEST']);
  assert.deepEqual(nextPhaseCandidates('PAIR', 'EAST_WEST'), ['NORTH_SOUTH']);
  assert.deepEqual(nextPhaseCandidates('PAIR', null), ['NORTH_SOUTH', 'EAST_WEST']);
});

test('phases: getNextCyclePhase follows sequential default rotation', () => {
  assert.equal(getNextCyclePhase('SINGLE', 'NORTH'), 'EAST');
  assert.equal(getNextCyclePhase('SINGLE', 'EAST'), 'SOUTH');
  assert.equal(getNextCyclePhase('SINGLE', 'SOUTH'), 'WEST');
  assert.equal(getNextCyclePhase('SINGLE', 'WEST'), 'NORTH');

  assert.equal(getNextCyclePhase('PAIR', 'NORTH_SOUTH'), 'EAST_WEST');
  assert.equal(getNextCyclePhase('PAIR', 'EAST_WEST'), 'NORTH_SOUTH');
});

test('phases: getDirectionalSignalStates guarantees invariants', () => {
  // 1. ALL_RED: all directions are strictly RED
  for (const phase of ['NORTH', 'EAST', 'SOUTH', 'WEST', 'NORTH_SOUTH', 'EAST_WEST']) {
    const allRedSignals = getDirectionalSignalStates(phase, 'ALL_RED');
    assert.deepEqual(allRedSignals, { north: 'RED', south: 'RED', east: 'RED', west: 'RED' });
  }

  // 2. SINGLE GREEN: exactly 1 direction is green, others are red
  for (const dir of ['north', 'east', 'south', 'west']) {
    const phase = dir.toUpperCase();
    const signals = getDirectionalSignalStates(phase, 'GREEN');
    const greens = Object.entries(signals).filter(([_, val]) => val === 'GREEN');
    const reds = Object.entries(signals).filter(([_, val]) => val === 'RED');

    assert.equal(greens.length, 1);
    assert.equal(greens[0][0], dir);
    assert.equal(reds.length, 3);
  }

  // 3. SINGLE YELLOW: exactly 1 direction is yellow, others are red, never green+yellow mix
  for (const dir of ['north', 'east', 'south', 'west']) {
    const phase = dir.toUpperCase();
    const signals = getDirectionalSignalStates(phase, 'YELLOW');
    const yellows = Object.entries(signals).filter(([_, val]) => val === 'YELLOW');
    const greens = Object.entries(signals).filter(([_, val]) => val === 'GREEN');
    const reds = Object.entries(signals).filter(([_, val]) => val === 'RED');

    assert.equal(yellows.length, 1);
    assert.equal(yellows[0][0], dir);
    assert.equal(greens.length, 0); // Never green
    assert.equal(reds.length, 3);
  }

  // 4. PAIR mode: only opposing directions are green together
  const nsSignals = getDirectionalSignalStates('NORTH_SOUTH', 'GREEN');
  assert.equal(nsSignals.north, 'GREEN');
  assert.equal(nsSignals.south, 'GREEN');
  assert.equal(nsSignals.east, 'RED');
  assert.equal(nsSignals.west, 'RED');

  const ewSignals = getDirectionalSignalStates('EAST_WEST', 'GREEN');
  assert.equal(ewSignals.east, 'GREEN');
  assert.equal(ewSignals.west, 'GREEN');
  assert.equal(ewSignals.north, 'RED');
  assert.equal(ewSignals.south, 'RED');
});

test('HARD INVARIANT: SINGLE mode has at most ONE approach green, no green+yellow mix, ALL_RED means all red over 1,500 ticks', () => {
  let state = createInitialState({
    phasingMode: 'SINGLE',
    arrivalRate: 25,
    initialCountdowns: { J1: 15, J2: 20, J3: 25, J4: 30 }
  }, 9999);

  assert.equal(state.phasingMode, 'SINGLE');
  assert.equal(state.signalConfig.maxWaitTime, 90, 'SINGLE mode default starvation threshold must be 90s');

  for (let tick = 1; tick <= 1500; tick++) {
    state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES });

    // Assert safety invariant helper
    const safety = checkSafetyInvariant(state);
    assert.ok(safety.valid, `Tick ${tick}: ${safety.reason}`);

    // In-depth junction-by-junction check
    for (const jId of Object.keys(JUNCTIONS)) {
      const phase = state.activePhases[jId];
      const sState = state.signalStates[jId];
      const signals = getDirectionalSignalStates(phase, sState);

      const greenCount = Object.values(signals).filter((s) => s === 'GREEN').length;
      const yellowCount = Object.values(signals).filter((s) => s === 'YELLOW').length;
      const redCount = Object.values(signals).filter((s) => s === 'RED').length;

      // Invariant 1: At most ONE approach is green at any time
      assert.ok(greenCount <= 1, `Tick ${tick} Junction ${jId}: More than 1 approach green (${greenCount}) in SINGLE mode!`);

      // Invariant 2: Never green+yellow mix across approaches
      assert.ok(!(greenCount > 0 && yellowCount > 0), `Tick ${tick} Junction ${jId}: Mixed green and yellow!`);

      // Invariant 3: ALL_RED means all red
      if (sState === 'ALL_RED') {
        assert.equal(greenCount, 0, `Tick ${tick} Junction ${jId}: Green approach during ALL_RED clearance!`);
        assert.equal(yellowCount, 0, `Tick ${tick} Junction ${jId}: Yellow approach during ALL_RED clearance!`);
        assert.equal(redCount, 4, `Tick ${tick} Junction ${jId}: All approaches must be RED during ALL_RED!`);
      }

      // Invariant 4: YELLOW state has 1 yellow and 3 red
      if (sState === 'YELLOW') {
        assert.equal(yellowCount, 1, `Tick ${tick} Junction ${jId}: Yellow approach count must be 1`);
        assert.equal(greenCount, 0, `Tick ${tick} Junction ${jId}: No green allowed in YELLOW state`);
        assert.equal(redCount, 3, `Tick ${tick} Junction ${jId}: Other 3 approaches must be RED`);
      }
    }
  }
});

test('HARD INVARIANT: PAIR mode allows only opposing pairs green together, never cross-corridor greens over 1,500 ticks', () => {
  let state = createInitialState({
    phasingMode: 'PAIR',
    arrivalRate: 25,
    initialCountdowns: { J1: 15, J2: 20, J3: 25, J4: 30 }
  }, 8888);

  assert.equal(state.phasingMode, 'PAIR');
  assert.equal(state.signalConfig.maxWaitTime, 60, 'PAIR mode default starvation threshold must be 60s');

  for (let tick = 1; tick <= 1500; tick++) {
    state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES });

    const safety = checkSafetyInvariant(state);
    assert.ok(safety.valid, `Tick ${tick}: ${safety.reason}`);

    for (const jId of Object.keys(JUNCTIONS)) {
      const phase = state.activePhases[jId];
      const sState = state.signalStates[jId];
      const signals = getDirectionalSignalStates(phase, sState);

      const hasNSGreen = signals.north === 'GREEN' || signals.south === 'GREEN';
      const hasEWGreen = signals.east === 'GREEN' || signals.west === 'GREEN';

      // Conflicting opposing phases are NEVER green together
      assert.ok(!(hasNSGreen && hasEWGreen), `Tick ${tick} Junction ${jId}: Conflicting greens active simultaneously!`);

      if (sState === 'ALL_RED') {
        assert.deepEqual(signals, { north: 'RED', south: 'RED', east: 'RED', west: 'RED' });
      }
    }
  }
});

test('signal mode switching: safely resets all junctions to ALL_RED then restarts cycle', () => {
  // Start in PAIR mode
  let state = createInitialState({ phasingMode: 'PAIR' }, 777);
  assert.equal(state.phasingMode, 'PAIR');

  // Switch to SINGLE mode
  const allRedTime = state.signalConfig.allRedTime || 2;
  const switchedState = {
    ...state,
    phasingMode: 'SINGLE',
    activePhases: { J1: 'NORTH', J2: 'EAST', J3: 'SOUTH', J4: 'WEST' },
    signalStates: { J1: 'ALL_RED', J2: 'ALL_RED', J3: 'ALL_RED', J4: 'ALL_RED' },
    pendingPhases: { J1: 'NORTH', J2: 'EAST', J3: 'SOUTH', J4: 'WEST' },
    countdowns: { J1: allRedTime, J2: allRedTime, J3: allRedTime, J4: allRedTime },
    signalConfig: { ...state.signalConfig, maxWaitTime: 90 }
  };

  // Verify ALL junctions are ALL_RED
  for (const jId of Object.keys(JUNCTIONS)) {
    assert.equal(switchedState.signalStates[jId], 'ALL_RED');
    assert.equal(switchedState.countdowns[jId], 2);
    const signals = getDirectionalSignalStates(switchedState.activePhases[jId], switchedState.signalStates[jId]);
    assert.deepEqual(signals, { north: 'RED', south: 'RED', east: 'RED', west: 'RED' });
  }

  // Step 1 second: still in ALL_RED (countdown = 1)
  const step1 = stepNetwork(switchedState, { SIGNAL_CONFIG, SAFE_PHASES });
  for (const jId of Object.keys(JUNCTIONS)) {
    assert.equal(step1.signalStates[jId], 'ALL_RED');
    assert.equal(step1.countdowns[jId], 1);
  }

  // Step 2nd second: ALL_RED expires -> smoothly enters GREEN in SINGLE mode
  const step2 = stepNetwork(step1, { SIGNAL_CONFIG, SAFE_PHASES });
  for (const jId of Object.keys(JUNCTIONS)) {
    assert.equal(step2.signalStates[jId], 'GREEN');
    assert.equal(step2.phasingMode, 'SINGLE');
    const signals = getDirectionalSignalStates(step2.activePhases[jId], step2.signalStates[jId]);
    const greenCount = Object.values(signals).filter((s) => s === 'GREEN').length;
    assert.equal(greenCount, 1, `Junction ${jId} must have exactly one green light on startup in SINGLE mode!`);
  }
});
