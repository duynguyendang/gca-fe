import React, { useState } from 'react';
import { FlatGraph } from '../types';

interface FileTreeItemProps {
    name: string;
    node: any;
    depth?: number;
    fullPath?: string;
    onNodeSelect: (node: any, isNavigation?: boolean) => void;
    astData: any;
    selectedNode: any;
    key?: string | number;
}

const FileTreeItem = ({ name, node, depth = 0, fullPath = "", onNodeSelect, astData, selectedNode }: FileTreeItemProps) => {
    const [isOpen, setIsOpen] = useState(depth < 1);
    const currentPath = fullPath ? `${fullPath}/${name}` : name;

    const children = Object.entries(node.children || {});
    const symbols = (node._symbols as any[]) || [];
    const hasChildren = children.length > 0 || symbols.length > 0;

    const isSelected = selectedNode?.id === currentPath || selectedNode?.id?.startsWith(currentPath + ':');

    const getFileIcon = (fileName: string) => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'go': return 'fa-brands fa-golang text-cyan-500';
            case 'ts':
            case 'tsx': return 'fa-brands fa-js text-blue-400';
            case 'py': return 'fa-brands fa-python text-yellow-500';
            case 'json': return 'fa-file-lines text-slate-400';
            default: return 'fa-file-code text-slate-500';
        }
    };

    const handleFileClick = () => {
        setIsOpen(!isOpen);
        if (node._isFile) {
            const flatNodes = (astData as FlatGraph)?.nodes || [];
            const astNode = flatNodes.find(n => n.id === currentPath);
            if (astNode) {
                // Pass true for isNavigation to trigger graph update/flow view
                onNodeSelect({ ...astNode, _isFile: true, _filePath: currentPath }, true);
            } else {
                onNodeSelect({ id: currentPath, _isFile: true, _filePath: currentPath, _isMissingCode: true }, true);
            }
        }
    };

    return (
        <div className="select-none">
            <div
                onClick={handleFileClick}
                className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-white/5 group transition-colors ${isSelected ? 'bg-[#00f2ff]/10 text-[#00f2ff]' : ''}`}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
                <i className={`fas ${node._isFile ? getFileIcon(name) : (isOpen ? 'fa-folder-open text-slate-400' : 'fa-folder text-slate-600')} text-[10px]`}></i>
                <span className={`truncate ${node._isFile ? 'text-[11px] font-medium' : 'text-slate-500 font-bold uppercase text-[8px] tracking-[0.1em]'}`}>
                    {name}
                </span>
                {hasChildren && !node._isFile && <i className={`fas fa-chevron-right ml-auto text-[7px] transition-transform ${isOpen ? 'rotate-90' : ''} opacity-20 group-hover:opacity-100`}></i>}
            </div>

            {isOpen && (
                <div>
                    {children.map(([childName, childNode]) => (
                        <FileTreeItem
                            key={childName}
                            name={childName}
                            node={childNode as any}
                            depth={depth + 1}
                            fullPath={currentPath}
                            onNodeSelect={onNodeSelect}
                            astData={astData}
                            selectedNode={selectedNode}
                        />
                    ))}
                    {symbols.map((symbol: any, idx: number) => {
                        const isActive = selectedNode?.id === symbol.node.id;
                        return (
                            <div
                                key={`${symbol.name}-${idx}`}
                                onClick={() => onNodeSelect(symbol.node)}
                                className={`flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-[#00f2ff]/10 transition-all group ${isActive ? 'bg-[#00f2ff]/20 text-[#00f2ff] font-bold border-r-2 border-[#00f2ff]' : 'text-slate-600'}`}
                                style={{ paddingLeft: `${(depth + 1) * 12 + 16}px` }}
                            >
                                <i className={`fas ${symbol.node.kind === 'struct' ? 'fa-cube' : 'fa-bolt'} text-[8px] opacity-40`}></i>
                                <span className="truncate text-[10px] font-mono group-hover:text-slate-300">
                                    {symbol.name}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default FileTreeItem;
