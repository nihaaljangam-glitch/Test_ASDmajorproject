import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTimeLabel,
  createRollingSample,
  filterRollingWindow,
  computeRollingStats,
  generateBaselineHistory,
  exportHistoryToCSV,
  DEFAULT_WINDOW_SECONDS
} from '../src/sim/rollingHistory.js';
import { createInitialState } from '../src/sim/engine.js';

test('rollingHistory - formatTimeLabel produces correct MM:SS strings', () => {
  assert.equal(formatTimeLabel(0), '0:00');
  assert.equal(formatTimeLabel(59), '0:59');
  assert.equal(formatTimeLabel(60), '1:00');
  assert.equal(formatTimeLabel(125), '2:05');
  assert.equal(formatTimeLabel(300), '5:00');
});

test('rollingHistory - createRollingSample aggregates per-junction and network metrics accurately', () => {
  const state = createInitialState({
    initialVehicles: {
      J1: { north: 10, south: 10, east: 5, west: 5 },  // 30
      J2: { north: 5, south: 5, east: 5, west: 5 },    // 20
      J3: { north: 2, south: 2, east: 2, west: 2 },    // 8
      J4: { north: 15, south: 10, east: 5, west: 10 }  // 40
    }
  }, 42);

  const sample = createRollingSample(state, 120);

  assert.equal(sample.simTime, 120);
  assert.equal(sample.timeLabel, '2:00');
  assert.equal(sample.J1_queue, 30);
  assert.equal(sample.J2_queue, 20);
  assert.equal(sample.J3_queue, 8);
  assert.equal(sample.J4_queue, 40);
  assert.equal(sample.totalQueue, 98);
  assert.ok(sample.networkAvgWait >= 0);
  assert.ok(sample.congestionIndex >= 0 && sample.congestionIndex <= 100);
});

test('rollingHistory - filterRollingWindow strictly retains points in the 300s window', () => {
  const points = [
    { simTime: 10, totalQueue: 10 },
    { simTime: 100, totalQueue: 15 },
    { simTime: 200, totalQueue: 20 },
    { simTime: 350, totalQueue: 25 },
    { simTime: 400, totalQueue: 30 }
  ];

  // At currentTick = 400 with 300s window, windowStart = 100. Point at simTime 10 must be excluded.
  const windowed = filterRollingWindow(points, 400, 300);
  assert.equal(windowed.length, 4);
  assert.equal(windowed[0].simTime, 100);
  assert.equal(windowed[windowed.length - 1].simTime, 400);

  // At currentTick = 550, windowStart = 250 -> only 350 and 400 remain
  const trimmed = filterRollingWindow(points, 550, 300);
  assert.equal(trimmed.length, 2);
  assert.equal(trimmed[0].simTime, 350);
});

test('rollingHistory - computeRollingStats calculates peak, averages, and sample count', () => {
  const points = [
    { simTime: 0, totalQueue: 20, networkAvgWait: 5, congestionIndex: 10 },
    { simTime: 10, totalQueue: 40, networkAvgWait: 15, congestionIndex: 25 },
    { simTime: 20, totalQueue: 30, networkAvgWait: 10, congestionIndex: 18 }
  ];

  const stats = computeRollingStats(points);
  assert.equal(stats.sampleCount, 3);
  assert.equal(stats.peakQueue, 40);
  assert.equal(stats.minQueue, 20);
  assert.equal(stats.avgQueue, 30);
  assert.equal(stats.peakWait, 15);
  assert.equal(stats.avgWait, 10);
  assert.equal(stats.peakCongestion, 25);
  assert.equal(stats.avgCongestion, 17.7);
  assert.equal(stats.timeSpan, 20);
});

test('rollingHistory - generateBaselineHistory creates continuous 300s history points', () => {
  const state = createInitialState({}, 42);
  const baseline = generateBaselineHistory(state, DEFAULT_WINDOW_SECONDS, 2);

  assert.equal(baseline.length, 151); // 300 / 2 + 1 = 151 points
  assert.equal(baseline[baseline.length - 1].simTime, 0);
  assert.ok(baseline[0].simTime <= -298);

  for (const pt of baseline) {
    assert.ok(typeof pt.totalQueue === 'number');
    assert.ok(typeof pt.networkAvgWait === 'number');
    assert.ok(typeof pt.J1_queue === 'number');
  }
});

test('rollingHistory - exportHistoryToCSV outputs valid CSV with headers and row data', () => {
  const points = [
    {
      simTime: 0,
      timeLabel: '0:00',
      totalQueue: 20,
      networkAvgWait: 5,
      congestionIndex: 10,
      throughput60s: 2,
      J1_queue: 5,
      J1_wait: 1,
      J2_queue: 5,
      J2_wait: 1,
      J3_queue: 5,
      J3_wait: 1,
      J4_queue: 5,
      J4_wait: 2
    }
  ];

  const csv = exportHistoryToCSV(points);
  assert.ok(csv.startsWith('simTime,timeLabel,totalQueue'));
  const lines = csv.split('\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[1].includes('0,0:00,20,5,10,2,5,1,5,1,5,1,5,2'));
});
