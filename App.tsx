
import React, { useState, useMemo } from 'react';
import TreeVisualizer from './components/TreeVisualizer';
import { ASTNode, FlatGraph } from './types';
import { getGeminiInsight } from './services/geminiService';

const SAMPLE_DATA: any = {
  nodes: [
    { id: "cmd/gca/main.go:main", name: "main", kind: "function", start_line: 1, end_line: 100, code: "func main() {\n\tengine.Run()\n}" },
    { id: "pkg/analysis/engine.go:Run", name: "Run", kind: "function", start_line: 10, end_line: 250, code: "func (e *Engine) Run() {\n\trender.Draw()\n\trender.Canvas()\n}" },
    { id: "pkg/analysis/engine.go:Engine", name: "Engine", kind: "struct", start_line: 5, end_line: 45, code: "type Engine struct {\n\tSettings map[string]string\n}" },
    { id: "pkg/render/d3.go:Draw", name: "Draw", kind: "function", start_line: 20, end_line: 180, code: "func Draw() {\n\t// D3 implementation\n}" },
    { id: "pkg/render/canvas.go:Render", name: "Render", kind: "function", start_line: 1, end_line: 300, code: "func Render() {\n\t// Canvas implementation\n}" }
  ],
  links: [
    { source: "cmd/gca/main.go:main", target: "pkg/analysis/engine.go:Run" },
    { source: "pkg/analysis/engine.go:Run", target: "pkg/render/d3.go:Draw" },
    { source: "pkg/analysis/engine.go:Run", target: "pkg/render/canvas.go:Render" }
  ]
};

type ViewMode = 'force' | 'radial' | 'circlePacking' | 'sankey';
type LayoutStyle = 'organic' | 'flow';

const App: React.FC = () => {
  const [astData, setAstData] = useState<ASTNode | FlatGraph>(SAMPLE_DATA);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('force');
  const [layoutStyle, setLayoutStyle] = useState<LayoutStyle>('organic');
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  const [nodeInsight, setNodeInsight] = useState<string | null>(null);

  const filteredNodes = useMemo(() => {
    if (!searchQuery) return [];
    const nodes = 'nodes' in astData ? astData.nodes : [];
    return nodes.filter(n => n.id.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 8);
  }, [astData, searchQuery]);

  const handleNodeSelect = (node: any) => {
    setSelectedNode(node);
    setSearchQuery('');
    setNodeInsight(null);
  };

  const onAnalyze = async (node: any) => {
    setIsInsightLoading(true);
    try {
      const insight = await getGeminiInsight(node);
      setNodeInsight(insight);
    } catch (e) {
      setNodeInsight("Analysis failed.");
    } finally {
      setIsInsightLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#020617] overflow-hidden font-sans text-slate-200">
      <aside className={`${isSidebarOpen ? 'w-96' : 'w-0'} transition-all duration-300 glass-panel h-full flex flex-col z-20 border-r border-slate-800/50`}>
        {isSidebarOpen && (
          <div className="flex flex-col h-full p-6 overflow-y-auto">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <i className="fas fa-gem text-lg text-white"></i>
              </div>
              <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Gem Code Analysis</h1>
            </div>

            <div className="relative mb-6">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbols..."
                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-2 pl-4 pr-4 text-xs font-mono focus:outline-none focus:border-indigo-500 transition-colors"
              />
              {filteredNodes.length > 0 && (
                <div className="absolute top-full mt-2 w-full bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                  {filteredNodes.map(n => (
                    <button key={n.id} onClick={() => handleNodeSelect(n)} className="w-full px-4 py-2 text-left text-[10px] font-mono hover:bg-indigo-600/20 text-slate-400 hover:text-white border-b border-slate-800 last:border-0">{n.id}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Layout Projection</h2>
                <div className="flex bg-slate-900/80 p-0.5 rounded-lg border border-slate-800">
                  <button onClick={() => setLayoutStyle('organic')} className={`px-2 py-1 rounded-md text-[8px] font-bold uppercase ${layoutStyle === 'organic' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Organic</button>
                  <button onClick={() => setLayoutStyle('flow')} className={`px-2 py-1 rounded-md text-[8px] font-bold uppercase ${layoutStyle === 'flow' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Flow</button>
                </div>
              </div>
            </div>

            {selectedNode && (
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-[11px] font-mono text-white break-all mb-4">{selectedNode.id}</div>
                <button 
                  onClick={() => onAnalyze(selectedNode)}
                  disabled={isInsightLoading}
                  className="w-full py-2 bg-indigo-600 rounded-lg text-[10px] font-black uppercase text-white hover:bg-indigo-500 transition-all"
                >
                  {isInsightLoading ? 'Analyzing...' : 'Analyze Architecture'}
                </button>
                {nodeInsight && <p className="mt-4 text-[11px] text-slate-400 italic">{nodeInsight}</p>}
              </div>
            )}
          </div>
        )}
      </aside>

      <main className="flex-1 relative bg-[#020617]">
        <header className="absolute top-6 left-8 z-30 pointer-events-none">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-10 h-10 flex items-center justify-center bg-slate-900/90 border border-slate-800 rounded-xl text-slate-400 pointer-events-auto hover:text-white transition-all shadow-xl">
            <i className={`fas ${isSidebarOpen ? 'fa-indent' : 'fa-outdent'}`}></i>
          </button>
        </header>

        <TreeVisualizer data={astData} onNodeSelect={handleNodeSelect} onNodeHover={setHoveredNode} mode={viewMode} layoutStyle={layoutStyle} selectedId={selectedNode?.id} />
        
        {hoveredNode && (
          <div className="absolute bottom-8 right-8 p-4 bg-slate-900/95 backdrop-blur-xl border border-indigo-500/30 rounded-2xl shadow-2xl z-40 pointer-events-none min-w-[200px]">
            <div className="text-[11px] font-mono text-white mb-2">{hoveredNode.id}</div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
