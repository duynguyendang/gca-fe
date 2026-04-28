import React, { useEffect, useState, useCallback } from 'react';
import { useSettingsContext } from '../../context/SettingsContext';
import { fetchHealthSummaryV2, fetchHealthSummary, HealthSummaryV2, FileHealth } from '../../services/graphService';
import { logger } from '../../logger';
import HealthScore from './HealthScore';
import MetricsRadar from './MetricsRadar';
import RiskLeaderboard from './RiskLeaderboard';
import AIChatDrawer from './AIChatDrawer';

interface DashboardProps {
  refreshKey?: string;
}

// Request tracking for stale response elimination
let requestCounter = 0;

function nextRequestId(): string {
  return `req_${++requestCounter}_${Date.now()}`;
}

export const Dashboard: React.FC<DashboardProps> = ({ refreshKey }) => {
  const { dataApiBase, selectedProjectId } = useSettingsContext();

  const [healthV2, setHealthV2] = useState<HealthSummaryV2 | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState('');

  const loadHealthData = useCallback(async (requestId: string) => {
    if (!selectedProjectId || !dataApiBase) return;

    setStatus('loading');
    setError(null);

    try {
      // Try V2 endpoint first (Risk Leaderboard format)
      const data = await fetchHealthSummaryV2(dataApiBase, selectedProjectId);
      setHealthV2(data);
      setStatus('success');
    } catch (err: any) {
      // V2 not available — fall back to legacy format and derive V2-like view
      logger.warn('[Dashboard] V2 endpoint unavailable, using legacy format:', err.message);
      try {
        const legacy = await fetchHealthSummary(dataApiBase, selectedProjectId);
        // Transform legacy format to V2 shape
        const derivedV2: HealthSummaryV2 = {
          overall_score: legacy.overall_score,
          total_security_alerts: legacy.smells.filter(s => s.severity === 'High').length,
          total_arch_debt: legacy.total_smells + legacy.total_hubs,
          files: [], // Legacy doesn't provide per-file data
        };
        setHealthV2(derivedV2);
        setStatus('success');
      } catch (legacyErr: any) {
        setStatus('error');
        setError(legacyErr.message || 'Failed to load health data');
      }
    }
  }, [dataApiBase, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || !dataApiBase) {
      setStatus('idle');
      setHealthV2(null);
      setError(null);
      return;
    }

    const requestId = nextRequestId();
    setStatus('loading');
    loadHealthData(requestId);
  }, [selectedProjectId, dataApiBase, refreshKey, loadHealthData]);

  const handleRetry = useCallback(() => {
    if (!selectedProjectId || !dataApiBase) return;
    const requestId = nextRequestId();
    setStatus('loading');
    setError(null);
    loadHealthData(requestId);
  }, [loadHealthData]);

  const handleAskAI = useCallback((file: FileHealth) => {
    setInitialPrompt(`Analyze the structural and security issues in \`${file.file_name}\` and suggest a refactoring plan. Focus on: ${file.arch_smells.join(', ')}${file.security_issues > 0 ? ', security vulnerabilities' : ''}. Provide actionable steps with priority.`);
    setDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
    setInitialPrompt('');
  }, []);

  if (!selectedProjectId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-slate-500">
          <i className="fas fa-exclamation-triangle text-4xl mb-4"></i>
          <p>No project selected</p>
          <p className="text-sm mt-2">Select a project from the sidebar to view the dashboard</p>
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--accent-teal)]/10 border border-[var(--accent-teal)]/20 flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-spinner fa-spin text-xl text-[var(--accent-teal)]"></i>
          </div>
          <p className="text-sm font-medium text-white">Loading Dashboard</p>
          <p className="text-xs text-slate-500 mt-1">Fetching health summary...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-400">
          <i className="fas fa-exclamation-circle text-4xl mb-4"></i>
          <p>Failed to load dashboard</p>
          <p className="text-sm mt-2 text-slate-400">{error}</p>
          <button
            onClick={handleRetry}
            className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-sm transition-colors"
          >
            <i className="fas fa-redo mr-2"></i>Retry
          </button>
        </div>
      </div>
    );
  }

  if (status === 'idle' || !healthV2) {
    return null;
  }

  return (
    <>
      <div className="p-6 h-full overflow-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
            <p className="text-sm text-slate-400">
              Project: <span className="text-[var(--accent-teal)]">{selectedProjectId}</span>
            </p>
          </div>

          {/* Top row: 3-column executive cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Card 1: Project Health (existing gauge) */}
            <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-6 flex flex-col items-center justify-center">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4 self-start">Project Health</h3>
              <HealthScore score={healthV2.overall_score} />
            </div>

            {/* Card 2: Security Alerts */}
            <div
              className={`rounded-xl border p-6 flex flex-col justify-between ${
                healthV2.total_security_alerts > 0
                  ? 'bg-red-50/5 border-red-200/30'
                  : 'bg-[var(--bg-surface)] border-[var(--border)]'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400">Security Alerts</h3>
                <i className={`fas fa-shield-halved text-xl ${healthV2.total_security_alerts > 0 ? 'text-red-400' : 'text-emerald-400'}`}></i>
              </div>
              <div className="text-center">
                <span className={`text-5xl font-bold ${healthV2.total_security_alerts > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {healthV2.total_security_alerts}
                </span>
                <p className="text-xs text-slate-500 mt-2">
                  {healthV2.total_security_alerts === 0 ? 'No critical vulnerabilities detected' : 'Critical issues require attention'}
                </p>
              </div>
              {healthV2.total_security_alerts > 0 && (
                <div className="mt-4 flex items-center gap-2 text-red-400 text-[10px]">
                  <i className="fas fa-exclamation-triangle"></i>
                  <span>Review flagged files in leaderboard below</span>
                </div>
              )}
            </div>

            {/* Card 3: Architecture Debt */}
            <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400">Architecture Debt</h3>
                <i className="fas fa-layer-group text-xl text-amber-400"></i>
              </div>
              <div className="text-center">
                <span className="text-5xl font-bold text-amber-400">{healthV2.total_arch_debt}</span>
                <p className="text-xs text-slate-500 mt-2">
                  Smells + Hubs combined
                </p>
              </div>
              {healthV2.files?.length > 0 && (
                <div className="mt-4 text-amber-400/60 text-[10px] flex items-center gap-2">
                  <i className="fas fa-info-circle"></i>
                  <span>{healthV2.files?.filter(f => f.arch_smells.length > 0).length ?? 0} files with issues</span>
                </div>
              )}
            </div>
          </div>

          {/* Risk Leaderboard Table */}
          <div>
            <RiskLeaderboard
              files={healthV2.files}
              onAskAI={handleAskAI}
            />
          </div>
        </div>
      </div>

      {/* AI Chat Drawer */}
      <AIChatDrawer
        isOpen={drawerOpen}
        onClose={handleCloseDrawer}
        initialPrompt={initialPrompt}
      />
    </>
  );
};

export default Dashboard;