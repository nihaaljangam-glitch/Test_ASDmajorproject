import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  stepNetwork
} from '../src/sim/engine.js';
import {
  DEFAULT_ARRIVAL_RATE,
  DEFAULT_ARRIVAL_CONFIG,
  MAX_QUEUE_CAP,
  JUNCTIONS,
  SIGNAL_CONFIG,
  SAFE_PHASES,
  EXIT_DIRECTIONS
} from '../src/sim/config.js';

test('traffic-flow Part 2 #1: default arrival rate is 8 cars/min and rush hour multiplier is 2.5x', () => {
  assert.equal(DEFAULT_ARRIVAL_RATE, 8);
  assert.equal(DEFAULT_ARRIVAL_CONFIG.globalRate, 8);
  assert.equal(DEFAULT_ARRIVAL_CONFIG.rushHourMultiplier, 2.5);

  const state = createInitialState({ arrivalConfig: { globalRate: 8, isRushHour: false } }, 42);
  assert.equal(state.arrivalConfig.globalRate, 8);
  assert.equal(state.arrivalConfig.isRushHour, false);

  // Normal flow step
  const nextNormal = stepNetwork(state, { JUNCTIONS, SIGNAL_CONFIG, SAFE_PHASES, EXIT_DIRECTIONS });
  assert.equal(nextNormal.arrivalConfig.globalRate, 8);
  assert.equal(nextNormal.arrivalConfig.isRushHour, false);

  // Rush hour active step (2.5x)
  const nextRush = stepNetwork(state, { JUNCTIONS, SIGNAL_CONFIG, SAFE_PHASES, EXIT_DIRECTIONS }, { isRushHour: true });
  assert.equal(nextRush.arrivalConfig.isRushHour, true);
  assert.equal(nextRush.arrivalConfig.rushHourMultiplier, 2.5);
});

test('traffic-flow Part 2 #1: queue cap of 100 per approach is strictly maintained under high arrival flow', () => {
  const initialVehicles = {
    J1: { north: 98, south: 99, east: 100, west: 97 },
    J2: { north: 95, south: 95, east: 95, west: 95 },
    J3: { north: 95, south: 95, east: 95, west: 95 },
    J4: { north: 95, south: 95, east: 95, west: 95 }
  };

  let state = createInitialState({
    initialVehicles,
    arrivalConfig: { globalRate: 40, isRushHour: true }
  }, 101);

  for (let t = 0; t < 50; t++) {
    state = stepNetwork(state, { JUNCTIONS, SIGNAL_CONFIG, SAFE_PHASES, EXIT_DIRECTIONS }, { arrivalRate: 40, isRushHour: true });
    for (const jId of Object.keys(JUNCTIONS)) {
      for (const dir of ['north', 'south', 'east', 'west']) {
        assert.ok(
          state.vehicles[jId][dir] <= MAX_QUEUE_CAP,
          `Queue at ${jId} ${dir} exceeded MAX_QUEUE_CAP: ${state.vehicles[jId][dir]} > ${MAX_QUEUE_CAP}`
        );
      }
    }
  }
});

test('traffic-flow Part 2 #4: stepNetwork pushes discharge events {junction, direction, count} into return object', () => {
  const initialVehicles = {
    J1: { north: 10, south: 0, east: 0, west: 0 },
    J2: { north: 0, south: 0, east: 0, west: 0 },
    J3: { north: 0, south: 0, east: 0, west: 0 },
    J4: { north: 0, south: 0, east: 0, west: 0 }
  };

  const state = createInitialState({
    initialVehicles,
    phasingMode: 'SINGLE',
    initialActivePhases: { J1: 'NORTH', J2: 'EAST', J3: 'SOUTH', J4: 'WEST' },
    initialSignalStates: { J1: 'GREEN', J2: 'GREEN', J3: 'GREEN', J4: 'GREEN' }
  }, 777);

  let hasDischarged = false;
  let s = state;

  for (let t = 0; t < 10; t++) {
    s = stepNetwork(s, { JUNCTIONS, SIGNAL_CONFIG, SAFE_PHASES, EXIT_DIRECTIONS });
    if (s.dischargeEvents && s.dischargeEvents.length > 0) {
      hasDischarged = true;
      for (const evt of s.dischargeEvents) {
        assert.ok(evt.junction);
        assert.ok(evt.direction);
        assert.ok(typeof evt.count === 'number' && evt.count > 0);
        assert.ok(typeof evt.tick === 'number');
      }
    }
  }

  assert.ok(hasDischarged, 'Simulation loop must push discharge events when vehicles discharge on green');
});
