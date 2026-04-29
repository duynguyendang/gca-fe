import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { FlatGraph } from '../types';
import { ConversationTurn } from '../services/geminiService';

const CONVERSATION_HISTORIES_KEY = 'gca-conversation-histories';

interface SearchState {
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  lastExecutedQuery: string;
  setLastExecutedQuery: React.Dispatch<React.SetStateAction<string>>;
  queryResults: FlatGraph | null;
  setQueryResults: React.Dispatch<React.SetStateAction<FlatGraph | null>>;
  isSearching: boolean;
  setIsSearching: React.Dispatch<React.SetStateAction<boolean>>;
  searchError: string | null;
  setSearchError: React.Dispatch<React.SetStateAction<string | null>>;
  searchStatus: string | null;
  setSearchStatus: React.Dispatch<React.SetStateAction<string | null>>;
  conversationHistory: ConversationTurn[];
  addConversationTurn: (turn: ConversationTurn) => void;
  clearConversationHistory: () => void;
}

const SearchContext = createContext<SearchState | null>(null);

export const useSearchContext = () => {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearchContext must be used within SearchProvider');
  return ctx;
};

type ConversationHistories = Record<string, ConversationTurn[]>;

const loadHistories = (): ConversationHistories => {
  try {
    const stored = localStorage.getItem(CONVERSATION_HISTORIES_KEY);
    if (stored) {
      return JSON.parse(stored) as ConversationHistories;
    }
  } catch (e) {
    console.warn('Failed to load conversation histories:', e);
  }
  return {};
};

const saveHistories = (histories: ConversationHistories) => {
  try {
    localStorage.setItem(CONVERSATION_HISTORIES_KEY, JSON.stringify(histories));
  } catch (e) {
    console.warn('Failed to save conversation histories:', e);
  }
};

interface SearchProviderProps extends React.PropsWithChildren {
  projectId?: string;
}

export const SearchProvider: React.FC<SearchProviderProps> = ({ children, projectId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [lastExecutedQuery, setLastExecutedQuery] = useState('');
  const [queryResults, setQueryResults] = useState<FlatGraph | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [histories, setHistories] = useState<ConversationHistories>(loadHistories);
  const [currentHistory, setCurrentHistory] = useState<ConversationTurn[]>([]);

  useEffect(() => {
    if (projectId) {
      setCurrentHistory(histories[projectId] || []);
    }
  }, [projectId, histories]);

  useEffect(() => {
    if (projectId && currentHistory.length >= 0) {
      const newHistories = { ...histories, [projectId]: currentHistory };
      saveHistories(newHistories);
    }
  }, [currentHistory, projectId]);

  const addConversationTurn = useCallback((turn: ConversationTurn) => {
    setCurrentHistory(prev => {
      const updated = [...prev, turn];
      return updated.slice(-9);
    });
  }, []);

  const clearConversationHistory = useCallback(() => {
    setCurrentHistory([]);
    if (projectId) {
      const newHistories = { ...histories };
      delete newHistories[projectId];
      saveHistories(newHistories);
      setHistories(newHistories);
    }
  }, [projectId, histories]);

  return (
    <SearchContext.Provider value={{
      searchTerm, setSearchTerm,
      lastExecutedQuery, setLastExecutedQuery,
      queryResults, setQueryResults,
      isSearching, setIsSearching,
      searchError, setSearchError,
      searchStatus, setSearchStatus,
      conversationHistory: currentHistory,
      addConversationTurn,
      clearConversationHistory,
    }}>
      {children}
    </SearchContext.Provider>
  );
};