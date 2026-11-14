import React, { useState, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';
import { 
  GitCompare, 
  Sparkles, 
  RotateCw, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
  Clock, 
  Zap, 
  AlertTriangle,
  Siren
} from 'lucide-react';

import { JunctionMap } from './JunctionMap.jsx';
import { DIRECTIONS, JUNCTIONS } from '../sim/config.js';

function computeAvgWait(vehicles, waitingTimes) {
  let waitSecs = 0;
  let cars = 0;
  for (const jId of Object.keys(JUNCTIONS)) {
    for (const dir of DIRECTIONS) {
      const c = vehicles[jId]?.[dir] || 0;
      const w = waitingTimes[jId]?.[dir] || 0;
      cars += c;
      if (c > 0) waitSecs += (w * c);
    }
  }
  return cars > 0 ? (waitSecs / cars) : 0;
}

export function CompareView({
  simStateAdaptive,
  simStateFixed,
  selectedJunction,
  onSelectJunction,
  isRunning,
  seed,
  onReseed
}) {
  const [waitHistory, setWaitHistory] = useState([]);
  const lastSampledTickRef = useRef(-1);

  const tick = simStateAdaptive.tick;

  // Clear history on reset
  useEffect(() => {
    if (tick === 0) {
      setWaitHistory([]);
      lastSampledTickRef.current = -1;
    }
  }, [tick]);

  // Sample avg wait every 2 sim-seconds
  useEffect(() => {
    if (tick === lastSampledTickRef.current) return;
    if (tick % 2 !== 0 && waitHistory.length > 0) return;

    lastSampledTickRef.current = tick;

    const adaptAvg = computeAvgWait(simStateAdaptive.vehicles, simStateAdaptive.waitingTimes);
    const fixedAvg = computeAvgWait(simStateFixed.vehicles, simStateFixed.waitingTimes);

    const point = {
      simTime: tick,
      timeLabel: `${Math.floor(tick / 60)}:${String(tick % 60).padStart(2, '0')}`,
      Adaptive: Math.round(adaptAvg * 10) / 10,
      FixedTimer: Math.round(fixedAvg * 10) / 10
    };

    setWaitHistory((prev) => {
      const windowStart = tick - 300;
      const filtered = prev.filter((p) => p.simTime >= windowStart);
      return [...filtered, point];
    });
  }, [tick, simStateAdaptive.vehicles, simStateAdaptive.waitingTimes, simStateFixed.vehicles, simStateFixed.waitingTimes, waitHistory.length]);

  // Calculate metrics for both engines
  const adaptAvgWait = computeAvgWait(simStateAdaptive.vehicles, simStateAdaptive.waitingTimes);
  const fixedAvgWait = computeAvgWait(simStateFixed.vehicles, simStateFixed.waitingTimes);

  const adaptTimeAvgQueue = ((simStateAdaptive.metrics?.cumulativeQueueSum || 0) / Math.max(1, tick)).toFixed(1);
  const fixedTimeAvgQueue = ((simStateFixed.metrics?.cumulativeQueueSum || 0) / Math.max(1, tick)).toFixed(1);

  const adaptMaxQueue = simStateAdaptive.metrics?.maxQueue || 0;
  const fixedMaxQueue = simStateFixed.metrics?.maxQueue || 0;

  const adaptThroughput = simStateAdaptive.metrics?.totalDischarged || 0;
  const fixedThroughput = simStateFixed.metrics?.totalDischarged || 0;

  const adaptStarvations = simStateAdaptive.metrics?.starvationEventsCount || 0;
  const fixedStarvations = simStateFixed.metrics?.starvationEventsCount || 0;

  // Improvement calculations
  // Lower is better: (Fixed - Adaptive) / Fixed * 100
  const calcLowerIsBetterImp = (fixedVal, adaptVal) => {
    if (fixedVal === 0 && adaptVal === 0) return { pct: 0, isBetter: true };
    if (fixedVal === 0) return { pct: 0, isBetter: false };
    const pct = Math.round(((fixedVal - adaptVal) / fixedVal) * 100);
    return { pct, isBetter: pct >= 0 };
  };

  // Higher is better: (Adaptive - Fixed) / Fixed * 100
  const calcHigherIsBetterImp = (fixedVal, adaptVal) => {
    if (fixedVal === 0 && adaptVal === 0) return { pct: 0, isBetter: true };
    if (fixedVal === 0) return { pct: adaptVal > 0 ? 100 : 0, isBetter: true };
    const pct = Math.round(((adaptVal - fixedVal) / fixedVal) * 100);
    return { pct, isBetter: pct >= 0 };
  };

  const waitImp = calcLowerIsBetterImp(fixedAvgWait, adaptAvgWait);
  const queueImp = calcLowerIsBetterImp(Number(fixedTimeAvgQueue), Number(adaptTimeAvgQueue));
  const peakImp = calcLowerIsBetterImp(fixedMaxQueue, adaptMaxQueue);
  const throughputImp = calcHigherIsBetterImp(fixedThroughput, adaptThroughput);
  const starvImp = calcLowerIsBetterImp(fixedStarvations, adaptStarvations);

  const renderBadge = (imp) => {
    const isGreen = imp.isBetter;
    const sign = imp.pct > 0 ? '+' : '';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold border ${
        isGreen 
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
      }`}>
        {isGreen ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
        {sign}{imp.pct}% {isGreen ? 'Better' : 'Worse'}
      </span>
    );
  };

  return (
    <div className="space-y-6" aria-label="Compare Mode: Fixed-Timer vs AI Adaptive">
      {/* Compare Mode Header Banner */}
      <div className="bg-[#0b1329] border border-cyan-500/40 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <GitCompare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white">
                Controller Comparison Mode (Lockstep Simulation)
              </h2>
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold border border-cyan-500/40">
                FLAGSHIP
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Two parallel simulation engines running from the exact same arrival stream &amp; seed.
            </p>
          </div>
        </div>

        {/* Seed Info & Reseed Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Seed: <strong className="text-white">#{seed}</strong> (Identical Arrivals)</span>
          </div>

          {onReseed && (
            <button
              type="button"
              onClick={onReseed}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center gap-1.5"
              title="Pick a new random seed and reset both runs"
            >
              <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Re-run with new seed</span>
            </button>
          )}
        </div>
      </div>

      {/* Two Compact Maps Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Map A: Fixed-Timer Controller */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              Controller A: Fixed-Timer (Baseline 30s)
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              No Priority &bull; No Preemption
            </span>
          </div>
          <JunctionMap
            simState={simStateFixed}
            selectedJunction={selectedJunction}
            onSelectJunction={onSelectJunction}
            isRunning={isRunning}
            compact={true}
            title="Fixed-Timer Baseline Controller"
          />
          {simStateFixed.ambulance && (
            <div className={`p-2 rounded-xl text-xs font-mono border ${
              simStateFixed.ambulance.isWaitingAtRed
                ? 'bg-rose-950/40 border-rose-500/50 text-rose-300 animate-pulse'
                : 'bg-amber-950/20 border-amber-500/40 text-amber-300'
            }`}>
              <div className="flex items-center gap-1.5">
                <Siren className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>
                  {simStateFixed.ambulance.progress >= 100
                    ? '🏥 Ambulance reached City Hospital!'
                    : simStateFixed.ambulance.isWaitingAtRed
                    ? `🛑 Ambulance HALTED at ${simStateFixed.ambulance.currentJunction} RED LIGHT (${simStateFixed.ambulance.redWaitTicks || 0}s delay)`
                    : `🚑 Ambulance moving at ${simStateFixed.ambulance.currentJunction} (${simStateFixed.ambulance.progress}%)`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Map B: AI Adaptive Controller */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              Controller B: AI Adaptive (TrafficFlow-AI)
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Safe Opposing Phases &bull; Preemption
            </span>
          </div>
          <JunctionMap
            simState={simStateAdaptive}
            selectedJunction={selectedJunction}
            onSelectJunction={onSelectJunction}
            isRunning={isRunning}
            compact={true}
            title="AI Adaptive Safe Controller"
          />
          {simStateAdaptive.ambulance && (
            <div className="p-2 rounded-xl text-xs font-mono bg-emerald-950/30 border border-emerald-500/50 text-emerald-300">
              <div className="flex items-center gap-1.5">
                <Siren className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  {simStateAdaptive.ambulance.progress >= 100
                    ? '🏥 Ambulance safely arrived at City Hospital (Corridor Preempted)!'
                    : `🟢 Emergency Preempted: Safe corridor GREEN at ${simStateAdaptive.ambulance.currentJunction} (${simStateAdaptive.ambulance.progress}%)`}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Comparison Table */}
      <section 
        className="rounded-2xl bg-[#0b1329] border border-slate-800 p-4 sm:p-5 space-y-4 shadow-xl"
        aria-label="Comparative Performance Metrics Table"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Real-Time Comparative Metrics (Fixed-Timer vs AI Adaptive)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Evaluated simultaneously over {tick} simulated seconds
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-left">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                <th className="py-2.5 px-3">Performance Metric</th>
                <th className="py-2.5 px-3 text-amber-400">Fixed-Timer (Baseline)</th>
                <th className="py-2.5 px-3 text-cyan-400">AI Adaptive</th>
                <th className="py-2.5 px-3 text-right">Advantage / % Improvement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              <tr>
                <td className="py-3 px-3 font-sans font-bold text-white flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  Average Wait Time
                </td>
                <td className="py-3 px-3 text-slate-300 font-bold">{fixedAvgWait.toFixed(1)}s</td>
                <td className="py-3 px-3 text-emerald-300 font-bold">{adaptAvgWait.toFixed(1)}s</td>
                <td className="py-3 px-3 text-right">{renderBadge(waitImp)}</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-sans font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                  Average Queue Length (Time-Avg)
                </td>
                <td className="py-3 px-3 text-slate-300 font-bold">{fixedTimeAvgQueue} cars</td>
                <td className="py-3 px-3 text-emerald-300 font-bold">{adaptTimeAvgQueue} cars</td>
                <td className="py-3 px-3 text-right">{renderBadge(queueImp)}</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-sans font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-cyan-400" />
                  Max Queue (Peak Backlog)
                </td>
                <td className="py-3 px-3 text-slate-300 font-bold">{fixedMaxQueue} vehicles</td>
                <td className="py-3 px-3 text-emerald-300 font-bold">{adaptMaxQueue} vehicles</td>
                <td className="py-3 px-3 text-right">{renderBadge(peakImp)}</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-sans font-bold text-white flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  Throughput (Total Discharged)
                </td>
                <td className="py-3 px-3 text-slate-300 font-bold">{fixedThroughput} vehicles</td>
                <td className="py-3 px-3 text-emerald-300 font-bold">{adaptThroughput} vehicles</td>
                <td className="py-3 px-3 text-right">{renderBadge(throughputImp)}</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-sans font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  Starvation Incidents (&ge; 60s)
                </td>
                <td className="py-3 px-3 text-slate-300 font-bold">{fixedStarvations} events</td>
                <td className="py-3 px-3 text-emerald-300 font-bold">{adaptStarvations} events</td>
                <td className="py-3 px-3 text-right">{renderBadge(starvImp)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Live Dual-Line Chart of Avg Wait */}
      <section 
        className="rounded-2xl bg-[#0b1329] border border-slate-800 p-4 sm:p-5 space-y-4 shadow-xl"
        aria-label="Live Line Chart: Average Wait Time Comparison"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-emerald-400" />
              Live Delay Comparison: Fixed-Timer vs AI Adaptive
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Tracking network delay divergence over the last 5 simulated minutes
            </p>
          </div>
        </div>

        <div className="w-full h-64 pt-2">
          {waitHistory.length < 2 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-xs font-mono border border-dashed border-slate-800 rounded-xl">
              <span>Sampling comparison stream every 2 seconds…</span>
              <span className="text-[11px] text-slate-600 mt-1">Start simulation or step to draw live curves</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={waitHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="timeLabel" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#070b14',
                    borderColor: '#1e293b',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    color: '#f8fafc',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)'
                  }}
                  formatter={(val, name) => [`${val}s delay`, name === 'Adaptive' ? 'AI Adaptive' : 'Fixed-Timer Baseline']}
                  labelFormatter={(lbl) => `Sim Time: ${lbl}`}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line
                  type="monotone"
                  dataKey="FixedTimer"
                  name="Fixed-Timer (Baseline)"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="Adaptive"
                  name="AI Adaptive (TrafficFlow-AI)"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  );
}

export default CompareView;
