import React from 'react';
import { AgentStep } from '../../services/geminiService';

interface EvidenceViewProps {
  steps: AgentStep[];
  narrative: string;
}

/**
 * EvidenceView provides a transparent view of the agent's reasoning.
 * Each claim in the narrative is backed by a visible Datalog query
 * so users can verify the AI's claims against the actual graph data.
 */
const EvidenceView: React.FC<EvidenceViewProps> = ({ steps, narrative }) => {
  const [showEvidence, setShowEvidence] = React.useState(false);

  const successfulSteps = steps.filter(
    s => s.status === 'Success' || s.status === 'Corrected'
  );

  if (steps.length === 0) return null;

  return (
    <div className="border border-white/10 rounded-lg bg-[#0d171d] overflow-hidden">
      <button
        onClick={() => setShowEvidence(!showEvidence)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Evidence View</span>
          <span className="text-[10px] text-slate-600">
            {successfulSteps.length} queries executed
          </span>
        </div>
        <span className="text-xs text-slate-500">
          {showEvidence ? '▼' : '▶'}
        </span>
      </button>

      {showEvidence && (
        <div className="border-t border-white/5 divide-y divide-white/5">
          {successfulSteps.map((step) => (
            <div key={step.index} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-slate-500 font-mono">STEP {step.index + 1}</span>
                <span className="text-xs text-slate-300">{step.task}</span>
              </div>

              <div className="bg-black/40 rounded p-2 mb-2">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[10px] text-slate-600 uppercase">Datalog</span>
                </div>
                <code className="text-xs text-cyan-300 break-all">{step.query}</code>
              </div>

              {step.result && step.result.length > 0 && (
                <div className="bg-black/30 rounded p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-[10px] text-slate-600 uppercase">
                      Results ({step.result.length})
                    </span>
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    {step.result.slice(0, 10).map((row, ri) => (
                      <div key={ri} className="text-[10px] text-slate-400 font-mono py-0.5">
                        {Object.entries(row).map(([k, v]) => (
                          <span key={k} className="mr-2">
                            <span className="text-slate-500">{k}:</span>{' '}
                            <span className="text-slate-300">{String(v).slice(0, 80)}</span>
                          </span>
                        ))}
                      </div>
                    ))}
                    {step.result.length > 10 && (
                      <div className="text-[10px] text-slate-600 mt-1">
                        ... {step.result.length - 10} more rows
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step.hydrated && step.hydrated.length > 0 && (
                <details className="mt-2">
                  <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-400">
                    Hydrated source code ({step.hydrated.length} nodes)
                  </summary>
                  <div className="mt-1 space-y-2">
                    {step.hydrated.map((node) => (
                      <div key={node.id} className="bg-black/30 rounded p-2">
                        <div className="text-xs text-emerald-400 mb-1">
                          {node.name} <span className="text-slate-500">({node.kind})</span>
                        </div>
                        {node.code && (
                          <pre className="text-[10px] text-slate-400 max-h-24 overflow-y-auto whitespace-pre-wrap">
                            {node.code.slice(0, 500)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EvidenceView;
