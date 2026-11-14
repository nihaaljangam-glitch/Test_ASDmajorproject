import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';
import {
  LineChart as LineChartIcon,
  Download,
  Pause,
  Play,
  RotateCcw,
  Activity,
  Layers,
  Clock,
  Gauge,
  Car
} from 'lucide-react';

import { JUNCTIONS } from '../sim/config.js';
import {
  createRollingSample,
  filterRollingWindow,
  computeRollingStats,
  generateBaselineHistory,
  exportHistoryToCSV,
  DEFAULT_WINDOW_SECONDS
} from '../sim/rollingHistory.js';

const JUNCTION_COLORS = {
  J1: '#38bdf8', // sky
  J2: '#34d399', // emerald
  J3: '#fbbf24', // amber
  J4: '#f43f5e'  // rose
};

export function Charts({ simState, isRunning }) {
  const [metric, setMetric] = useState('queue'); // 'queue' | 'wait' | 'network' | 'throughput'
  const [windowSeconds, setWindowSeconds] = useState(DEFAULT_WINDOW_SECONDS); // 60, 180, 300
  const [selectedJunctionFilter, setSelectedJunctionFilter] = useState('ALL'); // 'ALL' | 'J1' | 'J2' | 'J3' | 'J4'
  const [isPaused, setIsPaused] = useState(false);

  // Initialize history with a realistic 5-minute pre-seeded baseline so chart is instantly active
  const [history, setHistory] = useState(() => generateBaselineHistory(simState, DEFAULT_WINDOW_SECONDS, 2));
  const lastSampledTickRef = useRef(-1);

  const { tick } = simState;

  // Reset or regenerate baseline if tick resets to 0
  useEffect(() => {
    if (tick === 0) {
      setHistory(generateBaselineHistory(simState, DEFAULT_WINDOW_SECONDS, 2));
      lastSampledTickRef.current = -1;
    }
  }, [tick]);

  // Sample every 2 sim-seconds
  useEffect(() => {
    if (isPaused) return;
    if (tick === lastSampledTickRef.current) return;
    if (tick % 2 !== 0 && history.length > 0) return;

    lastSampledTickRef.current = tick;

    const sample = createRollingSample(simState, tick);

    setHistory((prev) => {
      // Keep up to 300 sim-seconds (rolling 5 minutes)
      const windowed = filterRollingWindow(prev, tick, DEFAULT_WINDOW_SECONDS);
      return [...windowed, sample];
    });
  }, [tick, simState, isPaused, history.length]);

  // Visible sliced data based on user window selection (60s, 180s, 300s)
  const visibleData = useMemo(() => {
    return filterRollingWindow(history, tick, windowSeconds);
  }, [history, tick, windowSeconds]);

  // Rolling statistical summary across the visible window
  const stats = useMemo(() => {
    return computeRollingStats(visibleData);
  }, [visibleData]);

  // Handle CSV export of the 5-minute rolling window
  const handleExportCSV = () => {
    const csvContent = exportHistoryToCSV(visibleData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `trafficflow-5m-performance-tick${tick}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section 
      className="rounded-2xl bg-[#0b1329] border border-slate-800 p-4 sm:p-5 space-y-4 shadow-xl"
      aria-label="Real-time 5-Minute Simulation Rolling Charts"
    >
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-800 pb-3 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <LineChartIcon className="w-5 h-5 text-cyan-400" aria-hidden="true" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Rolling 5-Minute Performance History
            </h3>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <span className={`w-1.5 h-1.5 rounded-full ${isRunning && !isPaused ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'}`} />
              {isPaused ? 'PAUSED' : isRunning ? 'STREAMING' : 'IDLE'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Continuous rolling telemetry sampled every 2 sim-seconds &bull; {visibleData.length} samples in {windowSeconds}s window
          </p>
        </div>

        {/* Action Controls & Windows */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Window Buttons */}
          <div className="flex rounded-xl bg-slate-950 border border-slate-800 p-0.5" role="group" aria-label="Window Duration">
            {[
              [60, '1m'],
              [180, '3m'],
              [300, '5m']
            ].map(([sec, label]) => (
              <button
                key={sec}
                type="button"
                onClick={() => setWindowSeconds(sec)}
                className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-colors ${
                  windowSeconds === sec
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                aria-pressed={windowSeconds === sec}
                title={`Show last ${sec} simulated seconds`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Pause / Resume Sampling Toggle */}
          <button
            type="button"
            onClick={() => setIsPaused((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold rounded-lg border transition-colors ${
              isPaused
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
            title={isPaused ? 'Resume live chart sampling' : 'Pause chart sampling to inspect data'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-amber-400" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Resume' : 'Freeze'}</span>
          </button>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:border-cyan-500/50 transition-colors"
            title="Download window data as CSV"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Rolling Window KPI Mini Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5 sm:p-3">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono">
            <span>Peak Queue</span>
            <Car className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white mt-1">{stats.peakQueue} <span className="text-xs font-normal text-slate-400">veh</span></div>
          <div className="text-[10px] text-slate-500 mt-0.5">Avg: {stats.avgQueue} veh</div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5 sm:p-3">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono">
            <span>Peak Wait</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white mt-1">{stats.peakWait}s</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Avg: {stats.avgWait}s delay</div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5 sm:p-3">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono">
            <span>Peak Congestion</span>
            <Gauge className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white mt-1">{stats.peakCongestion} <span className="text-xs font-normal text-slate-400">/ 100</span></div>
          <div className="text-[10px] text-slate-500 mt-0.5">Avg: {stats.avgCongestion}</div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5 sm:p-3">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono">
            <span>Discharged (60s)</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-300 mt-1">{visibleData[visibleData.length - 1]?.throughput60s || 0} <span className="text-xs font-normal text-slate-400">cars/m</span></div>
          <div className="text-[10px] text-slate-500 mt-0.5">Total: {visibleData[visibleData.length - 1]?.totalDischarged || 0}</div>
        </div>
      </div>

      {/* Metric Mode Tabs & Junction Filter Chips */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
        {/* Metric Selector */}
        <div className="flex flex-wrap rounded-xl bg-slate-950 border border-slate-800 p-1 gap-1" role="tablist" aria-label="Metric Selection">
          {[
            ['queue', 'Queue Length (cars)'],
            ['wait', 'Average Wait (s)'],
            ['network', 'Network Aggregate'],
            ['throughput', 'Throughput (60s)']
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              onClick={() => setMetric(key)}
              className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-colors ${
                metric === key
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              aria-selected={metric === key}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Junction Filter Chips (when viewing per-junction metrics) */}
        {(metric === 'queue' || metric === 'wait') && (
          <div className="flex items-center gap-1 text-xs font-mono" role="group" aria-label="Junction Filter">
            <span className="text-slate-500 text-[11px] mr-1 hidden sm:inline">Filter:</span>
            {['ALL', 'J1', 'J2', 'J3', 'J4'].map((jId) => (
              <button
                key={jId}
                type="button"
                onClick={() => setSelectedJunctionFilter(jId)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                  selectedJunctionFilter === jId
                    ? jId === 'ALL'
                      ? 'bg-slate-800 text-white border-slate-600'
                      : 'border-current text-white font-black'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
                style={
                  selectedJunctionFilter === jId && jId !== 'ALL'
                    ? { backgroundColor: `${JUNCTION_COLORS[jId]}20`, color: JUNCTION_COLORS[jId], borderColor: JUNCTION_COLORS[jId] }
                    : {}
                }
              >
                {jId}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Chart Canvas */}
      <div className="w-full h-72 pt-1">
        <ResponsiveContainer width="100%" height="100%">
          {metric === 'network' ? (
            <AreaChart data={visibleData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotalQueue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorCongestion" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                </linearGradient>
              </defs>
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
                labelFormatter={(label) => `Sim Time: ${label}`}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Area
                type="monotone"
                dataKey="totalQueue"
                name="Total Network Queue (cars)"
                stroke="#38bdf8"
                fillOpacity={1}
                fill="url(#colorTotalQueue)"
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="congestionIndex"
                name="Congestion Index (0-100)"
                stroke="#f43f5e"
                fillOpacity={1}
                fill="url(#colorCongestion)"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          ) : metric === 'throughput' ? (
            <AreaChart data={visibleData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorThroughput" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0.0} />
                </linearGradient>
              </defs>
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
                labelFormatter={(label) => `Sim Time: ${label}`}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Area
                type="monotone"
                dataKey="throughput60s"
                name="Vehicles Discharged (cars/min)"
                stroke="#34d399"
                fillOpacity={1}
                fill="url(#colorThroughput)"
                strokeWidth={2.5}
                isAnimationActive={false}
              />
            </AreaChart>
          ) : (
            <LineChart data={visibleData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
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
                formatter={(value, name) => [
                  metric === 'queue' ? `${value} vehicles` : `${value}s wait`,
                  JUNCTIONS[name.split('_')[0]]?.name || name
                ]}
                labelFormatter={(label) => `Sim Time: ${label}`}
              />
              <Legend 
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                formatter={(value) => {
                  const jId = value.split('_')[0];
                  return `${jId} (${JUNCTIONS[jId]?.name || jId})`;
                }}
              />
              {Object.keys(JUNCTIONS)
                .filter((jId) => selectedJunctionFilter === 'ALL' || selectedJunctionFilter === jId)
                .map((jId) => (
                  <Line
                    key={jId}
                    type="monotone"
                    dataKey={`${jId}_${metric}`}
                    stroke={JUNCTION_COLORS[jId]}
                    strokeWidth={selectedJunctionFilter === jId ? 3 : 2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export default Charts;
