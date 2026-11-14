import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeMode,
  getPhases,
  phaseForDirection,
  greenDirections,
  nextPhaseCandidates,
  getDirectionalSignalStates
} from '../src/sim/phases.js';

import {
  TRAFFIC_TIERS,
  TIER_COLORS,
  getTrafficTier,
  getTrafficTierColor,
  getTierBgTint
} from '../src/sim/tiers.js';

/* -------------------------------------------------------------------------
   1. phases.js: Invariants for both modes, nextPhaseCandidates, phaseForDirection
   ------------------------------------------------------------------------- */

test('phases.js - SINGLE mode invariants: strictly one green at a time, clearance rules', () => {
  const singlePhases = getPhases('SINGLE');
  assert.equal(singlePhases.length, 4);
  assert.deepEqual([...singlePhases], ['NORTH', 'EAST', 'SOUTH', 'WEST']);

  // Every single phase must activate exactly ONE direction
  for (const phase of singlePhases) {
    const greens = greenDirections(phase);
    assert.equal(greens.length, 1, `Phase ${phase} in SINGLE mode must have exactly 1 green approach`);
  }
  assert.deepEqual(greenDirections('NORTH'), ['north']);
  assert.deepEqual(greenDirections('EAST'), ['east']);
  assert.deepEqual(greenDirections('SOUTH'), ['south']);
  assert.deepEqual(greenDirections('WEST'), ['west']);

  // Directional states on GREEN: exactly 1 green approach, remaining 3 red
  for (const phase of singlePhases) {
    const states = getDirectionalSignalStates(phase, 'GREEN');
    const greenList = Object.entries(states).filter(([, st]) => st === 'GREEN').map(([dir]) => dir);
    const redList = Object.entries(states).filter(([, st]) => st === 'RED').map(([dir]) => dir);
    const yellowList = Object.entries(states).filter(([, st]) => st === 'YELLOW').map(([dir]) => dir);

    assert.equal(greenList.length, 1, `Phase ${phase} must have exactly 1 green approach`);
    assert.equal(redList.length, 3, `Phase ${phase} must have 3 red approaches`);
    assert.equal(yellowList.length, 0, 'No yellow signals allowed during GREEN state');
    assert.equal(greenList[0], phase.toLowerCase());
  }

  // Directional states on YELLOW: exactly 1 yellow approach, 3 red, NO green
  for (const phase of singlePhases) {
    const states = getDirectionalSignalStates(phase, 'YELLOW');
    const greenList = Object.entries(states).filter(([, st]) => st === 'GREEN').map(([dir]) => dir);
    const yellowList = Object.entries(states).filter(([, st]) => st === 'YELLOW').map(([dir]) => dir);
    const redList = Object.entries(states).filter(([, st]) => st === 'RED').map(([dir]) => dir);

    assert.equal(greenList.length, 0, 'No green signals during YELLOW clearance');
    assert.equal(yellowList.length, 1, `Phase ${phase} must have exactly 1 yellow approach`);
    assert.equal(redList.length, 3, `Phase ${phase} must have 3 red approaches`);
    assert.equal(yellowList[0], phase.toLowerCase());
  }

  // Directional states on ALL_RED: all 4 directions are strictly RED
  for (const phase of singlePhases) {
    const states = getDirectionalSignalStates(phase, 'ALL_RED');
    assert.deepEqual(states, {
      north: 'RED',
      south: 'RED',
      east: 'RED',
      west: 'RED'
    });
  }
});

test('phases.js - PAIR mode invariants: opposing approaches only, clearance rules', () => {
  const pairPhases = getPhases('PAIR');
  assert.equal(pairPhases.length, 2);
  assert.deepEqual([...pairPhases], ['NORTH_SOUTH', 'EAST_WEST']);

  // Only opposing pairs are green together
  assert.deepEqual(greenDirections('NORTH_SOUTH'), ['north', 'south']);
  assert.deepEqual(greenDirections('EAST_WEST'), ['east', 'west']);

  // Conflicting adjacent approaches must NEVER be green together
  const nsGreens = greenDirections('NORTH_SOUTH');
  assert.ok(!nsGreens.includes('east') && !nsGreens.includes('west'));
  const ewGreens = greenDirections('EAST_WEST');
  assert.ok(!ewGreens.includes('north') && !ewGreens.includes('south'));

  // Directional states in PAIR mode
  const nsGreenStates = getDirectionalSignalStates('NORTH_SOUTH', 'GREEN');
  assert.equal(nsGreenStates.north, 'GREEN');
  assert.equal(nsGreenStates.south, 'GREEN');
  assert.equal(nsGreenStates.east, 'RED');
  assert.equal(nsGreenStates.west, 'RED');

  const ewYellowStates = getDirectionalSignalStates('EAST_WEST', 'YELLOW');
  assert.equal(ewYellowStates.east, 'YELLOW');
  assert.equal(ewYellowStates.west, 'YELLOW');
  assert.equal(ewYellowStates.north, 'RED');
  assert.equal(ewYellowStates.south, 'RED');

  const allRedStates = getDirectionalSignalStates('NORTH_SOUTH', 'ALL_RED');
  assert.deepEqual(allRedStates, {
    north: 'RED',
    south: 'RED',
    east: 'RED',
    west: 'RED'
  });
});

test('phases.js - nextPhaseCandidates helper for SINGLE and PAIR modes', () => {
  // SINGLE mode: 3 candidates excluding active phase
  assert.deepEqual(nextPhaseCandidates('SINGLE', 'NORTH'), ['EAST', 'SOUTH', 'WEST']);
  assert.deepEqual(nextPhaseCandidates('SINGLE', 'EAST'), ['NORTH', 'SOUTH', 'WEST']);
  assert.deepEqual(nextPhaseCandidates('SINGLE', 'SOUTH'), ['NORTH', 'EAST', 'WEST']);
  assert.deepEqual(nextPhaseCandidates('SINGLE', 'WEST'), ['NORTH', 'EAST', 'SOUTH']);
  assert.deepEqual(nextPhaseCandidates('SINGLE', null), ['NORTH', 'EAST', 'SOUTH', 'WEST']);

  // Immutability check: candidates array must be fresh and not mutate original
  const c1 = nextPhaseCandidates('SINGLE', 'NORTH');
  c1.push('MUTATION_TEST');
  const c2 = nextPhaseCandidates('SINGLE', 'NORTH');
  assert.equal(c2.length, 3);

  // PAIR mode: alternate phase only
  assert.deepEqual(nextPhaseCandidates('PAIR', 'NORTH_SOUTH'), ['EAST_WEST']);
  assert.deepEqual(nextPhaseCandidates('PAIR', 'EAST_WEST'), ['NORTH_SOUTH']);
  assert.deepEqual(nextPhaseCandidates('PAIR', null), ['NORTH_SOUTH', 'EAST_WEST']);
});

test('phases.js - phaseForDirection mapping for SINGLE and PAIR modes', () => {
  // SINGLE mode: direct 1:1 mapping (case insensitive)
  assert.equal(phaseForDirection('SINGLE', 'north'), 'NORTH');
  assert.equal(phaseForDirection('SINGLE', 'NORTH'), 'NORTH');
  assert.equal(phaseForDirection('SINGLE', 'east'), 'EAST');
  assert.equal(phaseForDirection('SINGLE', 'EAST'), 'EAST');
  assert.equal(phaseForDirection('SINGLE', 'south'), 'SOUTH');
  assert.equal(phaseForDirection('SINGLE', 'SOUTH'), 'SOUTH');
  assert.equal(phaseForDirection('SINGLE', 'west'), 'WEST');
  assert.equal(phaseForDirection('SINGLE', 'WEST'), 'WEST');

  // PAIR mode: opposing approaches map to shared corridor phase
  assert.equal(phaseForDirection('PAIR', 'north'), 'NORTH_SOUTH');
  assert.equal(phaseForDirection('PAIR', 'south'), 'NORTH_SOUTH');
  assert.equal(phaseForDirection('PAIR', 'NORTH'), 'NORTH_SOUTH');
  assert.equal(phaseForDirection('PAIR', 'SOUTH'), 'NORTH_SOUTH');

  assert.equal(phaseForDirection('PAIR', 'east'), 'EAST_WEST');
  assert.equal(phaseForDirection('PAIR', 'west'), 'EAST_WEST');
  assert.equal(phaseForDirection('PAIR', 'EAST'), 'EAST_WEST');
  assert.equal(phaseForDirection('PAIR', 'WEST'), 'EAST_WEST');
});

/* -------------------------------------------------------------------------
   2. Tier Helper Boundaries (10/11, 20/21, 50/51)
   ------------------------------------------------------------------------- */

test('Tier helper - exact boundary transitions at 10/11, 20/21, and 50/51', () => {
  // Boundary 1: 10 vs 11
  assert.equal(getTrafficTier(10), TRAFFIC_TIERS.LOW, '10 cars must be LOW tier');
  assert.equal(getTrafficTier(11), TRAFFIC_TIERS.MEDIUM, '11 cars must be MEDIUM tier');

  // Boundary 2: 20 vs 21
  assert.equal(getTrafficTier(20), TRAFFIC_TIERS.MEDIUM, '20 cars must be MEDIUM tier');
  assert.equal(getTrafficTier(21), TRAFFIC_TIERS.HIGH, '21 cars must be HIGH tier');

  // Boundary 3: 50 vs 51
  assert.equal(getTrafficTier(50), TRAFFIC_TIERS.HIGH, '50 cars must be HIGH tier');
  assert.equal(getTrafficTier(51), TRAFFIC_TIERS.VERY_HIGH, '51 cars must be VERY_HIGH tier');
});

test('Tier helper - colors and background tints at exact boundaries', () => {
  // 10 -> LOW (#10b981)
  assert.equal(getTrafficTierColor(10), TIER_COLORS.LOW);
  assert.equal(getTrafficTierColor(10), '#10b981');
  assert.equal(getTierBgTint(10), '#0d2222');

  // 11 -> MEDIUM (#06b6d4)
  assert.equal(getTrafficTierColor(11), TIER_COLORS.MEDIUM);
  assert.equal(getTrafficTierColor(11), '#06b6d4');
  assert.equal(getTierBgTint(11), '#0c2635');

  // 20 -> MEDIUM (#06b6d4)
  assert.equal(getTrafficTierColor(20), TIER_COLORS.MEDIUM);
  assert.equal(getTrafficTierColor(20), '#06b6d4');

  // 21 -> HIGH (#f59e0b)
  assert.equal(getTrafficTierColor(21), TIER_COLORS.HIGH);
  assert.equal(getTrafficTierColor(21), '#f59e0b');
  assert.equal(getTierBgTint(21), '#2a2010');

  // 50 -> HIGH (#f59e0b)
  assert.equal(getTrafficTierColor(50), TIER_COLORS.HIGH);
  assert.equal(getTrafficTierColor(50), '#f59e0b');

  // 51 -> VERY_HIGH (#f43f5e)
  assert.equal(getTrafficTierColor(51), TIER_COLORS.VERY_HIGH);
  assert.equal(getTrafficTierColor(51), '#f43f5e');
  assert.equal(getTierBgTint(51), '#2f121a');
});

test('Tier helper - edge cases and string conversions across boundary values', () => {
  // Negative values and zero
  assert.equal(getTrafficTier(0), 'LOW');
  assert.equal(getTrafficTier(-1), 'LOW');
  assert.equal(getTrafficTier(-100), 'LOW');

  // String numeric inputs
  assert.equal(getTrafficTier('10'), 'LOW');
  assert.equal(getTrafficTier('11'), 'MEDIUM');
  assert.equal(getTrafficTier('20'), 'MEDIUM');
  assert.equal(getTrafficTier('21'), 'HIGH');
  assert.equal(getTrafficTier('50'), 'HIGH');
  assert.equal(getTrafficTier('51'), 'VERY_HIGH');

  // Fractional boundary values
  assert.equal(getTrafficTier(10.0), 'LOW');
  assert.equal(getTrafficTier(10.01), 'MEDIUM');
  assert.equal(getTrafficTier(20.0), 'MEDIUM');
  assert.equal(getTrafficTier(20.01), 'HIGH');
  assert.equal(getTrafficTier(50.0), 'HIGH');
  assert.equal(getTrafficTier(50.01), 'VERY_HIGH');

  // Null, undefined, NaN fallback to LOW
  assert.equal(getTrafficTier(null), 'LOW');
  assert.equal(getTrafficTier(undefined), 'LOW');
  assert.equal(getTrafficTier(NaN), 'LOW');
});
