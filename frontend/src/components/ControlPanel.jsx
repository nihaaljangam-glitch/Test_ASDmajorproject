import React from 'react';
import { Sliders, Compass, AlertTriangle, ShieldAlert, CheckCircle, Flame } from 'lucide-react';
import { JUNCTIONS, SAFE_PHASES, DIRECTIONS } from '../sim/config.js';
import { computePriority } from '../sim/engine.js';
import { getTrafficTier } from '../sim/tiers.js';
import { getPhases, greenDirections, normalizeMode } from '../sim/phases.js';

export function ControlPanel({
  simState,
  selectedJunction,
  onSelectJunction,
  onDirectionChange,
  onApplyPreset,
  onCycleIncident,
  onSetApproachMultiplier,
  isRunning
}) {
  const { vehicles, waitingTimes, activePhases, signalStates, countdowns, incidents, arrivalConfig } = simState;

  const selectedCounts = vehicles[selectedJunction] || { north: 0, south: 0, east: 0, west: 0 };
  const selectedWaits = waitingTimes[selectedJunction] || { north: 0, south: 0, east: 0, west: 0 };
  const selectedTotal = Object.values(selectedCounts).reduce((a, b) => a + Number(b), 0);
  const selectedPhase = activePhases[selectedJunction];
  const selectedState = signalStates[selectedJunction];
  const selectedTimer = countdowns[selectedJunction];

  const getScore = (dir) => {
    if (incidents?.[selectedJunction]?.[dir] === 'ROAD_BLOCK') return 0;
    return computePriority(selectedCounts[dir], selectedWaits[dir]);
  };

  const nsScore = getScore('north') + getScore('south');
  const ewScore = getScore('east') + getScore('west');

  const globalRate = arrivalConfig?.globalRate ?? 15;

  return (
    <section 
      className="rounded-2xl bg-[#0b1329] border border-slate-800 p-4 sm:p-5 space-y-4"
      aria-labelledby="controls-heading"
    >
      {/* Top Header & Preset Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
        <div>
          <h3 id="controls-heading" className="text-sm font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" aria-hidden="true" />
            Control Approaches for: <span className="text-cyan-400 font-mono">{selectedJunction}</span> ({JUNCTIONS[selectedJunction]?.label})
          </h3>
          <span className="text-xs text-slate-400">Total Waiting at {selectedJunction}: {selectedTotal} vehicles (Cap: 100)</span>
        </div>

        {/* Presets */}
        <div className="flex gap-1.5" role="group" aria-label="Traffic Presets">
          <button
            type="button"
            onClick={() => onApplyPreset('DEFAULT')}
            className="px-2.5 py-1 text-[11px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Proposal
          </button>
          <button
            type="button"
            onClick={() => onApplyPreset('BALANCED')}
            className="px-2.5 py-1 text-[11px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Balanced
          </button>
          <button
            type="button"
            onClick={() => onApplyPreset('RUSH_HOUR')}
            className="px-2.5 py-1 text-[11px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Rush Hour
          </button>
        </div>
      </div>

      {/* Junction Selector Tabs */}
      <div className="grid grid-cols-4 gap-2" role="tablist" aria-label="Select Junction to Inspect">
        {Object.values(JUNCTIONS).map((j) => {
          const total = Object.values(vehicles[j.id]).reduce((a, b) => a + Number(b), 0);
          const isSelected = selectedJunction === j.id;
          const ph = activePhases[j.id];

          return (
            <button
              key={j.id}
              role="tab"
              aria-selected={isSelected}
              aria-controls={`panel-${j.id}`}
              id={`tab-${j.id}`}
              onClick={() => onSelectJunction(j.id)}
              className={`py-2 px-2 sm:px-3 rounded-xl border text-xs font-mono font-bold transition-all flex flex-col items-center ${
                isSelected
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 ring-1 ring-cyan-400/40'
                  : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:bg-slate-900'
              }`}
            >
              <span>{j.id}</span>
              <span className="text-[10px] opacity-70">{total} cars &bull; {ph}</span>
            </button>
          );
        })}
      </div>

      {/* Safe Phase Comparison Box */}
      {(() => {
        const mode = normalizeMode(simState?.phasingMode);
        const currentPhases = getPhases(mode);

        return (
          <div className={`grid grid-cols-1 ${mode === 'SINGLE' ? 'sm:grid-cols-4' : 'sm:grid-cols-2'} gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono`}>
            {currentPhases.map((pKey) => {
              const pDef = currentPhases[pKey] || {};
              const pDirs = greenDirections(pKey);
              const pScore = pDirs.reduce((sum, d) => sum + (incidents?.[selectedJunction]?.[d] === 'ROAD_BLOCK' ? 0 : getScore(d)), 0);
              const isActive = selectedPhase === pKey && selectedState === 'GREEN';

              return (
                <div
                  key={pKey}
                  className={`p-2.5 rounded-lg border transition-all ${
                    isActive
                      ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300 ring-1 ring-emerald-500/30'
                      : 'border-slate-800 bg-slate-900/40 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="truncate">{pDef.shortLabel || pKey}</span>
                    {isActive && (
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-black shrink-0">ACTIVE</span>
                    )}
                  </div>
                  <div className="text-[11px] mt-1 text-slate-300">
                    Priority: <strong className="text-white">{pScore}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* 4 Directional Sliders for Selected Junction */}
      <div 
        id={`panel-${selectedJunction}`}
        role="tabpanel"
        aria-labelledby={`tab-${selectedJunction}`}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1"
      >
        {DIRECTIONS.map((dir) => {
          const count = selectedCounts[dir];
          const wait = selectedWaits[dir];
          const incident = incidents?.[selectedJunction]?.[dir] || 'NORMAL';
          const multiplier = arrivalConfig?.multipliers?.[selectedJunction]?.[dir] ?? 1.0;
          const effectiveRate = ((globalRate * multiplier)).toFixed(1);

          const isBlocked = incident === 'ROAD_BLOCK';
          const isIncident = incident === 'INCIDENT';

          const priority = isBlocked ? 0 : computePriority(count, wait);
          const tier = getTrafficTier(count);

          const isDirGreen = isRunning && 
            selectedState === 'GREEN' && 
            greenDirections(selectedPhase).includes(dir);
          const isDirYellow = isRunning && 
            selectedState === 'YELLOW' && 
            greenDirections(selectedPhase).includes(dir);

          const inputId = `slider-${selectedJunction}-${dir}`;
          const multInputId = `mult-${selectedJunction}-${dir}`;

          return (
            <div
              key={dir}
              className={`p-3.5 rounded-xl border transition-all ${
                isBlocked
                  ? 'bg-rose-950/20 border-rose-500/60 ring-1 ring-rose-500/40'
                  : isIncident
                  ? 'bg-amber-950/20 border-amber-500/60 ring-1 ring-amber-500/40'
                  : isDirGreen
                  ? 'bg-emerald-950/20 border-emerald-500/50 ring-1 ring-emerald-500/30'
                  : isDirYellow
                  ? 'bg-yellow-950/20 border-yellow-500/50 ring-1 ring-yellow-500/30'
                  : 'bg-slate-950/70 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  <span className="font-bold text-white text-sm uppercase">{dir} Approach</span>
                </div>
                
                {isBlocked ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-300 font-bold font-mono">
                    ROAD BLOCKED
                  </span>
                ) : isDirGreen ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 font-bold font-mono">
                    GREEN ({selectedTimer}s)
                  </span>
                ) : isDirYellow ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/30 text-yellow-300 font-bold font-mono">
                    YELLOW ({selectedTimer}s)
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold font-mono">
                    RED (STOPPED)
                  </span>
                )}
              </div>

              {/* Incident State Toggle & Status Button */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/70 text-xs font-mono">
                <span className="text-slate-400">Incident Mode:</span>
                <button
                  type="button"
                  onClick={() => onCycleIncident(selectedJunction, dir)}
                  className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1 ${
                    isBlocked
                      ? 'bg-rose-600 text-white border-rose-500 hover:bg-rose-500'
                      : isIncident
                      ? 'bg-amber-600/30 text-amber-300 border-amber-500 hover:bg-amber-600/50'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                  title="Click to cycle: NORMAL -> INCIDENT -> ROAD_BLOCK"
                  aria-label={`Toggle incident mode for ${selectedJunction} ${dir}, current: ${incident}`}
                >
                  {isBlocked ? (
                    <>⛔ BLOCKED (0% Flow)</>
                  ) : isIncident ? (
                    <>⚠️ INCIDENT (50% Flow)</>
                  ) : (
                    <>✅ NORMAL (100% Flow)</>
                  )}
                </button>
              </div>

              {/* Cars Waiting Slider */}
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <label htmlFor={inputId} className="text-slate-400">Cars Waiting:</label>
                  <span className="text-white font-bold">{count} / 100 max</span>
                </div>
                <input
                  id={inputId}
                  type="range"
                  min="0"
                  max="100"
                  value={count}
                  aria-label={`${selectedJunction} ${dir} vehicle count`}
                  onChange={(e) => onDirectionChange(selectedJunction, dir, e.target.value)}
                  className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />

                {/* Per-approach Arrival Multiplier */}
                <div className="pt-1.5 space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <label htmlFor={multInputId} className="text-slate-400">Arrival Multiplier:</label>
                    <span className="text-cyan-300 font-bold">{multiplier.toFixed(1)}x ({effectiveRate} cars/min)</span>
                  </div>
                  <input
                    id={multInputId}
                    type="range"
                    min="0.2"
                    max="3.0"
                    step="0.1"
                    value={multiplier}
                    aria-label={`${selectedJunction} ${dir} arrival multiplier`}
                    onChange={(e) => onSetApproachMultiplier(selectedJunction, dir, e.target.value)}
                    className="w-full accent-amber-400 bg-slate-800 h-1 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="flex justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                  <span className="text-slate-400">Wait Time:</span>
                  <span className={wait >= 60 && !isBlocked ? 'text-rose-400 font-bold animate-pulse motion-reduce:animate-none' : 'text-slate-300'}>
                    {wait}s {wait >= 60 && (isBlocked ? '(Starvation Excluded)' : '(STARVED!)')}
                  </span>
                </div>

                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Priority Score:</span>
                  <span className="text-cyan-300 font-bold">
                    {isBlocked ? '0 (Queue Ignored)' : `${priority} (Tier: ${tier})`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default ControlPanel;
