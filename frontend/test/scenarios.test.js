import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILT_IN_SCENARIOS,
  validateScenario,
  exportScenarioAsJson,
  importScenarioFromJson,
  serializeCurrentState
} from '../src/sim/scenarios.js';

test('#7 built-in scenarios: all 3 built-ins validate against schema', () => {
  const proposal = validateScenario(BUILT_IN_SCENARIOS.PROPOSAL_DEFAULT);
  assert.equal(proposal.valid, true);
  assert.equal(proposal.errors.length, 0);
  assert.equal(proposal.sanitizedScenario.name, 'Proposal Default');
  assert.equal(proposal.sanitizedScenario.seed, 1337);
  assert.equal(proposal.sanitizedScenario.fixedTimerCycle, 30);

  const morningRush = validateScenario(BUILT_IN_SCENARIOS.MORNING_RUSH);
  assert.equal(morningRush.valid, true);
  assert.equal(morningRush.errors.length, 0);
  assert.equal(morningRush.sanitizedScenario.name, 'Morning Rush');
  assert.equal(morningRush.sanitizedScenario.seed, 2024);
  assert.equal(morningRush.sanitizedScenario.fixedTimerCycle, 40);
  assert.equal(morningRush.sanitizedScenario.arrivalConfig.globalRate, 35);
  assert.equal(morningRush.sanitizedScenario.arrivalConfig.multipliers.J4.north, 2.5);

  const hospitalRun = validateScenario(BUILT_IN_SCENARIOS.HOSPITAL_RUN);
  assert.equal(hospitalRun.valid, true);
  assert.equal(hospitalRun.errors.length, 0);
  assert.equal(hospitalRun.sanitizedScenario.name, 'Hospital Run');
  assert.equal(hospitalRun.sanitizedScenario.seed, 999);
  assert.equal(hospitalRun.sanitizedScenario.incidents.J1.south, 'ROAD_BLOCK');
});

test('#7 schema validation: validates required fields and handles missing / invalid values', () => {
  // Missing name
  const noName = validateScenario({ ...BUILT_IN_SCENARIOS.PROPOSAL_DEFAULT, name: '' });
  assert.equal(noName.valid, false);
  assert.ok(noName.errors.some((e) => e.includes('name')));

  // Missing seed
  const badSeed = validateScenario({ ...BUILT_IN_SCENARIOS.PROPOSAL_DEFAULT, seed: -10 });
  assert.equal(badSeed.valid, false);
  assert.ok(badSeed.errors.some((e) => e.includes('seed')));

  // minGreen >= maxGreen
  const badTimings = validateScenario({
    ...BUILT_IN_SCENARIOS.PROPOSAL_DEFAULT,
    signalConfig: {
      ...BUILT_IN_SCENARIOS.PROPOSAL_DEFAULT.signalConfig,
      minGreenTime: 50,
      maxGreenTime: 40
    }
  });
  assert.equal(badTimings.valid, false);
  assert.ok(badTimings.errors.some((e) => e.includes('minGreenTime must be strictly less than maxGreenTime')));

  // Invalid incident state
  const badIncident = validateScenario({
    ...BUILT_IN_SCENARIOS.PROPOSAL_DEFAULT,
    incidents: {
      ...BUILT_IN_SCENARIOS.PROPOSAL_DEFAULT.incidents,
      J1: { north: 'EXPLODED', south: 'NORMAL', east: 'NORMAL', west: 'NORMAL' }
    }
  });
  assert.equal(badIncident.valid, false);
  assert.ok(badIncident.errors.some((e) => e.includes('Invalid incident state')));
});

test('#7 schema validation: normalizes spaced keys and clamps vehicle queues to 100', () => {
  const custom = {
    name: 'Spaced Keys Test',
    seed: 42,
    vehicles: {
      J1: { north: 150, south: 20, east: 10, west: 5 },
      J2: { north: 10, south: 10, east: 10, west: 10 },
      J3: { north: 10, south: 10, east: 10, west: 10 },
      J4: { north: 10, south: 10, east: 10, west: 10 }
    },
    'arrival config': {
      globalRate: 20,
      multipliers: {}
    },
    'signal config': {
      minGreen: 15,
      maxGreen: 60,
      yellow: 3,
      allRed: 2,
      starvationThreshold: 60,
      greenFactor: 0.5
    },
    incidents: {
      J1: { north: 'NORMAL', south: 'NORMAL', east: 'NORMAL', west: 'NORMAL' },
      J2: { north: 'NORMAL', south: 'NORMAL', east: 'NORMAL', west: 'NORMAL' },
      J3: { north: 'NORMAL', south: 'NORMAL', east: 'NORMAL', west: 'NORMAL' },
      J4: { north: 'NORMAL', south: 'NORMAL', east: 'NORMAL', west: 'NORMAL' }
    },
    'fixed-timer cycle': 35
  };

  const res = validateScenario(custom);
  assert.equal(res.valid, true);
  // Clamped to 100
  assert.equal(res.sanitizedScenario.vehicles.J1.north, 100);
  assert.equal(res.sanitizedScenario.fixedTimerCycle, 35);
  assert.equal(res.sanitizedScenario.arrivalConfig.globalRate, 20);
});

test('#7 JSON export and import: exports valid JSON and imports with schema validation', () => {
  const jsonStr = exportScenarioAsJson(BUILT_IN_SCENARIOS.MORNING_RUSH);
  assert.ok(typeof jsonStr === 'string');

  const imported = importScenarioFromJson(jsonStr);
  assert.equal(imported.valid, true);
  assert.equal(imported.scenario.name, 'Morning Rush');
  assert.equal(imported.scenario.seed, 2024);
  assert.equal(imported.scenario.arrivalConfig.globalRate, 35);

  // Corrupt JSON string
  const badJson = importScenarioFromJson('{ broken json ...');
  assert.equal(badJson.valid, false);
  assert.ok(badJson.errors[0].includes('JSON parse error'));
});

test('#7 serializeCurrentState: serializes engine state accurately into scenario object', () => {
  const mockState = {
    vehicles: BUILT_IN_SCENARIOS.PROPOSAL_DEFAULT.vehicles,
    arrivalConfig: BUILT_IN_SCENARIOS.PROPOSAL_DEFAULT.arrivalConfig,
    signalConfig: BUILT_IN_SCENARIOS.PROPOSAL_DEFAULT.signalConfig,
    incidents: BUILT_IN_SCENARIOS.PROPOSAL_DEFAULT.incidents,
    fixedGreenTime: 45
  };

  const serialized = serializeCurrentState(mockState, 'Test Scenario', 777, 45);
  assert.equal(serialized.name, 'Test Scenario');
  assert.equal(serialized.seed, 777);
  assert.equal(serialized.fixedTimerCycle, 45);

  const validation = validateScenario(serialized);
  assert.equal(validation.valid, true);
});
