import React, { useState, useEffect, useRef } from 'react';
import {
  FolderOpen,
  Bookmark,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  TrendingUp,
  Sliders,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Plus
} from 'lucide-react';
import {
  BUILT_IN_SCENARIOS,
  getSavedScenarios,
  saveScenario,
  deleteScenario,
  exportScenarioAsJson,
  importScenarioFromJson,
  serializeCurrentState
} from '../sim/scenarios.js';

export function ScenarioManager({
  simState,
  simStateFixed,
  seed,
  onLoadScenario,
  isOpen = false,
  onToggleOpen
}) {
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [selectedScenarioKey, setSelectedScenarioKey] = useState('PROPOSAL_DEFAULT');
  const [saveName, setSaveName] = useState('');
  const [notification, setNotification] = useState(null); // { type: 'success'|'error', message: string }
  const fileInputRef = useRef(null);

  // Load saved user scenarios from localStorage
  const refreshSavedScenarios = () => {
    try {
      const list = getSavedScenarios();
      setSavedScenarios(list);
    } catch (err) {
      console.warn('Failed to refresh saved scenarios:', err);
    }
  };

  useEffect(() => {
    refreshSavedScenarios();
  }, []);

  // Built-in list + user list
  const builtIns = Object.entries(BUILT_IN_SCENARIOS).map(([key, sc]) => ({
    key,
    isBuiltIn: true,
    ...sc
  }));

  const userScenarios = savedScenarios.map((sc, idx) => ({
    key: `USER_${idx}_${sc.name}`,
    isBuiltIn: false,
    ...sc
  }));

  const allScenarios = [...builtIns, ...userScenarios];
  const activeScenario = allScenarios.find((s) => s.key === selectedScenarioKey) || builtIns[0];

  // Auto-dismiss notifications after 4s
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(timer);
  }, [notification]);

  // Handle Loading a Scenario
  const handleLoad = (scenarioToLoad) => {
    const sc = scenarioToLoad || activeScenario;
    if (!sc) return;
    const success = onLoadScenario(sc);
    if (success !== false) {
      setNotification({
        type: 'success',
        message: `Loaded scenario "${sc.name}" (Seed: ${sc.seed}, Fixed Cycle: ${sc.fixedTimerCycle}s).`
      });
    } else {
      setNotification({
        type: 'error',
        message: `Failed to load scenario "${sc.name}".`
      });
    }
  };

  // Handle Saving current simulation state
  const handleSaveCurrent = (e) => {
    e.preventDefault();
    const trimmed = saveName.trim();
    if (!trimmed) {
      setNotification({ type: 'error', message: 'Please enter a name for the scenario.' });
      return;
    }

    try {
      const serialized = serializeCurrentState(
        simState,
        trimmed,
        seed,
        simStateFixed?.fixedGreenTime || 30
      );

      const saved = saveScenario(serialized);
      refreshSavedScenarios();
      setSelectedScenarioKey(`USER_0_${saved.name}`);
      setSaveName('');
      setNotification({
        type: 'success',
        message: `Scenario "${saved.name}" successfully saved to localStorage.`
      });
    } catch (err) {
      setNotification({
        type: 'error',
        message: `Failed to save scenario: ${err.message}`
      });
    }
  };

  // Handle Deleting a custom scenario
  const handleDelete = (name) => {
    if (!window.confirm(`Are you sure you want to delete scenario "${name}"?`)) {
      return;
    }
    const success = deleteScenario(name);
    if (success) {
      refreshSavedScenarios();
      setSelectedScenarioKey('PROPOSAL_DEFAULT');
      setNotification({
        type: 'success',
        message: `Deleted scenario "${name}".`
      });
    } else {
      setNotification({
        type: 'error',
        message: `Failed to delete scenario "${name}".`
      });
    }
  };

  // Handle Exporting JSON file
  const handleExport = (scenarioToExport) => {
    const sc = scenarioToExport || activeScenario;
    if (!sc) return;
    try {
      const jsonStr = exportScenarioAsJson(sc);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = sc.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      a.href = url;
      a.download = `trafficflow_scenario_${safeName}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setNotification({
        type: 'success',
        message: `Exported "${sc.name}" as JSON file.`
      });
    } catch (err) {
      setNotification({
        type: 'error',
        message: `Failed to export JSON: ${err.message}`
      });
    }
  };

  // Handle Importing JSON file with schema validation
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = importScenarioFromJson(text);

      if (!result.valid || !result.scenario) {
        setNotification({
          type: 'error',
          message: `Schema validation failed: ${result.errors.join('; ')}`
        });
        return;
      }

      // Save to storage
      const saved = saveScenario(result.scenario);
      refreshSavedScenarios();
      setSelectedScenarioKey(`USER_0_${saved.name}`);

      // Immediately load into simulation
      onLoadScenario(saved);

      setNotification({
        type: 'success',
        message: `Imported and loaded scenario "${saved.name}" successfully!`
      });
    } catch (err) {
      setNotification({
        type: 'error',
        message: `File import error: ${err.message}`
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Count incidents in active scenario
  const getIncidentsCount = (sc) => {
    if (!sc?.incidents) return 'All Clear';
    let blockCount = 0;
    let incidentCount = 0;
    for (const jId of ['J1', 'J2', 'J3', 'J4']) {
      for (const dir of ['north', 'south', 'east', 'west']) {
        const state = sc.incidents[jId]?.[dir];
        if (state === 'ROAD_BLOCK') blockCount++;
        else if (state === 'INCIDENT') incidentCount++;
      }
    }
    if (blockCount > 0 && incidentCount > 0) return `${blockCount} Blocked, ${incidentCount} Incidents`;
    if (blockCount > 0) return `${blockCount} Roadblock${blockCount > 1 ? 's' : ''}`;
    if (incidentCount > 0) return `${incidentCount} Incident${incidentCount > 1 ? 's' : ''}`;
    return 'All Clear (Normal)';
  };

  return (
    <div className="border-t border-slate-800/80 pt-3">
      {/* Toggle Bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-300 hover:text-cyan-200 transition-colors focus:outline-none"
          aria-expanded={isOpen}
          aria-controls="scenario-manager-panel"
        >
          <Bookmark className="w-3.5 h-3.5 text-cyan-400" />
          <span>Scenario Management ({builtIns.length} Built-in{userScenarios.length > 0 ? `, ${userScenarios.length} Custom` : ''})</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {/* Quick Built-in Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {builtIns.map((sc) => (
            <button
              key={sc.name}
              type="button"
              onClick={() => handleLoad(sc)}
              className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
              title={`Load built-in scenario "${sc.name}"`}
            >
              {sc.name}
            </button>
          ))}
        </div>
      </div>

      {/* Expanded Manager Panel */}
      {isOpen && (
        <div 
          id="scenario-manager-panel"
          className="mt-3.5 bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 space-y-4"
        >
          {/* Notification Alert */}
          {notification && (
            <div
              className={`p-2.5 rounded-lg text-xs font-mono flex items-start gap-2 border ${
                notification.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
              role={notification.type === 'error' ? 'alert' : 'status'}
            >
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span className="flex-1">{notification.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Scenario Selector */}
            <div className="space-y-2">
              <label htmlFor="scenario-select" className="text-[11px] font-mono text-slate-400 block font-bold">
                Select Scenario:
              </label>
              <select
                id="scenario-select"
                value={selectedScenarioKey}
                onChange={(e) => setSelectedScenarioKey(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono rounded-lg p-2 focus:outline-none focus:border-cyan-500 cursor-pointer"
                aria-label="Choose a scenario to inspect or load"
              >
                <optgroup label="Built-in Scenarios">
                  {builtIns.map((s) => (
                    <option key={s.key} value={s.key}>
                      ★ {s.name}
                    </option>
                  ))}
                </optgroup>
                {userScenarios.length > 0 && (
                  <optgroup label="Custom User Scenarios (localStorage)">
                    {userScenarios.map((s) => (
                      <option key={s.key} value={s.key}>
                        👤 {s.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleLoad(activeScenario)}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  title="Load scenario into simulation"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Load Scenario</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExport(activeScenario)}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                  title="Export this scenario as JSON file"
                  aria-label="Export this scenario as JSON file"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                {!activeScenario.isBuiltIn && (
                  <button
                    type="button"
                    onClick={() => handleDelete(activeScenario.name)}
                    className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/60 transition-colors"
                    title={`Delete custom scenario "${activeScenario.name}"`}
                    aria-label={`Delete custom scenario "${activeScenario.name}"`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Middle: Active Scenario Details Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  {activeScenario.name}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  activeScenario.isBuiltIn
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                }`}>
                  {activeScenario.isBuiltIn ? 'BUILT-IN' : 'CUSTOM'}
                </span>
              </div>

              {activeScenario.description && (
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {activeScenario.description}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/70 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Seed:</span>
                  <span className="text-slate-200 font-bold">{activeScenario.seed}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Arrival Rate:</span>
                  <span className="text-cyan-300 font-bold">{activeScenario.arrivalConfig?.globalRate || 15} cars/min</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Green Range:</span>
                  <span className="text-slate-200">
                    {activeScenario.signalConfig?.minGreenTime}s - {activeScenario.signalConfig?.maxGreenTime}s
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Fixed-Timer Cycle:</span>
                  <span className="text-amber-300 font-bold">{activeScenario.fixedTimerCycle}s</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 block">Incidents:</span>
                  <span className="text-rose-300">{getIncidentsCount(activeScenario)}</span>
                </div>
              </div>
            </div>

            {/* Right: Save Current State & Import JSON */}
            <div className="space-y-3">
              {/* Save Form */}
              <form onSubmit={handleSaveCurrent} className="space-y-1.5">
                <label htmlFor="save-scenario-name" className="text-[11px] font-mono text-slate-400 block font-bold">
                  Save Current State as Scenario:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="save-scenario-name"
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="e.g. Rainy Congestion"
                    className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
                    maxLength={60}
                  />
                  <button
                    type="submit"
                    className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono font-bold text-xs flex items-center gap-1 transition-colors shrink-0"
                    title="Save current simulation settings"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              </form>

              {/* Import File */}
              <div className="pt-2 border-t border-slate-800/70">
                <input
                  type="file"
                  accept=".json,application/json"
                  ref={fileInputRef}
                  onChange={handleImportFile}
                  className="hidden"
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-1.5 px-3 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-2"
                  title="Import scenario from JSON file with schema validation"
                >
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Import Scenario JSON</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
