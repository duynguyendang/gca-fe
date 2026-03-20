import React from 'react';
import { AgentStep } from '../../services/geminiService';

interface AgentStepperProps {
  steps: AgentStep[];
  isRunning: boolean;
}

const statusIcons: Record<string, string> = {
  Pending: '○',
  Running: '◉',
  Success: '✓',
  Failed: '✗',
  Corrected: '↻',
};

const statusColors: Record<string, string> = {
  Pending: 'text-slate-500',
  Running: 'text-cyan-400 animate-pulse',
  Success: 'text-emerald-400',
  Failed: 'text-red-400',
  Corrected: 'text-amber-400',
};

const AgentStepper: React.FC<AgentStepperProps> = ({ steps, isRunning }) => {
  const [expandedStep, setExpandedStep] = React.useState<number | null>(null);

  if (steps.length === 0) return null;

  return (
    <div className="border border-white/10 rounded-lg bg-[#0d171d] overflow-hidden">
      <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2">
        <span className="text-xs font-medium text-slate-300">Agent Steps</span>
        {isRunning && (
          <span className="text-xs text-cyan-400 animate-pulse">Executing...</span>
        )}
      </div>
      <div className="divide-y divide-white/5">
        {steps.map((step, i) => (
          <div
            key={i}
            className="px-4 py-2 cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => setExpandedStep(expandedStep === i ? null : i)}
          >
            <div className="flex items-center gap-3">
              <span className={`text-sm font-mono ${statusColors[step.status]}`}>
                {statusIcons[step.status]}
              </span>
              <span className="text-xs text-slate-400 font-mono w-5">{i + 1}</span>
              <span className="text-xs text-slate-300 flex-1 truncate">{step.task}</span>
              {step.status === 'Success' && step.result && (
                <span className="text-xs text-slate-500">{step.result.length} results</span>
              )}
              {step.status === 'Corrected' && (
                <span className="text-xs text-amber-400">self-corrected</span>
              )}
              {step.status === 'Failed' && (
                <span className="text-xs text-red-400">failed</span>
              )}
            </div>

            {expandedStep === i && (
              <div className="mt-2 ml-8 space-y-2">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Query</span>
                  <pre className="text-xs text-cyan-300 bg-black/30 rounded p-2 mt-1 overflow-x-auto">
                    {step.query}
                  </pre>
                </div>
                {step.error && (
                  <div>
                    <span className="text-[10px] text-red-400 uppercase tracking-wider">Error</span>
                    <p className="text-xs text-red-300 mt-1">{step.error}</p>
                  </div>
                )}
                {step.hydrated && step.hydrated.length > 0 && (
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Hydrated Nodes</span>
                    <div className="mt-1 space-y-1">
                      {step.hydrated.map((node) => (
                        <div key={node.id} className="text-xs">
                          <span className="text-emerald-400">{node.name}</span>
                          <span className="text-slate-500 ml-1">({node.kind})</span>
                          <span className="text-slate-600 ml-2 font-mono text-[10px]">{node.id}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AgentStepper;
