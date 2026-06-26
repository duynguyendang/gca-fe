/**
 * OKFConceptDetail — Overlay panel shown when an OKF concept node is clicked in DiscoveryGraph.
 * Shows type, title, description, tags, timestamp, body, and source symbol bridges.
 */
import React, { useEffect, useState } from 'react';
import { fetchOKFConceptDetail, fetchOKFBridgesFromConcept, fetchOKFLinksFromConcept } from '../../../services/okfService';
import { useSettingsContext } from '../../../context/SettingsContext';
import { OKF_COLORS } from '../../../theme';
import MarkdownRenderer from '../../Synthesis/MarkdownRenderer';

interface OKFConceptDetailProps {
  conceptId: string;
  onClose: () => void;
  onNavigateToSymbol?: (symbolId: string) => void;
}

export const OKFConceptDetail: React.FC<OKFConceptDetailProps> = ({ conceptId, onClose, onNavigateToSymbol }) => {
  const { dataApiBase, selectedProjectId } = useSettingsContext();
  const [detail, setDetail] = useState<any>(null);
  const [bridges, setBridges] = useState<Array<{ symbolId: string; title?: string }>>([]);
  const [okfLinks, setOkfLinks] = useState<Array<{ targetId: string; title?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showFullBody, setShowFullBody] = useState(false);

  useEffect(() => {
    if (!dataApiBase || !selectedProjectId) return;
    setLoading(true);

    Promise.all([
      fetchOKFConceptDetail(dataApiBase, selectedProjectId, conceptId),
      fetchOKFBridgesFromConcept(dataApiBase, selectedProjectId, conceptId),
      fetchOKFLinksFromConcept(dataApiBase, selectedProjectId, conceptId),
    ])
      .then(([det, br, links]) => {
        setDetail(det);
        setBridges(br);
        setOkfLinks(links);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [dataApiBase, selectedProjectId, conceptId]);

  const handleSymbolClick = (symbolId: string) => {
    onNavigateToSymbol?.(symbolId);
  };

  const handleLinkClick = (href: string) => {
    // Relative paths without a scheme are source file references in the OKF body
    if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('file://') && href !== '#') {
      onNavigateToSymbol?.(href);
    }
  };

  if (loading) {
    return (
      <div className="absolute top-4 right-4 w-80 bg-[var(--bg-surface)] border border-white/10 rounded-lg shadow-2xl p-4 z-50">
        <div className="flex items-center gap-2 text-[var(--accent-teal)] text-xs">
          <i className="fas fa-spinner fa-spin"></i>
          Loading concept...
        </div>
      </div>
    );
  }

  if (!detail) return null;

  // Strip the ## Source section from body content before rendering as markdown
  // (it's displayed separately in the Source Files section)
  const bodyWithoutSource = detail.body
    ? detail.body.replace(/\n?## Source\n[\s\S]*?(?=\n##|$)/, '')
    : null;

  const bodyContent = bodyWithoutSource
    ? (showFullBody ? bodyWithoutSource : bodyWithoutSource.slice(0, 500) + (bodyWithoutSource.length > 500 ? '...' : ''))
    : null;

  // Extract the "## Source" section from the body to display separately
  // if it exists, by finding markdown links to source files
  const sourceLinksFromBody: Array<{ name: string; href: string; desc: string }> = [];
  if (detail.body) {
    const sourceMatch = detail.body.match(/## Source\n([\s\S]*?)(?=\n##|$)/);
    if (sourceMatch) {
      const linkRegex = /- \[([^\]]+)\]\(([^)]+)\)(?:\s*—\s*(.+))?/g;
      let m;
      while ((m = linkRegex.exec(sourceMatch[1])) !== null) {
        sourceLinksFromBody.push({ name: m[1], href: m[2], desc: m[3] || '' });
      }
    }
  }

  return (
    <div className="absolute top-4 right-4 w-96 max-h-[85vh] overflow-y-auto bg-[var(--bg-surface)] border border-white/10 rounded-lg shadow-2xl z-50 custom-scrollbar">
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ background: OKF_COLORS.NODE }} />
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
              {detail.type || 'OKF Concept'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors bg-transparent border-none p-1"
          >
            <i className="fas fa-times text-xs"></i>
          </button>
        </div>

        {/* Title */}
        {detail.title && (
          <h3 className="text-sm font-bold text-white leading-tight">{detail.title}</h3>
        )}

        {/* Description */}
        {detail.description && (
          <p className="text-[11px] text-slate-400 leading-relaxed">{detail.description}</p>
        )}

        {/* Tags */}
        {detail.tags && detail.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {detail.tags.map((tag: string, i: number) => (
              <span key={i} className="px-2 py-0.5 bg-white/5 rounded text-[9px] text-slate-400 border border-white/5">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Timestamp */}
        {detail.timestamp && (
          <div className="text-[9px] text-slate-600">
            <i className="far fa-clock mr-1"></i>
            {new Date(detail.timestamp).toLocaleString()}
          </div>
        )}

        {/* Source Links from Body (## Source section) */}
        {sourceLinksFromBody.length > 0 && (
          <div>
            <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">
              <i className="fas fa-file-code mr-1 text-[var(--accent-teal)]"></i>
              Source Files
            </h4>
            <div className="space-y-1">
              {sourceLinksFromBody.map((src, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 cursor-pointer transition-colors group"
                  onClick={() => handleSymbolClick(src.href)}
                  title={`Navigate to ${src.name}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ background: OKF_COLORS.BRIDGE_EDGE }} />
                  <div className="min-w-0">
                    <span className="text-[11px] text-[var(--accent-teal)] group-hover:underline font-medium block truncate">
                      {src.name}
                    </span>
                    {src.desc && (
                      <span className="text-[9px] text-slate-500 block truncate">{src.desc}</span>
                    )}
                    <span className="text-[8px] text-slate-600 block truncate font-mono">{src.href}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* OKF Concept Links (concept → concept) */}
        {okfLinks.length > 0 && (
          <div>
            <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">
              <i className="fas fa-project-diagram mr-1" style={{ color: OKF_COLORS.LINK_EDGE }}></i>
              Concept Links ({okfLinks.length})
            </h4>
            <div className="space-y-1">
              {okfLinks.map((link, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 cursor-pointer transition-colors group"
                  title={`Navigate to ${link.title || link.targetId}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ background: OKF_COLORS.LINK_EDGE }} />
                  <div className="min-w-0">
                    <span className="text-[11px] text-slate-300 group-hover:text-white transition-colors block truncate">
                      {link.title || link.targetId.split('/').pop()}
                    </span>
                    <span className="text-[8px] text-slate-600 block truncate font-mono">{link.targetId}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outgoing Bridges (concept → source symbols) */}
        {bridges.length > 0 && (
          <div>
            <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">
              <i className="fas fa-link mr-1" style={{ color: OKF_COLORS.BRIDGE_EDGE }}></i>
              Source Bridges ({bridges.length})
            </h4>
            <div className="space-y-1">
              {bridges.map((bridge, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 cursor-pointer transition-colors group"
                  onClick={() => handleSymbolClick(bridge.symbolId)}
                  title={`Navigate to ${bridge.title || bridge.symbolId}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ background: OKF_COLORS.BRIDGE_EDGE }} />
                  <div className="min-w-0">
                    <span className="text-[11px] text-slate-300 group-hover:text-white transition-colors block truncate">
                      {bridge.title || bridge.symbolId}
                    </span>
                    <span className="text-[8px] text-slate-600 block truncate font-mono">{bridge.symbolId}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Body Content (rendered as markdown) */}
        {bodyContent && (
          <div>
            <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">
              <i className="fas fa-file-alt mr-1"></i>
              Body
            </h4>
            <div className="bg-[var(--bg-main)] rounded p-3 border border-white/5 text-[11px]">
              <MarkdownRenderer
                content={bodyContent}
                onLinkClick={handleLinkClick}
                onSymbolClick={handleSymbolClick}
              />
            </div>
            {bodyWithoutSource && bodyWithoutSource.length > 500 && (
              <button
                onClick={() => setShowFullBody(!showFullBody)}
                className="mt-1 text-[9px] text-[var(--accent-teal)] hover:underline bg-transparent border-none cursor-pointer"
              >
                {showFullBody ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OKFConceptDetail;