import React from 'react';
import { Clock, Zap, Gauge, AlertOctagon } from 'lucide-react';
import { DIRECTIONS, JUNCTIONS } from '../sim/config.js';
import { computeCongestionIndex, getTrafficTier, getTrafficTierColor } from '../sim/tiers.js';

export function KpiStrip({ simState }) {
  const { vehicles, waitingTimes, metrics, tick } = simState;

  // 1. Average wait (queue-weighted mean of approach waits)
  // 2. Longest wait (with junction + direction)
  let totalWaitSeconds = 0;
  let totalCars = 0;
  let longestWaitVal = 0;
  let longestWaitJunction = '';
  let longestWaitDir = '';

  for (const jId of Object.keys(JUNCTIONS)) {
    for (const dir of DIRECTIONS) {
      const c = vehicles[jId]?.[dir] || 0;
      const w = waitingTimes[jId]?.[dir] || 0;
      totalCars += c;
      if (c > 0) {
        totalWaitSeconds += (w * c);
      }
      if (w > longestWaitVal) {
        longestWaitVal = w;
        longestWaitJunction = jId;
        longestWaitDir = dir;
      }
    }
  }

  const avgWait = totalCars > 0 ? (totalWaitSeconds / totalCars).toFixed(1) : '0.0';

  // 3. Throughput (last 60 sim-seconds + total)
  const recentDischarges = metrics?.recentDischarges || [];
  const currentTick = tick || 0;
  const throughput60s = recentDischarges
    .filter((item) => item.tick > currentTick - 60)
    .reduce((sum, item) => sum + item.count, 0);
  const totalDischarged = metrics?.totalDischarged ?? 0;

  // 4. Congestion Index 0-100 color-coded by tier thresholds
  const congestionIndex = computeCongestionIndex(vehicles, waitingTimes);
  const congestionTier = getTrafficTier(congestionIndex);
  const congestionColor = getTrafficTierColor(congestionTier);

  return (
    <section 
      className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:sticky lg:top-2 z-20 bg-[#070b14]/95 backdrop-blur-md py-1 rounded-2xl" 
      aria-label="Network Key Performance Indicators (Sticky)"
    >
      {/* 1. Average Wait */}
      <div className="rounded-xl border border-cyan-500/30 bg-slate-950/80 p-3.5 sm:p-4 shadow-lg">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="text-xs font-mono">Average Wait</span>
          <Clock className="w-4 h-4 text-cyan-400" aria-hidden="true" />
        </div>
        <div className="text-2xl font-black text-white tracking-tight font-mono">{avgWait}s</div>
        <div className="text-[11px] text-slate-400 mt-1">Queue-weighted approach delay</div>
      </div>

      {/* 2. Longest Wait */}
      <div className="rounded-xl border border-rose-500/30 bg-slate-950/80 p-3.5 sm:p-4 shadow-lg">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="text-xs font-mono">Longest Wait</span>
          <AlertOctagon className="w-4 h-4 text-rose-400" aria-hidden="true" />
        </div>
        <div className="text-2xl font-black text-rose-300 tracking-tight font-mono">
          {longestWaitVal}s
        </div>
        <div className="text-[11px] text-slate-400 mt-1 truncate">
          {longestWaitVal > 0 
            ? `${longestWaitJunction} ${longestWaitDir.toUpperCase()} Approach` 
            : 'No waiting vehicles'}
        </div>
      </div>

      {/* 3. Throughput */}
      <div className="rounded-xl border border-emerald-500/30 bg-slate-950/80 p-3.5 sm:p-4 shadow-lg">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="text-xs font-mono">Throughput (60s)</span>
          <Zap className="w-4 h-4 text-emerald-400" aria-hidden="true" />
        </div>
        <div className="text-2xl font-black text-emerald-400 tracking-tight font-mono">
          {throughput60s} <span className="text-xs text-slate-400 font-normal">cars/min</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1">Total discharged: {totalDischarged}</div>
      </div>

      {/* 4. Congestion Index 0-100 */}
      <div 
        className="rounded-xl border bg-slate-950/80 p-3.5 sm:p-4 shadow-lg"
        style={{ borderColor: `${congestionColor}50` }}
      >
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="text-xs font-mono">Congestion Index</span>
          <Gauge className="w-4 h-4" style={{ color: congestionColor }} aria-hidden="true" />
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-black text-white tracking-tight font-mono">
            {congestionIndex.toFixed(1)}
          </div>
          <span 
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase"
            style={{ 
              backgroundColor: `${congestionColor}20`, 
              color: congestionColor,
              border: `1px solid ${congestionColor}40`
            }}
          >
            {congestionTier.replace('_', ' ')}
          </span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1">Weighted queue &amp; wait (0–100)</div>
      </div>
    </section>
  );
}

export default KpiStrip;
