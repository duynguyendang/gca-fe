import React, { useState } from 'react';
import type { OKFNode } from '../../../types';
import { OKF_COLORS } from '../../../theme';

interface OKFConceptDetailProps {
  node: OKFNode;
  bridges?: Array<{ symbolId: string }>;
  onClose?: () => void;
  onSymbolClick?: (symbolId: string) => void;
}

const OKFConceptDetail: React.FC<OKFConceptDetailProps> = ({ node, bridges = [], onClose, onSymbolClick }) => {
  const [showFullBody, setShowFullBody] = useState(false);

  const bodyPreview = node.okf_body_preview || '';
  const truncated = bodyPreview.length > 500 && !showFullBody;
  const displayBody = truncated ? bodyPreview.slice(0, 500) + '...' : bodyPreview;

  return (
    <div className="bg-[var(--bg-surface)] border border-white/10 rounded-lg shadow-2xl w-80 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: OKF_COLORS.NODE }} />
          <span className="text-[9px] font-black uppercase tracking-widest text-green-400">
            {node.okf_type || 'OKF Concept'}
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors bg-transparent border-none p-0.5">
            <i className="fas fa-times text-xs"></i>
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Title */}
        <div>
          <h4 className="text-sm font-bold text-white">{node.okf_title || node.name}</h4>
          {node.okf_description && (
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">{node.okf_description}</p>
          )}
        </div>

        {/* Tags */}
        {node.okf_tags && node.okf_tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {node.okf_tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] text-gray-300">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Timestamp */}
        {node.okf_timestamp && (
          <div className="text-[10px] text-gray-500">
            <i className="fas fa-clock mr-1"></i>
            {new Date(node.okf_timestamp).toLocaleDateString()}
          </div>
        )}

        {/* Body preview */}
        {displayBody && (
          <div className="mt-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Body Preview</div>
            <div className="bg-[var(--bg-main)] rounded p-2 text-[11px] text-gray-300 font-mono max-h-40 overflow-auto leading-relaxed whitespace-pre-wrap">
              {displayBody}
            </div>
            {truncated && (
              <button
                onClick={() => setShowFullBody(true)}
                className="text-[10px] text-[var(--accent-teal)] hover:underline mt-1"
              >
                Show full body
              </button>
            )}
          </div>
        )}

        {/* Bridges */}
        {bridges.length > 0 && (
          <div className="mt-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">
              Bridges ({bridges.length})
            </div>
            <div className="space-y-1">
              {bridges.map(b => (
                <div
                  key={b.symbolId}
                  className="flex items-center gap-2 p-1.5 bg-[var(--bg-main)] rounded hover:bg-white/5 cursor-pointer transition-colors"
                  onClick={() => onSymbolClick?.(b.symbolId)}
                >
                  <i className="fas fa-link text-[10px]" style={{ color: OKF_COLORS.BRIDGE_EDGE }}></i>
                  <span className="font-mono text-[11px] text-gray-300 truncate">{b.symbolId}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Smells badge */}
        {node.okf_smells && node.okf_smells.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {node.okf_smells.map(smell => (
              <span key={smell} className="px-2 py-0.5 bg-red-500/10 border border-red-500/30 rounded text-[10px] text-red-400">
                {smell}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OKFConceptDetail;
