import React from 'react';
import { FlatGraph } from '../types';

interface AppFooterProps {
  astData: FlatGraph | null;
  dataApiBase: string;
}

const AppFooter: React.FC<AppFooterProps> = ({ astData, dataApiBase }) => {
  const formatEndpoint = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return 'INVALID';
    }
  };

  return (
    <footer className="h-10 border-t border-white/5 flex items-center px-6 gap-8 bg-[var(--bg-main)] text-[9px] shrink-0 font-mono tracking-widest">
      <div className="text-slate-600">
        ARTIFACTS: <span className="text-[var(--accent-teal)] font-bold">{astData?.nodes?.length || 0}</span>
      </div>
      <div className="text-slate-600">
        RELATIONS: <span className="text-[var(--accent-teal)] font-bold">{astData?.links?.length || 0}</span>
      </div>
      <div className="text-slate-600">
        ENDPOINT: <span className="text-[#10b981] font-bold uppercase truncate max-w-[100px]">
          {dataApiBase ? formatEndpoint(dataApiBase) : 'NONE'}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-3 text-slate-700">
        <span className="uppercase tracking-tighter font-black italic">Gem-Code-V2.1</span>
        <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
      </div>
    </footer>
  );
};

export default AppFooter;
