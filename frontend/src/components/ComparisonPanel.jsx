import React from 'react';
import { Award, ShieldCheck, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

export function ComparisonPanel() {
  return (
    <section 
      className="rounded-2xl bg-[#091122]/80 border border-slate-800 p-4 sm:p-5 text-xs text-slate-300 space-y-4"
      aria-label="Safe Adaptive Traffic Signal Rules and Architectural Comparison"
    >
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2 font-bold text-white text-sm">
          <Award className="w-4 h-4 text-cyan-400" aria-hidden="true" />
          <span>Viva Architecture: Safe Adaptive Signal Rules vs Fixed-Time</span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
          FAIL-SAFE ASSURED
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] font-mono">
        {/* Rule 1 */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-emerald-900/40 text-emerald-300 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-white text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            1. Safe Opposing Phases
          </div>
          <div className="text-slate-300">Phase 1: North/South Green (EW Red)</div>
          <div className="text-slate-300">Phase 2: East/West Green (NS Red)</div>
          <div className="text-rose-400 font-bold pt-1 border-t border-emerald-900/40">
            ❌ Conflicting greens mathematically impossible
          </div>
        </div>

        {/* Rule 2 */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-yellow-900/40 text-yellow-300 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-white text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-yellow-400" />
            2. Deterministic Clearance
          </div>
          <div className="text-slate-300 flex items-center gap-1">
            GREEN <ArrowRight className="w-3 h-3 text-slate-500 inline" /> YELLOW (3s)
          </div>
          <div className="text-slate-300 flex items-center gap-1">
            <ArrowRight className="w-3 h-3 text-slate-500 inline" /> ALL-RED (2s) <ArrowRight className="w-3 h-3 text-slate-500 inline" /> NEW GREEN
          </div>
          <div className="text-emerald-400 font-bold pt-1 border-t border-yellow-900/40">
            🛡️ Zero intersection collision risk
          </div>
        </div>

        {/* Rule 3 */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-cyan-900/40 text-cyan-300 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-white text-xs">
            <Award className="w-3.5 h-3.5 text-cyan-400" />
            3. Starvation &amp; Priority
          </div>
          <div className="text-slate-300">Score = (Cars×1) + (Wait×0.5) + (Cong×2)</div>
          <div className="text-slate-300">Wait &ge; 60s &rarr; Starvation Priority Override</div>
          <div className="text-cyan-400 font-bold pt-1 border-t border-cyan-900/40">
            ⏱️ Clamped Duration: 15s &le; Green &le; 60s
          </div>
        </div>
      </div>
    </section>
  );
}

export default ComparisonPanel;
