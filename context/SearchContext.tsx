import React, { createContext, useContext, useState, ReactNode } from 'react';
import { FlatGraph } from '../types';

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
}

const SearchContext = createContext<SearchState | null>(null);

export const useSearchContext = () => {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearchContext must be used within SearchProvider');
  return ctx;
};

export const SearchProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [lastExecutedQuery, setLastExecutedQuery] = useState('');
  const [queryResults, setQueryResults] = useState<FlatGraph | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);

  return (
    <SearchContext.Provider value={{
      searchTerm, setSearchTerm,
      lastExecutedQuery, setLastExecutedQuery,
      queryResults, setQueryResults,
      isSearching, setIsSearching,
      searchError, setSearchError,
      searchStatus, setSearchStatus,
    }}>
      {children}
    </SearchContext.Provider>
  );
};