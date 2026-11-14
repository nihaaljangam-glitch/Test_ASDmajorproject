import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Filter, Trash2, ArrowDownCircle, CheckSquare, Square } from 'lucide-react';

const TYPE_STYLES = {
  emergency: {
    border: 'border-rose-500/40',
    bg: 'bg-rose-950/25',
    text: 'text-rose-200',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
  },
  starvation: {
    border: 'border-orange-500/40',
    bg: 'bg-orange-950/25',
    text: 'text-orange-200',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40'
  },
  phase_change: {
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-950/15',
    text: 'text-cyan-200',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
  },
  clearance: {
    border: 'border-yellow-500/30',
    bg: 'bg-yellow-950/20',
    text: 'text-yellow-200',
    badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
  },
  incident: {
    border: 'border-amber-500/40',
    bg: 'bg-amber-950/20',
    text: 'text-amber-200',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
  },
  system: {
    border: 'border-slate-800',
    bg: 'bg-slate-950/70',
    text: 'text-slate-300',
    badge: 'bg-slate-800 text-slate-400 border-slate-700'
  }
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'emergency', label: 'Emergency' },
  { key: 'starvation', label: 'Starvation' },
  { key: 'phase_change', label: 'Phase change' },
  { key: 'clearance', label: 'Clearance' },
  { key: 'incident', label: 'Incidents' }
];

export function DecisionLog({ logs = [], isRunning, onClearLogs }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef(null);

  // Auto-scroll to top (newest entries are unshifted to index 0)
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  const normalizedLogs = logs.map((item, idx) => {
    if (typeof item === 'string') {
      const isEmergency = item.includes('🚨') || item.includes('🚑') || item.includes('🏥');
      const isStarvation = item.includes('Starvation');
      const isYellow = item.includes('⚠️');
      const isClear = item.includes('🛑');
      const type = isEmergency ? 'emergency' : isStarvation ? 'starvation' : isYellow ? 'phase_change' : isClear ? 'clearance' : 'system';
      return {
        id: `legacy-${idx}`,
        simTime: 0,
        junction: null,
        type,
        message: item
      };
    }
    return item;
  });

  const filteredLogs = activeFilter === 'all'
    ? normalizedLogs
    : normalizedLogs.filter((entry) => entry.type === activeFilter);

  return (
    <section 
      className="rounded-2xl bg-[#0b1329] border border-slate-800 p-4 sm:p-5 space-y-3.5"
      aria-label="Safe Phase Decision and Clearance Feed"
    >
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" aria-hidden="true" />
          <h3 className="text-sm font-bold text-white">
            Safe Phase Decision &amp; Clearance Log
          </h3>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            {filteredLogs.length} / {logs.length}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          {/* Auto-Scroll Toggle */}
          <button
            type="button"
            onClick={() => setAutoScroll((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
              autoScroll ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-400'
            }`}
            title="Auto-scroll to latest event"
            aria-pressed={autoScroll}
          >
            {autoScroll ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            <span>Auto-scroll</span>
          </button>

          {/* Clear Button */}
          {onClearLogs && (
            <button
              type="button"
              onClick={onClearLogs}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors"
              title="Clear all logged events"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips (#12) */}
      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Log Filters">
        <span className="text-[11px] font-mono text-slate-500 mr-1 flex items-center gap-1">
          <Filter className="w-3 h-3" /> Filter:
        </span>
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setActiveFilter(f.key)}
              className={`px-2.5 py-1 text-[11px] font-mono rounded-lg border transition-colors ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                  : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-900'
              }`}
              aria-pressed={isActive}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Log Feed List (Always Visible) */}
      {filteredLogs.length === 0 ? (
        <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center text-xs text-slate-500 font-mono">
          {logs.length === 0 
            ? 'No events logged yet. Signal decisions, clearances, and emergency events will appear here in real time.'
            : `No events matching filter "${activeFilter}".`}
        </div>
      ) : (
        <div 
          ref={logContainerRef}
          className="space-y-1.5 max-h-52 overflow-y-auto font-mono text-xs pr-1 focus:outline-none"
          role="log"
          tabIndex={0}
          aria-live="polite"
          aria-label="Simulation Decision Log Items"
        >
          {filteredLogs.map((entry) => {
            const style = TYPE_STYLES[entry.type] || TYPE_STYLES.system;

            return (
              <div 
                key={entry.id} 
                className={`p-2 sm:p-2.5 rounded-lg border ${style.border} ${style.bg} ${style.text} transition-colors flex flex-col sm:flex-row sm:items-baseline justify-between gap-1.5`}
              >
                <div className="flex items-baseline gap-2 flex-1">
                  <span className={`text-[9.5px] uppercase font-bold px-1.5 py-0.5 rounded border shrink-0 ${style.badge}`}>
                    {entry.type.replace('_', ' ')}
                  </span>
                  {entry.junction && (
                    <span className="text-[10px] text-slate-400 font-bold px-1 rounded bg-slate-900/80 border border-slate-800 shrink-0">
                      {entry.junction}
                    </span>
                  )}
                  <span className="break-words">{entry.message}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-normal shrink-0">
                  t={entry.simTime}s
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default DecisionLog;
