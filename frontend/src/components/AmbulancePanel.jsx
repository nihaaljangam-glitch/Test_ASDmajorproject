import React, { useState } from 'react';
import { Siren, Plus, RotateCcw, X, Clock, Zap, MapPin, Hospital as HospitalIcon, ShieldAlert } from 'lucide-react';
import { JUNCTIONS, HOSPITALS } from '../sim/config.js';

export function AmbulancePanel({
  ambulance,
  ambulances: rawAmbulances,
  onSpawnAmbulance,
  onClearAmbulance,
  isCompareMode = false
}) {
  const [selectedStart, setSelectedStart] = useState('J1');
  const [selectedHospital, setSelectedHospital] = useState('HOSPITAL');

  // Normalize ambulances array
  const ambulances = Array.isArray(rawAmbulances) && rawAmbulances.length > 0
    ? rawAmbulances
    : (ambulance ? [ambulance] : []);

  const count = ambulances.length;
  const isMaxReached = count >= 3;

  const handleSpawn = () => {
    if (isMaxReached) return;
    onSpawnAmbulance(selectedStart, selectedHospital);
  };

  return (
    <section 
      className="rounded-2xl bg-[#0b1329] border border-slate-800 p-4 sm:p-5 space-y-4 flex flex-col justify-between"
      aria-label="Ambulance Preemption & Dijkstra Routing Controls"
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Siren className="w-4 h-4 text-rose-400" aria-hidden="true" />
            <span>Emergency Preemption</span>
          </h3>
          <span className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-bold border ${
            count > 0 
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            {count} / 3 Active
          </span>
        </div>

        <p className="text-xs text-slate-400">
          Dispatches up to 3 ambulances with shortest-path <strong>Dijkstra routes</strong>. The controller preempts signals safely via deterministic yellow &amp; all-red clearance.
        </p>

        {/* Start Junction & Destination Hospital Selectors */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label htmlFor="amb-start-select" className="block text-[11px] font-mono text-slate-400 mb-1">
              Start Junction:
            </label>
            <select
              id="amb-start-select"
              value={selectedStart}
              onChange={(e) => setSelectedStart(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
            >
              {Object.values(JUNCTIONS).map((j) => (
                <option key={j.id} value={j.id}>
                  {j.id} - {j.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="amb-dest-select" className="block text-[11px] font-mono text-slate-400 mb-1">
              Destination:
            </label>
            <select
              id="amb-dest-select"
              value={selectedHospital}
              onChange={(e) => setSelectedHospital(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="HOSPITAL">City Hospital (H1)</option>
              <option value="H2">Metro Trauma (H2)</option>
            </select>
          </div>
        </div>

        {/* Dispatch Action Button */}
        <button
          type="button"
          onClick={handleSpawn}
          disabled={isMaxReached}
          className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
            isMaxReached
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/50 cursor-pointer active:scale-[0.98]'
          }`}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>{isMaxReached ? 'MAX 3 AMBULANCES ACTIVE' : 'DISPATCH AMBULANCE (DIJKSTRA)'}</span>
        </button>

        {/* Per-Ambulance Cards List */}
        {count > 0 && (
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Active Ambulances ({count}):</span>
              {onClearAmbulance && (
                <button
                  type="button"
                  onClick={() => onClearAmbulance()}
                  className="text-rose-400 hover:text-rose-300 text-[11px] underline cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {ambulances.map((amb, index) => {
                const isArrived = amb.progress >= 100;
                const isWaiting = Boolean(amb.isWaitingAtRed);
                const currentJunc = amb.currentJunction || amb.junction;
                const estDelay = amb.estimatedNoPreemptionDelay || 0;
                const timeSaved = amb.timeSaved !== undefined ? amb.timeSaved : Math.max(0, estDelay - (amb.actualDelay || 0));

                return (
                  <div 
                    key={amb.id || index}
                    className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-slate-700 transition-colors space-y-2 relative"
                  >
                    {/* Header Row: ID, Hospital, Clear */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[10px] font-mono font-bold flex items-center justify-center">
                          #{index + 1}
                        </span>
                        <span className="text-xs font-bold text-white font-mono">
                          {amb.hospitalName || (amb.targetHospital === 'H2' ? 'Metro Trauma (H2)' : 'City Hospital (H1)')}
                        </span>
                      </div>

                      {onClearAmbulance && (
                        <button
                          type="button"
                          onClick={() => onClearAmbulance(amb.id)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Dismiss this ambulance"
                          aria-label={`Dismiss ambulance ${index + 1}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Dijkstra Route */}
                    <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 overflow-x-auto whitespace-nowrap py-0.5">
                      <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span>{amb.path?.join(' ➔ ') || `${amb.junction} ➔ HOSPITAL`}</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-slate-400">
                        <span>
                          {isArrived 
                            ? '✅ ARRIVED AT DESTINATION' 
                            : isWaiting 
                            ? `🛑 RED LIGHT at ${currentJunc}` 
                            : `⚡ TRANSIT at ${currentJunc}`}
                        </span>
                        <span className="font-bold text-white">{amb.progress || 0}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 rounded-full ${
                            isArrived 
                              ? 'bg-emerald-500' 
                              : isWaiting 
                              ? 'bg-amber-500 animate-pulse' 
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, amb.progress || 0))}%` }}
                        />
                      </div>
                    </div>

                    {/* ETA & Time Saved Badges */}
                    <div className="flex items-center justify-between text-[11px] font-mono pt-0.5 flex-wrap gap-1">
                      <span className="flex items-center gap-1 text-slate-300">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        <span>ETA: <strong className="text-white">{isArrived ? '0s' : `${amb.eta ?? Math.ceil((100 - amb.progress) / 2)}s`}</strong></span>
                      </span>

                      <span 
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold"
                        title={isCompareMode ? "Measured time saved vs lockstep Fixed-Timer controller" : "Estimated delay avoided by preemption: sum of (countdown + yellow + allRed) on conflicting red lights"}
                      >
                        <Zap className="w-2.5 h-2.5 text-emerald-400" />
                        <span>
                          Saved: ~{timeSaved}s <span className="opacity-75 font-normal">({isCompareMode ? 'vs Fixed' : 'est'})</span>
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-2 text-[10px] font-mono text-slate-500 flex items-center justify-between border-t border-slate-800/80">
        <span>Preemption: Priority Safe Corridor</span>
        <span>Dual Hospitals: H1 &amp; H2</span>
      </div>
    </section>
  );
}

export default AmbulancePanel;
