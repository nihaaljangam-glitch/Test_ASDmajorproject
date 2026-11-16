import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createInitialState,
  stepNetwork,
  computePriority,
  checkSafetyInvariant,
  validateSignalConfig,
  nextRng
} from '../src/sim/engine.js';

import {
  SIGNAL_CONFIG,
  SAFE_PHASES,
  MAX_QUEUE_CAP,
  ARRIVAL_PRESETS
} from '../src/sim/config.js';

import {
  computeCongestionIndex,
  getTrafficTier,
  getTrafficTierColor,
  getTierBgTint
} from '../src/sim/tiers.js';

test('computePriority calculates scores and handles congestion breakpoints', () => {
  assert.equal(computePriority(0, 0), 0);
  assert.equal(computePriority(10, 10), 17);
  assert.equal(computePriority(25, 20), 39);
  assert.equal(computePriority(55, 30), 76);
});

test('engine determinism: identical seeds yield identical states over 100 ticks', () => {
  const seed = 12345;
  let stateA = createInitialState({}, seed);
  let stateB = createInitialState({}, seed);

  for (let i = 0; i < 100; i++) {
    stateA = stepNetwork(stateA, { SIGNAL_CONFIG, SAFE_PHASES }, { arrivalRate: 15 });
    stateB = stepNetwork(stateB, { SIGNAL_CONFIG, SAFE_PHASES }, { arrivalRate: 15 });

    assert.deepEqual(stateA.vehicles, stateB.vehicles, `Vehicles differed at tick ${i}`);
    assert.deepEqual(stateA.waitingTimes, stateB.waitingTimes, `Waiting times differed at tick ${i}`);
    assert.deepEqual(stateA.signalStates, stateB.signalStates, `Signal states differed at tick ${i}`);
    assert.deepEqual(stateA.activePhases, stateB.activePhases, `Active phases differed at tick ${i}`);
    assert.deepEqual(stateA.countdowns, stateB.countdowns, `Countdowns differed at tick ${i}`);
  }
});

test('engine isolation: input state is not mutated by stepNetwork (pure function)', () => {
  const state = createInitialState({}, 42);
  const stateBefore = JSON.parse(JSON.stringify(state));

  const next = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES }, { arrivalRate: 20 });

  assert.deepEqual(state.vehicles, stateBefore.vehicles);
  assert.deepEqual(state.waitingTimes, stateBefore.waitingTimes);
  assert.deepEqual(state.signalStates, stateBefore.signalStates);
  assert.deepEqual(state.countdowns, stateBefore.countdowns);
  assert.notEqual(state, next);
  assert.notEqual(state.vehicles.J1, next.vehicles.J1);
});

test('separate RNG streams: arrival patterns are identical regardless of signal controller', () => {
  const seed = 999;
  let stateA = createInitialState({}, seed);
  let stateB = createInitialState({}, seed);

  stateB.activePhases.J1 = 'EAST_WEST';

  for (let i = 0; i < 50; i++) {
    stateA = stepNetwork(stateA, { SIGNAL_CONFIG, SAFE_PHASES }, { arrivalRate: 25 });
    stateB = stepNetwork(stateB, { SIGNAL_CONFIG, SAFE_PHASES }, { arrivalRate: 25 });

    assert.deepEqual(
      stateA.rng.arrivals,
      stateB.rng.arrivals,
      `Arrivals RNG diverged at tick ${i}`
    );
  }
});

test('safety invariant: conflicting greens are never active over a 1,000-tick run', () => {
  let state = createInitialState({}, 777);

  for (let t = 0; t < 1000; t++) {
    const opts = { arrivalRate: 25 };
    if (t === 100) {
      state.ambulance = {
        junction: 'J1',
        currentJunction: 'J1',
        path: ['J1', 'J2', 'J4', 'HOSPITAL'],
        progress: 0
      };
    } else if (t === 500) {
      state.ambulance = {
        junction: 'J3',
        currentJunction: 'J3',
        path: ['J3', 'J4', 'HOSPITAL'],
        progress: 0
      };
    }

    state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES }, opts);

    const check = checkSafetyInvariant(state, { SAFE_PHASES });
    assert.equal(check.valid, true, `Safety invariant violated at tick ${t}: ${check.reason}`);
  }
});

test('deterministic clearance transitions: GREEN -> YELLOW (3s) -> ALL_RED (2s) -> GREEN', () => {
  let state = createInitialState({}, 101);
  state.activePhases.J1 = 'NORTH_SOUTH';
  state.signalStates.J1 = 'GREEN';
  state.countdowns.J1 = 1;
  state.vehicles.J1 = { north: 0, south: 0, east: 50, west: 50 };
  state.waitingTimes.J1 = { north: 0, south: 0, east: 30, west: 30 };

  // Tick 1: Green countdown reaches 0 -> initiates YELLOW (3s)
  state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES });
  assert.equal(state.signalStates.J1, 'YELLOW');
  assert.equal(state.countdowns.J1, 3);
  assert.equal(state.pendingPhases.J1, 'EAST_WEST');

  // Tick 2: Yellow (countdown 2)
  state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES });
  assert.equal(state.signalStates.J1, 'YELLOW');
  assert.equal(state.countdowns.J1, 2);

  // Tick 3: Yellow (countdown 1)
  state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES });
  assert.equal(state.signalStates.J1, 'YELLOW');
  assert.equal(state.countdowns.J1, 1);

  // Tick 4: Yellow expires -> transitions to ALL_RED (2s)
  state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES });
  assert.equal(state.signalStates.J1, 'ALL_RED');
  assert.equal(state.countdowns.J1, 2);

  // Tick 5: All-Red (countdown 1)
  state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES });
  assert.equal(state.signalStates.J1, 'ALL_RED');
  assert.equal(state.countdowns.J1, 1);

  // Tick 6: All-Red expires -> transitions to GREEN with EAST_WEST
  state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES });
  assert.equal(state.signalStates.J1, 'GREEN');
  assert.equal(state.activePhases.J1, 'EAST_WEST');
  assert.equal(state.pendingPhases.J1, null);
  assert.ok(state.countdowns.J1 >= SIGNAL_CONFIG.minGreenTime);
});

test('starvation override: wait >= maxWaitTime overrides normal priority score', () => {
  let state = createInitialState({}, 202);
  state.activePhases.J2 = 'NORTH_SOUTH';
  state.signalStates.J2 = 'GREEN';
  state.countdowns.J2 = 1;

  state.vehicles.J2 = { north: 40, south: 40, east: 1, west: 0 };
  state.waitingTimes.J2 = { north: 5, south: 5, east: 65, west: 0 };

  state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES });
  assert.equal(state.signalStates.J2, 'YELLOW');
  assert.equal(state.pendingPhases.J2, 'EAST_WEST');
});

test('green duration clamping: dynamic green is clamped between 15s and 60s', () => {
  let state = createInitialState({}, 303);

  // Case 1: Minimum clamping (0 cars waiting)
  state.signalStates.J3 = 'ALL_RED';
  state.countdowns.J3 = 1;
  state.pendingPhases.J3 = 'NORTH_SOUTH';
  state.vehicles.J3 = { north: 0, south: 0, east: 0, west: 0 };
  state.waitingTimes.J3 = { north: 0, south: 0, east: 0, west: 0 };

  state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES }, { arrivalRate: 0 });
  assert.equal(state.signalStates.J3, 'GREEN');
  assert.equal(state.countdowns.J3, SIGNAL_CONFIG.minGreenTime); // 15

  // Case 2: Maximum clamping (massive traffic queue, score > 1000)
  state.signalStates.J3 = 'ALL_RED';
  state.countdowns.J3 = 1;
  state.pendingPhases.J3 = 'NORTH_SOUTH';
  state.vehicles.J3 = { north: 500, south: 500, east: 0, west: 0 };
  state.waitingTimes.J3 = { north: 100, south: 100, east: 0, west: 0 };

  state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES });
  assert.equal(state.signalStates.J3, 'GREEN');
  assert.equal(state.countdowns.J3, SIGNAL_CONFIG.maxGreenTime); // 60
});

// ============================================================================
// PHASE 1 TESTS: #10 Arrivals, #8 Signal Config Sliders, #9 Incidents
// ============================================================================

test('#10 random arrivals: queue cap of 100 is strictly enforced', () => {
  let state = createInitialState({}, 404);
  state.vehicles.J1.north = 99;
  state.arrivalConfig.globalRate = 60;

  for (let i = 0; i < 50; i++) {
    state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES });
    assert.ok(state.vehicles.J1.north <= MAX_QUEUE_CAP, `Queue exceeded cap: ${state.vehicles.J1.north}`);
  }
  assert.equal(state.vehicles.J1.north, 100);
});

test('#10 rush hour preset skews arrivals toward J4 and J2-east', () => {
  const preset = ARRIVAL_PRESETS.RUSH_HOUR;
  assert.ok(preset.globalRate > 30, 'Rush hour rate is elevated');
  assert.equal(preset.multipliers.J2.east, 2.5, 'J2-east multiplier is 2.5x');
  assert.equal(preset.multipliers.J4.north, 2.2, 'J4 north is skewed');
  assert.equal(preset.multipliers.J4.south, 2.5, 'J4 south is skewed');
});

test('#8 validateSignalConfig clamps and guarantees minGreen < maxGreen', () => {
  const invalid = validateSignalConfig({ minGreenTime: 30, maxGreenTime: 20 });
  assert.ok(invalid.minGreenTime < invalid.maxGreenTime);
  assert.equal(invalid.minGreenTime, 30);
  assert.equal(invalid.maxGreenTime, 35);

  const clamped = validateSignalConfig({
    minGreenTime: 1,
    maxGreenTime: 200,
    yellowTime: 10,
    allRedTime: 0,
    maxWaitTime: 200,
    greenFactor: 1.5
  });
  assert.equal(clamped.minGreenTime, 5);
  assert.equal(clamped.maxGreenTime, 120);
  assert.equal(clamped.yellowTime, 6);
  assert.equal(clamped.allRedTime, 1);
  assert.equal(clamped.maxWaitTime, 120);
  assert.equal(clamped.greenFactor, 1.0);
});

test('#8 live signal config changes green factor and duration', () => {
  let state = createInitialState({}, 505);
  state.signalConfig = validateSignalConfig({
    minGreenTime: 10,
    maxGreenTime: 80,
    greenFactor: 1.0
  });
  state.signalStates.J1 = 'ALL_RED';
  state.countdowns.J1 = 1;
  state.pendingPhases.J1 = 'NORTH_SOUTH';
  state.vehicles.J1 = { north: 30, south: 30, east: 0, west: 0 };
  state.waitingTimes.J1 = { north: 10, south: 10, east: 0, west: 0 };

  state = stepNetwork(state, { SAFE_PHASES });
  assert.equal(state.signalStates.J1, 'GREEN');
  assert.ok(state.countdowns.J1 > 40);
});

test('#9 incidents: ROAD_BLOCK stops discharge and diverts new arrivals', () => {
  let state = createInitialState({}, 606);
  state.incidents.J1.north = 'ROAD_BLOCK';
  state.vehicles.J1.north = 20;
  state.activePhases.J1 = 'NORTH_SOUTH';
  state.signalStates.J1 = 'GREEN';
  state.arrivalConfig.globalRate = 60;

  for (let i = 0; i < 10; i++) {
    state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES });
    assert.equal(state.vehicles.J1.north, 20, 'Vehicle count must stay 20 under ROAD_BLOCK');
  }
});

test('#9 incidents: ROAD_BLOCK excludes starvation preemption and ignores queue', () => {
  let state = createInitialState({}, 707);
  state.activePhases.J1 = 'NORTH_SOUTH';
  state.signalStates.J1 = 'GREEN';
  state.countdowns.J1 = 1;

  state.incidents.J1.east = 'ROAD_BLOCK';
  state.vehicles.J1 = { north: 10, south: 10, east: 80, west: 0 };
  state.waitingTimes.J1 = { north: 0, south: 0, east: 90, west: 0 };

  state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES });
  assert.equal(state.signalStates.J1, 'GREEN');
  assert.equal(state.activePhases.J1, 'NORTH_SOUTH');
});

test('#9 incidents: INCIDENT halves discharge rate (50% capacity)', () => {
  let stateNormal = createInitialState({}, 808);
  stateNormal.vehicles.J1.north = 100;
  stateNormal.countdowns.J1 = 9999;
  stateNormal.signalStates.J1 = 'GREEN';
  stateNormal.activePhases.J1 = 'NORTH_SOUTH';

  let stateIncident = createInitialState({}, 808);
  stateIncident.incidents.J1.north = 'INCIDENT';
  stateIncident.vehicles.J1.north = 100;
  stateIncident.countdowns.J1 = 9999;
  stateIncident.signalStates.J1 = 'GREEN';
  stateIncident.activePhases.J1 = 'NORTH_SOUTH';

  for (let i = 0; i < 50; i++) {
    stateNormal = stepNetwork(stateNormal, { SIGNAL_CONFIG, SAFE_PHASES }, { arrivalRate: 0 });
    stateIncident = stepNetwork(stateIncident, { SIGNAL_CONFIG, SAFE_PHASES }, { arrivalRate: 0 });
  }

  const normalDischarge = 100 - stateNormal.vehicles.J1.north;
  const incidentDischarge = 100 - stateIncident.vehicles.J1.north;

  assert.ok(incidentDischarge > 0, 'Incident should still discharge cars');
  assert.ok(incidentDischarge < normalDischarge, 'Incident must discharge fewer cars than normal');
  assert.ok(Math.abs((incidentDischarge / normalDischarge) - 0.5) < 0.25, 'Discharge is approx 50%');
});

// ============================================================================
// PHASE 2 TESTS: #2 Congestion Index, #6 Heat Tinting, #12 Structured Logs
// ============================================================================

test('#2 computeCongestionIndex calculates accurately across 16 approaches', () => {
  // Case A: 0 vehicles, 0 wait -> index is 0
  const emptyVehicles = { J1: { north: 0, south: 0, east: 0, west: 0 }, J2: { north: 0, south: 0, east: 0, west: 0 }, J3: { north: 0, south: 0, east: 0, west: 0 }, J4: { north: 0, south: 0, east: 0, west: 0 } };
  const emptyWaits = { J1: { north: 0, south: 0, east: 0, west: 0 }, J2: { north: 0, south: 0, east: 0, west: 0 }, J3: { north: 0, south: 0, east: 0, west: 0 }, J4: { north: 0, south: 0, east: 0, west: 0 } };
  assert.equal(computeCongestionIndex(emptyVehicles, emptyWaits), 0);

  // Case B: max queue (100) and max wait (60) on all approaches -> index is 100
  const maxVehicles = { J1: { north: 100, south: 100, east: 100, west: 100 }, J2: { north: 100, south: 100, east: 100, west: 100 }, J3: { north: 100, south: 100, east: 100, west: 100 }, J4: { north: 100, south: 100, east: 100, west: 100 } };
  const maxWaits = { J1: { north: 60, south: 60, east: 60, west: 60 }, J2: { north: 60, south: 60, east: 60, west: 60 }, J3: { north: 60, south: 60, east: 60, west: 60 }, J4: { north: 60, south: 60, east: 60, west: 60 } };
  assert.equal(computeCongestionIndex(maxVehicles, maxWaits), 100);

  // Case C: half-congested (50 queue, 30 wait) -> ((50/100)*0.6 + (30/60)*0.4)*100 = (0.3 + 0.2)*100 = 50
  const halfVehicles = { J1: { north: 50, south: 50, east: 50, west: 50 }, J2: { north: 50, south: 50, east: 50, west: 50 }, J3: { north: 50, south: 50, east: 50, west: 50 }, J4: { north: 50, south: 50, east: 50, west: 50 } };
  const halfWaits = { J1: { north: 30, south: 30, east: 30, west: 30 }, J2: { north: 30, south: 30, east: 30, west: 30 }, J3: { north: 30, south: 30, east: 30, west: 30 }, J4: { north: 30, south: 30, east: 30, west: 30 } };
  assert.equal(computeCongestionIndex(halfVehicles, halfWaits), 50);
});

test('#6 heat tinting helper returns correct tint per tier', () => {
  assert.equal(getTierBgTint('LOW'), '#0d2222');
  assert.equal(getTierBgTint('MEDIUM'), '#0c2635');
  assert.equal(getTierBgTint('HIGH'), '#2a2010');
  assert.equal(getTierBgTint('VERY_HIGH'), '#2f121a');
  assert.equal(getTierBgTint(5), '#0d2222'); // <=10 LOW
  assert.equal(getTierBgTint(15), '#0c2635'); // 11-20 MEDIUM
  assert.equal(getTierBgTint(35), '#2a2010'); // 21-50 HIGH
  assert.equal(getTierBgTint(75), '#2f121a'); // >50 VERY_HIGH
});

test('#12 structured decision logs: entries have required schema and cap at 200', () => {
  let state = createInitialState({}, 909);
  state.arrivalConfig.globalRate = 30;

  for (let i = 0; i < 250; i++) {
    state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES });
  }

  assert.ok(state.logs.length > 0, 'Logs must be populated');
  assert.ok(state.logs.length <= 200, `Logs exceeded 200 cap: ${state.logs.length}`);

  const sample = state.logs[0];
  assert.ok(sample.id, 'Log must have id');
  assert.ok(typeof sample.simTime === 'number', 'Log must have simTime');
  assert.ok(['emergency', 'starvation', 'phase_change', 'clearance', 'incident', 'system'].includes(sample.type), `Unknown type: ${sample.type}`);
  assert.ok(typeof sample.message === 'string', 'Log must have message');
});

// ============================================================================
// PHASE 3 TESTS: #1 Fixed-Timer vs AI Adaptive Comparison in Lockstep
// ============================================================================

test('#1 compare mode: identical arrival sequence between Adaptive and Fixed-Timer over 100 ticks', () => {
  const seed = 54321;
  let stateAdaptive = createInitialState({ arrivalRate: 25 }, seed);
  let stateFixed = createInitialState({ arrivalRate: 25, controller: 'fixed', fixedGreenTime: 30 }, seed);

  for (let i = 0; i < 100; i++) {
    stateAdaptive = stepNetwork(stateAdaptive, { SIGNAL_CONFIG, SAFE_PHASES });
    stateFixed = stepNetwork(stateFixed, { SIGNAL_CONFIG, SAFE_PHASES }, { controller: 'fixed' });

    // Arrival PRNG streams across all 16 approaches must stay 100% identical
    for (const jId of ['J1', 'J2', 'J3', 'J4']) {
      for (const dir of ['north', 'south', 'east', 'west']) {
        assert.equal(
          stateAdaptive.rng.arrivals[jId][dir],
          stateFixed.rng.arrivals[jId][dir],
          `Arrival RNG diverged at tick ${i} on ${jId} ${dir}`
        );
      }
    }

    // Cumulative vehicles arrived across the entire network must be identical
    assert.equal(
      stateAdaptive.metrics.totalArrived,
      stateFixed.metrics.totalArrived,
      `Total arrivals diverged at tick ${i}`
    );
  }
});

test('#1 fixed-timer controller strictly alternates safe phases on fixed cycle (30s green, 3s yellow, 2s all-red)', () => {
  let state = createInitialState({ arrivalRate: 0, controller: 'fixed', fixedGreenTime: 30 }, 101);

  // Initial phase is NORTH_SOUTH, GREEN, countdown = 30
  assert.equal(state.signalStates.J1, 'GREEN');
  assert.equal(state.activePhases.J1, 'NORTH_SOUTH');
  assert.equal(state.countdowns.J1, 30);

  // Step 29 seconds: should still be NORTH_SOUTH GREEN
  for (let i = 0; i < 29; i++) {
    state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES }, { controller: 'fixed' });
    assert.equal(state.signalStates.J1, 'GREEN');
    assert.equal(state.activePhases.J1, 'NORTH_SOUTH');
  }
  assert.equal(state.countdowns.J1, 1);

  // Tick 30: timer expires -> switches to YELLOW (3s)
  state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES }, { controller: 'fixed' });
  assert.equal(state.signalStates.J1, 'YELLOW');
  assert.equal(state.countdowns.J1, 3);

  // Tick 31, 32: YELLOW countdown
  state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES }, { controller: 'fixed' });
  assert.equal(state.signalStates.J1, 'YELLOW');
  assert.equal(state.countdowns.J1, 2);

  state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES }, { controller: 'fixed' });
  assert.equal(state.signalStates.J1, 'YELLOW');
  assert.equal(state.countdowns.J1, 1);

  // Tick 33: YELLOW expires -> switches to ALL_RED (2s)
  state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES }, { controller: 'fixed' });
  assert.equal(state.signalStates.J1, 'ALL_RED');
  assert.equal(state.countdowns.J1, 2);

  // Tick 34: ALL_RED countdown
  state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES }, { controller: 'fixed' });
  assert.equal(state.signalStates.J1, 'ALL_RED');
  assert.equal(state.countdowns.J1, 1);

  // Tick 35: ALL_RED expires -> switches strictly to alternate safe phase EAST_WEST GREEN (30s)
  state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES }, { controller: 'fixed' });
  assert.equal(state.signalStates.J1, 'GREEN');
  assert.equal(state.activePhases.J1, 'EAST_WEST');
  assert.equal(state.countdowns.J1, 30);
});

test('#1 ambulance comparison: Fixed-Timer halts ambulance at red light whereas Adaptive preempts', () => {
  const seed = 888;
  // Initialize with J1 NORTH_SOUTH GREEN. Ambulance at J1 needs EAST corridor to reach J2.
  let stateAdaptive = createInitialState({ arrivalRate: 0 }, seed);
  let stateFixed = createInitialState({ arrivalRate: 0, controller: 'fixed', fixedGreenTime: 30 }, seed);

  const amb = {
    junction: 'J1',
    currentJunction: 'J1',
    path: ['J1', 'J2', 'J4', 'HOSPITAL'],
    progress: 0
  };

  stateAdaptive.ambulance = { ...amb };
  stateFixed.ambulance = { ...amb, isWaitingAtRed: false, redWaitTicks: 0 };

  // Fixed controller has J1 on NORTH_SOUTH (east is red).
  // In Fixed mode, ambulance cannot progress and must wait at red light!
  stateFixed = stepNetwork(stateFixed, { SIGNAL_CONFIG, SAFE_PHASES }, { controller: 'fixed' });
  assert.equal(stateFixed.ambulance.progress, 0, 'Ambulance must not advance while light is red in fixed mode');
  assert.equal(stateFixed.ambulance.isWaitingAtRed, true, 'Ambulance must be marked waiting at red');
  assert.ok(stateFixed.ambulance.redWaitTicks >= 1, 'Red wait ticks must increment');

  // In Adaptive mode, emergency triggers transition towards EAST_WEST safe green
  stateAdaptive = stepNetwork(stateAdaptive, { SIGNAL_CONFIG, SAFE_PHASES });
  // Adaptive triggers yellow clearance transition immediately for emergency
  assert.equal(stateAdaptive.signalStates.J1, 'YELLOW');
  assert.equal(stateAdaptive.pendingPhases.J1, 'EAST_WEST');
});

test('#1 compare metrics tracking: cumulativeQueueSum, maxQueue, and totalDischarged accumulated correctly', () => {
  let state = createInitialState({ arrivalRate: 15 }, 4321);

  for (let i = 0; i < 20; i++) {
    state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES });
  }

  assert.ok(typeof state.metrics.cumulativeQueueSum === 'number', 'cumulativeQueueSum must be number');
  assert.ok(state.metrics.cumulativeQueueSum > 0, 'cumulativeQueueSum must accumulate');
  assert.ok(typeof state.metrics.maxQueue === 'number', 'maxQueue must be number');
  assert.ok(state.metrics.maxQueue > 0, 'maxQueue must be tracked');
  assert.ok(typeof state.metrics.totalDischarged === 'number', 'totalDischarged must be tracked');
});

// ============================================================================
// PHASE 4 TESTS: #4 Ambulance Upgrades, Dijkstra Routing, Dual Hospitals
// ============================================================================

test('#4 multiple ambulances: earliest-arrived ambulance is served first at a junction', () => {
  let state = createInitialState({ arrivalRate: 0 }, 999);

  // Amb 1 arrived at tick 5 at J1 needing EAST_WEST (heading to J2)
  const amb1 = {
    id: 'amb-1',
    createdAt: 5,
    junction: 'J1',
    currentJunction: 'J1',
    path: ['J1', 'J2', 'H2'],
    totalDistance: 420,
    progress: 0
  };

  // Amb 2 arrived later at tick 10 at J1 needing NORTH_SOUTH (heading to J3)
  const amb2 = {
    id: 'amb-2',
    createdAt: 10,
    junction: 'J1',
    currentJunction: 'J1',
    path: ['J1', 'J3', 'J4', 'HOSPITAL'],
    totalDistance: 600,
    progress: 0
  };

  state.ambulances = [amb2, amb1]; // unordered in array

  // Current state of J1 is NORTH_SOUTH GREEN.
  // Amb 1 is earliest-arrived and needs EAST_WEST.
  // Junction J1 must prioritize Amb 1's needed phase (EAST_WEST), triggering clearance!
  state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES });

  assert.equal(state.signalStates.J1, 'YELLOW', 'Junction must transition to YELLOW for earliest ambulance');
  assert.equal(state.pendingPhases.J1, 'EAST_WEST', 'Pending phase must be EAST_WEST for earliest ambulance');
});

test('#4 multiple ambulances: ambulances needing the same phase pass together', () => {
  let state = createInitialState({ arrivalRate: 0 }, 1001);

  // Both Amb 1 and Amb 2 are at J1 and both need EAST_WEST (heading towards J2)
  const amb1 = {
    id: 'amb-1',
    createdAt: 1,
    junction: 'J1',
    currentJunction: 'J1',
    path: ['J1', 'J2', 'H2'],
    totalDistance: 420,
    progress: 0
  };

  const amb2 = {
    id: 'amb-2',
    createdAt: 2,
    junction: 'J1',
    currentJunction: 'J1',
    path: ['J1', 'J2', 'J4', 'HOSPITAL'],
    totalDistance: 600,
    progress: 0
  };

  state.ambulances = [amb1, amb2];
  // Force J1 to be GREEN in EAST_WEST
  state.activePhases.J1 = 'EAST_WEST';
  state.signalStates.J1 = 'GREEN';

  state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES });

  // Both ambulances should have advanced together!
  assert.ok(state.ambulances[0].progress > 0, 'Amb 1 must progress');
  assert.ok(state.ambulances[1].progress > 0, 'Amb 2 must progress together with Amb 1');
  assert.equal(state.ambulances[0].isWaitingAtRed, false);
  assert.equal(state.ambulances[1].isWaitingAtRed, false);
});

test('#4 dual hospitals: ambulance successfully reaches destination H2 (Metro Trauma)', () => {
  let state = createInitialState({ arrivalRate: 0 }, 1002);

  const amb = {
    id: 'amb-h2',
    createdAt: 1,
    junction: 'J2',
    currentJunction: 'J2',
    targetHospital: 'H2',
    hospitalName: 'Metro Trauma Center (H2)',
    path: ['J2', 'H2'],
    totalDistance: 160,
    progress: 99
  };

  state.ambulances = [amb];
  state.activePhases.J2 = 'EAST_WEST';
  state.signalStates.J2 = 'GREEN';

  state = stepNetwork(state, { SIGNAL_CONFIG, SAFE_PHASES });

  const finalAmb = state.ambulances[0];
  assert.equal(finalAmb.progress, 100, 'Ambulance should reach 100%');
  assert.equal(finalAmb.arrived, true, 'Ambulance should be marked arrived');
  assert.equal(finalAmb.currentJunction, 'H2', 'Current location should be H2');
});
