import React, { useState } from 'react';
import { Sliders, RotateCcw, CheckCircle2, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { SIGNAL_CONFIG_LIMITS, DEFAULT_SIGNAL_CONFIG } from '../sim/config.js';

export function SignalConfigPanel({
  signalConfig,
  onUpdateSignalConfig,
  onResetSignalConfig
}) {
  const [isOpen, setIsOpen] = useState(false);

  const cfg = signalConfig || DEFAULT_SIGNAL_CONFIG;

  const handleMinGreenChange = (val) => {
    const minVal = Number(val);
    const updates = { minGreenTime: minVal };
    if (cfg.maxGreenTime <= minVal) {
      updates.maxGreenTime = minVal + 5;
    }
    onUpdateSignalConfig(updates);
  };

  const handleMaxGreenChange = (val) => {
    const maxVal = Number(val);
    if (maxVal > cfg.minGreenTime) {
      onUpdateSignalConfig({ maxGreenTime: maxVal });
    }
  };

  const isMinMaxValid = cfg.maxGreenTime > cfg.minGreenTime;

  return (
    <section 
      className="rounded-2xl bg-[#0b1329] border border-slate-800 p-4 sm:p-5 space-y-4"
      aria-label="Signal Timing and Controller Configuration"
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 font-bold text-white text-sm hover:text-cyan-400 transition-colors focus:outline-none"
          aria-expanded={isOpen}
          aria-controls="signal-config-content"
        >
          <Sliders className="w-4 h-4 text-cyan-400" aria-hidden="true" />
          <span>Adaptive Signal Parameters &amp; Thresholds</span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-emerald-400 hidden sm:inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Live Applied
          </span>
          <button
            type="button"
            onClick={onResetSignalConfig}
            className="px-2.5 py-1 text-[11px] font-mono rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
            title="Reset signal parameters to defaults"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to defaults
          </button>
        </div>
      </div>

      {isOpen && (
        <div id="signal-config-content" className="space-y-4 pt-1">
          {!isMinMaxValid && (
            <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/50 flex items-center gap-2 text-xs text-rose-300" role="alert">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Warning: Max Green Duration must be strictly greater than Min Green Duration.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
            {/* 1. minGreen */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex justify-between">
                <label htmlFor="cfg-min-green" className="text-slate-400">Min Green Time:</label>
                <span className="text-white font-bold">{cfg.minGreenTime}s</span>
              </div>
              <input
                id="cfg-min-green"
                type="range"
                min={SIGNAL_CONFIG_LIMITS.minGreen.min}
                max={SIGNAL_CONFIG_LIMITS.minGreen.max}
                value={cfg.minGreenTime}
                aria-label="Minimum green duration in seconds"
                onChange={(e) => handleMinGreenChange(e.target.value)}
                className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">Range: 5s – 30s</span>
            </div>

            {/* 2. maxGreen */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex justify-between">
                <label htmlFor="cfg-max-green" className="text-slate-400">Max Green Time:</label>
                <span className="text-white font-bold">{cfg.maxGreenTime}s</span>
              </div>
              <input
                id="cfg-max-green"
                type="range"
                min={SIGNAL_CONFIG_LIMITS.maxGreen.min}
                max={SIGNAL_CONFIG_LIMITS.maxGreen.max}
                value={cfg.maxGreenTime}
                aria-label="Maximum green duration in seconds"
                onChange={(e) => handleMaxGreenChange(e.target.value)}
                className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">Range: 30s – 120s (&gt; minGreen)</span>
            </div>

            {/* 3. yellowTime */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex justify-between">
                <label htmlFor="cfg-yellow" className="text-slate-400">Yellow Clearance:</label>
                <span className="text-yellow-400 font-bold">{cfg.yellowTime}s</span>
              </div>
              <input
                id="cfg-yellow"
                type="range"
                min={SIGNAL_CONFIG_LIMITS.yellow.min}
                max={SIGNAL_CONFIG_LIMITS.yellow.max}
                value={cfg.yellowTime}
                aria-label="Yellow clearance interval in seconds"
                onChange={(e) => onUpdateSignalConfig({ yellowTime: Number(e.target.value) })}
                className="w-full accent-yellow-400 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">Range: 2s – 6s</span>
            </div>

            {/* 4. allRedTime */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex justify-between">
                <label htmlFor="cfg-all-red" className="text-slate-400">All-Red Interval:</label>
                <span className="text-rose-400 font-bold">{cfg.allRedTime}s</span>
              </div>
              <input
                id="cfg-all-red"
                type="range"
                min={SIGNAL_CONFIG_LIMITS.allRed.min}
                max={SIGNAL_CONFIG_LIMITS.allRed.max}
                value={cfg.allRedTime}
                aria-label="All red clearance interval in seconds"
                onChange={(e) => onUpdateSignalConfig({ allRedTime: Number(e.target.value) })}
                className="w-full accent-rose-400 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">Range: 1s – 5s</span>
            </div>

            {/* 5. starvation */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex justify-between">
                <label htmlFor="cfg-starvation" className="text-slate-400">Starvation Threshold:</label>
                <span className="text-rose-400 font-bold">{cfg.maxWaitTime}s</span>
              </div>
              <input
                id="cfg-starvation"
                type="range"
                min={SIGNAL_CONFIG_LIMITS.starvation.min}
                max={SIGNAL_CONFIG_LIMITS.starvation.max}
                step={SIGNAL_CONFIG_LIMITS.starvation.step}
                value={cfg.maxWaitTime}
                aria-label="Starvation threshold in seconds"
                onChange={(e) => onUpdateSignalConfig({ maxWaitTime: Number(e.target.value) })}
                className="w-full accent-rose-400 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">Range: 30s – 120s</span>
            </div>

            {/* 6. greenFactor */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex justify-between">
                <label htmlFor="cfg-factor" className="text-slate-400">Green Scale Factor:</label>
                <span className="text-cyan-300 font-bold">{cfg.greenFactor.toFixed(2)}x</span>
              </div>
              <input
                id="cfg-factor"
                type="range"
                min={SIGNAL_CONFIG_LIMITS.greenFactor.min}
                max={SIGNAL_CONFIG_LIMITS.greenFactor.max}
                step={SIGNAL_CONFIG_LIMITS.greenFactor.step}
                value={cfg.greenFactor}
                aria-label="Green duration scale factor"
                onChange={(e) => onUpdateSignalConfig({ greenFactor: Number(e.target.value) })}
                className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">Range: 0.1x – 1.0x</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default SignalConfigPanel;
