/**
 * Rolling Performance History Service
 * Handles time-windowed sampling, metric aggregation, statistical summaries,
 * and baseline generation for the 5-Minute Performance History charts.
 */

import { JUNCTIONS, DIRECTIONS } from './config.js';
import { computeCongestionIndex } from './tiers.js';

export const DEFAULT_WINDOW_SECONDS = 300; // 5 simulated minutes
export const SAMPLE_INTERVAL_TICKS = 2;   // Sample every 2 sim-seconds

/**
 * Format simulation tick seconds to MM:SS string
 * @param {number} tick - Simulation seconds
 * @returns {string} Formatted time string
 */
export function formatTimeLabel(tick) {
  const t = Math.max(0, Math.floor(tick || 0));
  const mins = Math.floor(t / 60);
  const secs = t % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Create a single point sample from the current simulation state
 * @param {object} simState - Current engine state
 * @param {number} tick - Simulation tick/seconds
 * @returns {object} Sample point object
 */
export function createRollingSample(simState, tick = 0) {
  const vehicles = simState?.vehicles || {};
  const waitingTimes = simState?.waitingTimes || {};
  const metrics = simState?.metrics || {};

  const currentTick = typeof tick === 'number' ? tick : (simState?.tick ?? 0);

  const sample = {
    simTime: currentTick,
    timeLabel: formatTimeLabel(currentTick),
    totalQueue: 0
  };

  let totalWeightedWait = 0;
  let totalNetworkCars = 0;

  for (const jId of Object.keys(JUNCTIONS)) {
    let jQueue = 0;
    let jWaitSum = 0;
    let jCars = 0;

    for (const dir of DIRECTIONS) {
      const c = Number(vehicles[jId]?.[dir]) || 0;
      const w = Number(waitingTimes[jId]?.[dir]) || 0;

      jQueue += c;
      if (c > 0) {
        jCars += c;
        jWaitSum += (w * c);
      }
    }

    sample[`${jId}_queue`] = jQueue;
    sample[`${jId}_wait`] = jCars > 0 ? Math.round((jWaitSum / jCars) * 10) / 10 : 0;

    sample.totalQueue += jQueue;
    totalNetworkCars += jCars;
    totalWeightedWait += jWaitSum;
  }

  // Network aggregate metrics
  sample.networkAvgWait = totalNetworkCars > 0
    ? Math.round((totalWeightedWait / totalNetworkCars) * 10) / 10
    : 0;

  sample.congestionIndex = computeCongestionIndex(vehicles, waitingTimes);

  // Throughput: count of discharges in the last 60s
  const recentDischarges = Array.isArray(metrics.recentDischarges) ? metrics.recentDischarges : [];
  sample.throughput60s = recentDischarges
    .filter((item) => item.tick > currentTick - 60)
    .reduce((sum, item) => sum + (Number(item.count) || 0), 0);

  sample.totalDischarged = Number(metrics.totalDischarged) || 0;

  return sample;
}

/**
 * Filters rolling history to keep only points within the specified window
 * @param {Array<object>} history - Array of sample points
 * @param {number} currentTick - Current simulation time in seconds
 * @param {number} windowSeconds - Rolling window length (default: 300s = 5m)
 * @returns {Array<object>} Trimmed history array
 */
export function filterRollingWindow(history, currentTick, windowSeconds = DEFAULT_WINDOW_SECONDS) {
  if (!Array.isArray(history) || history.length === 0) return [];
  const windowStart = currentTick - windowSeconds;
  return history.filter((pt) => pt.simTime >= windowStart);
}

/**
 * Calculate statistical aggregates across the rolling history window
 * @param {Array<object>} history - Windowed history points
 * @returns {object} Summary statistics
 */
export function computeRollingStats(history = []) {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      peakQueue: 0,
      avgQueue: 0,
      minQueue: 0,
      peakWait: 0,
      avgWait: 0,
      peakCongestion: 0,
      avgCongestion: 0,
      totalDischargedInWindow: 0,
      sampleCount: 0,
      timeSpan: 0
    };
  }

  let maxQueue = 0;
  let minQueue = Infinity;
  let sumQueue = 0;

  let maxWait = 0;
  let sumWait = 0;

  let maxCongestion = 0;
  let sumCongestion = 0;

  for (const pt of history) {
    const q = pt.totalQueue || 0;
    const w = pt.networkAvgWait || 0;
    const c = pt.congestionIndex || 0;

    if (q > maxQueue) maxQueue = q;
    if (q < minQueue) minQueue = q;
    sumQueue += q;

    if (w > maxWait) maxWait = w;
    sumWait += w;

    if (c > maxCongestion) maxCongestion = c;
    sumCongestion += c;
  }

  const count = history.length;
  const earliest = history[0]?.simTime ?? 0;
  const latest = history[history.length - 1]?.simTime ?? 0;

  return {
    peakQueue: maxQueue,
    avgQueue: Math.round((sumQueue / count) * 10) / 10,
    minQueue: minQueue === Infinity ? 0 : minQueue,
    peakWait: Math.round(maxWait * 10) / 10,
    avgWait: Math.round((sumWait / count) * 10) / 10,
    peakCongestion: Math.round(maxCongestion * 10) / 10,
    avgCongestion: Math.round((sumCongestion / count) * 10) / 10,
    sampleCount: count,
    timeSpan: Math.max(0, latest - earliest)
  };
}

/**
 * Generate a pre-seeded baseline rolling history so the chart is immediately active
 * @param {object} initialState - Starting state of the simulation
 * @param {number} baselineSeconds - History span to generate (default: 300s)
 * @param {number} interval - Step interval (default: 2s)
 * @returns {Array<object>} Baseline sample points
 */
export function generateBaselineHistory(initialState, baselineSeconds = DEFAULT_WINDOW_SECONDS, interval = SAMPLE_INTERVAL_TICKS) {
  const points = [];
  const baseSample = createRollingSample(initialState, 0);

  // Generate slightly fluctuating points leading up to tick 0
  const steps = Math.floor(baselineSeconds / interval);

  for (let i = steps; i >= 0; i--) {
    const simTime = i === 0 ? 0 : -(i * interval);
    const noiseFactor = 1 + (Math.sin(i * 0.3) * 0.08); // small natural variation (+-8%)

    const pt = {
      ...baseSample,
      simTime,
      timeLabel: simTime === 0 ? '0:00' : `-${formatTimeLabel(Math.abs(simTime))}`,
      totalQueue: Math.max(0, Math.round(baseSample.totalQueue * noiseFactor)),
      networkAvgWait: Math.max(0, Math.round(baseSample.networkAvgWait * noiseFactor * 10) / 10),
      congestionIndex: Math.max(0, Math.min(100, Math.round(baseSample.congestionIndex * noiseFactor * 10) / 10))
    };

    for (const jId of Object.keys(JUNCTIONS)) {
      pt[`${jId}_queue`] = Math.max(0, Math.round((baseSample[`${jId}_queue`] || 0) * noiseFactor));
      pt[`${jId}_wait`] = Math.max(0, Math.round(((baseSample[`${jId}_wait`] || 0) * noiseFactor) * 10) / 10);
    }

    points.push(pt);
  }

  return points;
}

/**
 * Export history sample points to standard CSV format
 * @param {Array<object>} history - Windowed history points
 * @returns {string} CSV text
 */
export function exportHistoryToCSV(history = []) {
  const headers = [
    'simTime',
    'timeLabel',
    'totalQueue',
    'networkAvgWait',
    'congestionIndex',
    'throughput60s',
    'J1_queue',
    'J1_wait',
    'J2_queue',
    'J2_wait',
    'J3_queue',
    'J3_wait',
    'J4_queue',
    'J4_wait'
  ];

  const rows = [headers.join(',')];

  for (const pt of history) {
    const row = headers.map((key) => pt[key] ?? 0);
    rows.push(row.join(','));
  }

  return rows.join('\n');
}
