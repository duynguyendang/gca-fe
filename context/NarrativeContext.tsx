import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface NarrativeSection {
  type: 'summary' | 'inconsistency' | 'gravity' | 'info';
  title: string;
  content: string;
  actionLabel?: string;
}

export interface NarrativeMessage {
  role: 'user' | 'ai';
  content: string;
  displayContent?: string;
  sections?: NarrativeSection[];
  timestamp: number;
}

interface NarrativeState {
  narrativeMessages: NarrativeMessage[];
  setNarrativeMessages: React.Dispatch<React.SetStateAction<NarrativeMessage[]>>;
  isNarrativeLoading: boolean;
  setIsNarrativeLoading: React.Dispatch<React.SetStateAction<boolean>>;
  nodeInsight: string | null;
  setNodeInsight: React.Dispatch<React.SetStateAction<string | null>>;
  isInsightLoading: boolean;
  setIsInsightLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

const NarrativeContext = createContext<NarrativeState | null>(null);

export const useNarrativeContext = () => {
  const ctx = useContext(NarrativeContext);
  if (!ctx) throw new Error('useNarrativeContext must be used within NarrativeProvider');
  return ctx;
};

export const NarrativeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [narrativeMessages, setNarrativeMessages] = useState<NarrativeMessage[]>([]);
  const [isNarrativeLoading, setIsNarrativeLoading] = useState(false);
  const [nodeInsight, setNodeInsight] = useState<string | null>(null);
  const [isInsightLoading, setIsInsightLoading] = useState(false);

  return (
    <NarrativeContext.Provider value={{
      narrativeMessages, setNarrativeMessages,
      isNarrativeLoading, setIsNarrativeLoading,
      nodeInsight, setNodeInsight,
      isInsightLoading, setIsInsightLoading,
    }}>
      {children}
    </NarrativeContext.Provider>
  );
};