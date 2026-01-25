
import { PathResult } from '../../../utils/pathfinding';

export const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '148,163,184';
    return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
};

export const buildHierarchy = (nodes: any[], useFilePath = true) => {
    const root: any = { name: "root", children: {}, _isFolder: true };
    nodes.forEach(node => {
        if (!node || !node.id) return;
        const idPath = useFilePath && node.metadata?.file_path ? node.metadata.file_path : (node.id.split(':')[0]);
        const parts = idPath.split('/').filter(Boolean);
        if (parts.length === 0) return;
        let current = root;
        parts.forEach((part: string, i: number) => {
            const isFile = i === parts.length - 1;
            if (!current.children) current.children = {};
            if (!current.children[part]) {
                current.children[part] = {
                    name: part,
                    children: {},
                    _isFolder: !isFile,
                    _isFile: isFile,
                    _path: parts.slice(0, i + 1).join('/')
                };
            }
            if (isFile) {
                const existing = current.children[part];
                const lineCount = node.metadata?.line_count || (node.end_line - node.start_line) || node.value || existing?.value || 1;
                current.children[part] = {
                    ...existing,
                    ...node,
                    name: part,
                    value: lineCount,
                    _isFolder: false,
                    _isFile: true,
                    _path: parts.join('/')
                };
            }
            current = current.children[part];
        });
    });

    const convert = (node: any): any => {
        const childrenArr = Object.values(node.children || {}).map(convert);
        const hasChildren = childrenArr.length > 0;
        return {
            name: node.name,
            _isFolder: node._isFolder,
            _isFile: node._isFile,
            _path: node._path,
            line_count: node.value,
            ...(hasChildren ? { children: childrenArr } : { value: node.value || 1 })
        };
    };

    return { name: "root", _isFolder: true, children: Object.values(root.children).map(convert) };
};

export const isVirtualLink = (link: any): boolean => {
    if (link.source_type === 'virtual') return true;
    const relation = link.relation || '';
    return relation.startsWith('v:');
};

export const getLinkColor = (link: any): string => {
    if (isVirtualLink(link)) {
        return '#a855f7'; // Purple for virtual links
    }
    return '#475569'; // Default slate color for AST links
};

export const getLinkOpacity = (link: any): number => {
    if (link.weight !== undefined) {
        return 0.2 + (link.weight * 0.8);
    }
    return isVirtualLink(link) ? 0.6 : 0.7;
};

export const isInTracePath = (nodeId: string, pathResult: PathResult | null): boolean => {
    if (!pathResult) return false;
    return pathResult.path.includes(nodeId);
};

export const isInTracePathLink = (sourceId: string, targetId: string, pathResult: PathResult | null): boolean => {
    if (!pathResult) return false;
    return pathResult.links.some(link => {
        const s = typeof link.source === 'string' ? link.source : link.source.id;
        const t = typeof link.target === 'string' ? link.target : link.target.id;
        return (s === sourceId && t === targetId) || (s === targetId && t === sourceId);
    });
};

export const needsHydration = (node: any): boolean => {
    return !node.code && node.kind !== 'file' && node.kind !== 'package' && node.kind !== 'folder';
};

export const getAccent = (kind: string) => {
    switch (kind?.toLowerCase()) {
        case 'func': return '#00f2ff';
        case 'struct': return '#10b981';
        case 'interface': return '#f59e0b';
        case 'file': return '#0ea5e9';
        case 'package': return '#8b5cf6';
        default: return '#94a3b8';
    }
};

export const getSymbol = (kind: string) => {
    switch (kind?.toLowerCase()) {
        case 'func': return 'Σ';
        case 'struct': return '{}';
        case 'interface': return 'I';
        case 'file': return '◫';
        default: return '◈';
    }
};

export const getNodeFill = (node: any, accentColor: string, isInPath: boolean): string => {
    if (isInPath) return 'rgba(0, 242, 255, 0.15)';
    if (needsHydration(node)) return 'rgba(168, 85, 247, 0.08)';
    return `rgba(${hexToRgb(accentColor)}, 0.15)`;
};

export const getNodeStroke = (node: any, accentColor: string, isInPath: boolean): string => {
    if (isInPath) return '#00f2ff';
    if (needsHydration(node)) return 'rgba(168, 85, 247, 0.4)';
    return accentColor;
};

export const groupNodesByParent = (nodes: any[]): Map<string, any[]> => {
    const groups = new Map<string, any[]>();
    nodes.forEach(node => {
        if (node._parentFile) {
            if (!groups.has(node._parentFile)) {
                groups.set(node._parentFile, []);
            }
            groups.get(node._parentFile)!.push(node);
        }
    });
    return groups;
};

export const isExpandableNode = (node: any): boolean => {
    return node.kind === 'file' || node._isFile || node.kind === 'package';
};

export const isNodeExpanded = (node: any, expandedFileIds: Set<string>): boolean => {
    if (!node.id) return false;
    return expandedFileIds.has(node.id);
};

export const isNodeExpanding = (node: any, expandingFileId: string | null): boolean => {
    if (!expandingFileId || !node.id) return false;
    return expandingFileId === node.id;
};

export const isFocusModeActive = (expandedFileIds: Set<string>): boolean => {
    return expandedFileIds.size > 0;
};

export const shouldShowInFocusMode = (node: any, expandedFileIds: Set<string>): boolean => {
    if (!isFocusModeActive(expandedFileIds)) return true;
    if (isNodeExpanded(node, expandedFileIds)) return true;
    if (node._parentFile && expandedFileIds.has(node._parentFile)) return true;
    return false;
};

export const getNodeOpacity = (node: any, expandedFileIds: Set<string>, defaultOpacity: number = 1): number => {
    if (!isFocusModeActive(expandedFileIds)) return defaultOpacity;
    if (shouldShowInFocusMode(node, expandedFileIds)) return 1;
    return 0.2;
};

export const calculateNodeRadius = (node: any, lineCount?: number) => {
    const lineCountVal = lineCount || node.metadata?.line_count || node.value || node.end_line - node.start_line + 1 || 20;
    return Math.sqrt(lineCountVal) * 3 + 8;
};
