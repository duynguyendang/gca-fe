
export const getShortName = (d: any): string => {
  const candidate = d.display_name || d.name || d.label;
  if (candidate) return candidate;
  return d.id ? (d.id.split(/[/:]/).pop() || d.id) : "Unknown";
};

export const getNodeStyle = (node: any) => {
  const kind = node.kind?.toLowerCase();
  switch(kind) {
    case 'func':
    case 'function': return { color: '#6366f1', glow: 'rgba(99, 102, 241, 0.4)' };
    case 'struct': return { color: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' };
    case 'interface': return { color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' };
    case 'package': return { color: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.4)' };
    default: return { color: '#94a3b8', glow: 'rgba(148, 163, 184, 0.2)' };
  }
};
