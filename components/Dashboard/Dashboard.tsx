import React, { useEffect, useState, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { fetchHealthSummary, HealthSummary } from '../../services/graphService';
import HealthScore from './HealthScore';
import MetricsRadar from './MetricsRadar';
import SmellsList from './SmellsList';

interface DashboardProps {
  refreshKey?: string;
}

// Check if file paths match the expected project
function validateProjectData(smells: HealthSummary['smells'], projectId: string): { isValid: boolean; mismatches: string[] } {
  if (!smells || smells.length === 0 || !projectId) {
    return { isValid: true, mismatches: [] };
  }

  // Normalize project ID for comparison (e.g., "genkit-js" -> "genkit")
  const normalizedProject = projectId.toLowerCase().replace(/[-_]/g, '');
  
  const mismatches: string[] = [];
  const checked = new Set<string>();

  for (const smell of smells) {
    // Extract the first path segment (e.g., "genkit-go/ai/document.go" -> "genkit-go")
    const firstSegment = smell.file.split('/')[0].toLowerCase().replace(/[-_]/g, '');
    
    if (checked.has(firstSegment)) continue;
    checked.add(firstSegment);

    // Check if the path segment matches the project
    // Allow exact match after normalization (e.g., "genkitgo" matches "genkitgo")
    if (firstSegment !== normalizedProject) {
      mismatches.push(smell.file);
    }
  }

  return { 
    isValid: mismatches.length === 0, 
    mismatches: mismatches.slice(0, 3) // Show first 3 mismatches
  };
}

export const Dashboard: React.FC<DashboardProps> = ({ refreshKey }) => {
  const { dataApiBase, selectedProjectId } = useAppContext();
  const currentProjectRef = useRef<string | null>(null);

  const [healthData, setHealthData] = useState<HealthSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Abort if project changed mid-request
    const previousProject = currentProjectRef.current;
    if (previousProject && previousProject !== selectedProjectId) {
      console.log('[Dashboard] Project changed from', previousProject, 'to', selectedProjectId, '- ignoring previous response');
    }
    // Reset currentProjectRef immediately when project changes
    // This ensures any late-arriving responses from previous projects are ignored
    currentProjectRef.current = selectedProjectId;

    // Reset all state when project changes
    setHealthData(null);
    setError(null);
    setIsLoading(false);

    if (!selectedProjectId || !dataApiBase) {
      return;
    }

    currentProjectRef.current = selectedProjectId;
    console.log('[Dashboard] Loading health data for project:', selectedProjectId);

    const loadHealthData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchHealthSummary(dataApiBase, selectedProjectId);
        // Only update state if we're still on the same project we started with
        if (currentProjectRef.current === selectedProjectId) {
          console.log('[Dashboard] Received health data for', selectedProjectId, ':', data.total_smells, 'smells');
          setHealthData(data);
        } else {
          console.log('[Dashboard] Ignoring stale response for', selectedProjectId, '(current is', currentProjectRef.current, ')');
        }
      } catch (err: any) {
        if (currentProjectRef.current === selectedProjectId) {
          setError(err.message || 'Failed to load health data');
          console.error('[Dashboard] Error loading health data:', err);
        }
      } finally {
        if (currentProjectRef.current === selectedProjectId) {
          setIsLoading(false);
        }
      }
    };

    loadHealthData();
  }, [selectedProjectId, dataApiBase, refreshKey]);

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

  if (isLoading) {
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

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-400">
          <i className="fas fa-exclamation-circle text-4xl mb-4"></i>
          <p>Failed to load dashboard</p>
          <p className="text-sm mt-2 text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!healthData) {
    return null;
  }

  // Validate that smell file paths match the current project (computed synchronously, no memo needed)
  const validation = validateProjectData(healthData.smells, selectedProjectId);

  return (
    <div className="p-6 h-full overflow-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
          <p className="text-sm text-slate-400">
            Project: <span className="text-[var(--accent-teal)]">{selectedProjectId}</span>
          </p>
        </div>

        {/* Data Mismatch Warning */}
        {!validation.isValid && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <i className="fas fa-exclamation-triangle text-amber-400 mt-1"></i>
              <div>
                <h3 className="text-amber-400 font-medium mb-1">Potential Data Mismatch Detected</h3>
                <p className="text-sm text-slate-300 mb-2">
                  The smells shown contain file paths that don't appear to match the current project 
                  &quot;{selectedProjectId}&quot;. This may indicate:
                </p>
                <ul className="text-sm text-slate-400 list-disc list-inside space-y-1">
                  <li>The project was ingested from a different source directory</li>
                  <li>Stale data exists from a previous project with the same name</li>
                  <li>The data directory was reused between different projects</li>
                </ul>
                {validation.mismatches.length > 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    Example: {validation.mismatches[0]}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Top row: Health Score + Radar Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <HealthScore score={healthData.overall_score} />
          <MetricsRadar
            totalSmells={healthData.total_smells}
            totalHubs={healthData.total_hubs}
            totalEntryPoints={healthData.total_entry_points}
          />
        </div>

        {/* Bottom row: Smells List */}
        <div>
          <SmellsList smells={healthData.smells || []} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;