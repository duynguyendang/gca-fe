
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import TreeVisualizer from './components/TreeVisualizer';
import { ASTNode, FlatGraph } from './types';
import { GoogleGenAI, Type } from "@google/genai";

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
  };

  const getGeminiInsight = async (node: any) => {
    if (!node) return;
    setIsInsightLoading(true);
    setNodeInsight(null);
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Analyze Go component: ID: ${node.id}, Kind: ${node.kind}, LOC: ${node.end_line - node.start_line}. Provide architectural responsibility summary in <50 words. Code snippet: ${node.code?.substring(0, 100)}`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      setNodeInsight(response.text || "Insight unavailable.");
    } catch (err) {
      setNodeInsight("Connection failed.");
    } finally {
      setIsInsightLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        setAstData(json);
        setSelectedNode(null);
      } catch (err) { alert("Invalid GCA format."); }
    };
    reader.readAsText(file);
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
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <i className="fas fa-search text-slate-600 text-xs"></i>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbols..."
                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs font-mono focus:outline-none focus:border-indigo-500 transition-colors"
              />
              {filteredNodes.length > 0 && (
                <div className="absolute top-full mt-2 w-full bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                  {filteredNodes.map(n => (
                    <button
                      key={n.id}
                      onClick={() => handleNodeSelect(n)}
                      className="w-full px-4 py-2 text-left text-[10px] font-mono hover:bg-indigo-600/20 text-slate-400 hover:text-white transition-colors border-b border-slate-800/50 last:border-0"
                    >
                      {n.id}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Layout Projection</h2>
                <div className="flex bg-slate-900/80 p-0.5 rounded-lg border border-slate-800">
                  <button 
                    onClick={() => setLayoutStyle('organic')}
                    className={`px-2 py-1 rounded-md text-[8px] font-bold uppercase transition-all ${layoutStyle === 'organic' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Organic
                  </button>
                  <button 
                    onClick={() => setLayoutStyle('flow')}
                    className={`px-2 py-1 rounded-md text-[8px] font-bold uppercase transition-all ${layoutStyle === 'flow' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Flow
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {['force', 'radial', 'circlePacking', 'sankey'].map((m) => (
                  <button 
                    key={m}
                    onClick={() => setViewMode(m as ViewMode)}
                    className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${viewMode === m ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1">
               <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Inspector</h3>
               {selectedNode ? (
                 <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                   <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                     <div className="text-[9px] font-black text-indigo-400 mb-1 uppercase tracking-tighter">Symbol Path</div>
                     <div className="text-[11px] font-mono text-white break-all mb-4 leading-relaxed">{selectedNode.id}</div>
                     
                     <div className="grid grid-cols-2 gap-2 mb-4">
                       <div className="p-2 bg-slate-800 rounded text-center">
                         <div className="text-[7px] text-slate-500 uppercase font-black">Type</div>
                         <div className="text-[10px] text-indigo-300 font-bold uppercase">{selectedNode.kind || 'Unknown'}</div>
                       </div>
                       <div className="p-2 bg-slate-800 rounded text-center">
                         <div className="text-[7px] text-slate-500 uppercase font-black">Span</div>
                         <div className="text-[10px] text-emerald-300 font-bold">{selectedNode.end_line - selectedNode.start_line} LOC</div>
                       </div>
                     </div>
                     
                     {selectedNode.code && (
                       <div className="mb-4">
                         <div className="flex items-center justify-between mb-2">
                           <div className="text-[8px] font-black text-slate-600 uppercase">Source Code</div>
                           <div className="text-[8px] font-mono text-slate-700">L{selectedNode.start_line}</div>
                         </div>
                         <pre className="p-3 bg-black/40 rounded-lg text-[10px] font-mono text-slate-300 overflow-x-auto border border-white/5 max-h-48 scrollbar-hide">
                           {selectedNode.code}
                         </pre>
                       </div>
                     )}

                     <button 
                      onClick={() => getGeminiInsight(selectedNode)}
                      disabled={isInsightLoading}
                      className={`w-full py-2.5 ${isInsightLoading ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white'} rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10`}
                     >
                       {isInsightLoading ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
                       {isInsightLoading ? 'Analyzing...' : 'Analyze Architecture'}
                     </button>
                   </div>

                   {nodeInsight && (
                     <div className="p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20 animate-in slide-in-from-top-2 duration-300">
                       <div className="flex items-center gap-2 mb-2">
                         <i className="fas fa-brain text-indigo-400 text-[10px]"></i>
                         <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Architectural Summary</div>
                       </div>
                       <p className="text-[11px] text-slate-300 leading-relaxed italic">
                         {nodeInsight}
                       </p>
                     </div>
                   )}
                 </div>
               ) : (
                 <div className="h-48 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl text-center p-6">
                   <i className="fas fa-crosshairs text-slate-800 text-2xl mb-3"></i>
                   <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Select a node to begin analysis</span>
                 </div>
               )}
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-800/50">
              <label className="flex items-center justify-center w-full px-4 py-3 bg-slate-900/80 rounded-xl border border-slate-800 cursor-pointer hover:border-indigo-500 hover:bg-indigo-500/10 transition-all group">
                <i className="fas fa-file-export text-slate-700 group-hover:text-indigo-400 mr-3 text-xs"></i>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Load AST JSON</span>
                <input type="file" className="hidden" accept=".json" onChange={handleFileUpload} />
              </label>
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 relative bg-[#020617]">
        <header className="absolute top-6 left-8 right-8 flex items-center justify-between z-30 pointer-events-none">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-10 h-10 flex items-center justify-center bg-slate-900/90 border border-slate-800 rounded-xl text-slate-400 pointer-events-auto hover:text-white transition-all shadow-xl"
          >
            <i className={`fas ${isSidebarOpen ? 'fa-indent' : 'fa-outdent'}`}></i>
          </button>
          
          <div className="bg-slate-900/90 backdrop-blur-md px-5 py-2.5 border border-slate-800 rounded-2xl flex items-center gap-6 pointer-events-auto shadow-2xl">
             <div className="flex items-center gap-2.5">
               <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">D3 Renderer</span>
             </div>
             <div className="h-4 w-px bg-slate-700"></div>
             <div className="flex items-center gap-4">
               <div className="flex flex-col">
                 <span className="text-[7px] font-black text-slate-600 uppercase">Projection</span>
                 <span className="text-[9px] font-mono text-indigo-400 font-bold uppercase">{layoutStyle}</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-[7px] font-black text-slate-600 uppercase">View</span>
                 <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase">{viewMode}</span>
               </div>
             </div>
          </div>
        </header>

        <TreeVisualizer 
          data={astData} 
          onNodeSelect={handleNodeSelect} 
          onNodeHover={setHoveredNode}
          mode={viewMode}
          layoutStyle={layoutStyle}
          selectedId={selectedNode?.id}
        />
        
        {hoveredNode && (
          <div className="absolute bottom-8 right-8 p-4 bg-slate-900/95 backdrop-blur-xl border border-indigo-500/30 rounded-2xl shadow-2xl z-40 pointer-events-none animate-in fade-in zoom-in-95 duration-200 min-w-[200px]">
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${hoveredNode.kind === 'function' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></span>
              <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{hoveredNode.kind}</div>
            </div>
            <div className="text-[11px] font-mono text-white mb-2 truncate max-w-[300px]">{hoveredNode.id}</div>
            {hoveredNode.code && (
              <div className="text-[9px] font-mono text-slate-500 italic border-l-2 border-indigo-500/50 pl-3 py-1 bg-white/5 rounded-r">
                {hoveredNode.code.split('\n')[0].trim().substring(0, 40)}...
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
