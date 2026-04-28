import { useState, useCallback, useRef } from 'react';
import { fetchPaginatedGraph, PaginatedGraphOptions, PaginatedGraphResponse } from '../services/graphService';
import { logger } from '../logger';

interface UsePaginatedGraphResult {
  nodes: any[];
  links: any[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  totalNodes: number;
  totalLinks: number;
  currentPage: number;
  loadMore: () => Promise<void>;
  reset: () => void;
  loadPage: (page: number) => Promise<void>;
}

/**
 * Custom hook for managing paginated graph data with lazy loading.
 * Supports cursor-based pagination for large graph visualizations.
 *
 * @param apiBase - Base URL for the API
 * @param projectId - Project ID to query
 * @param query - Datalog query string
 * @param pageSize - Number of nodes to load per page (default: 100)
 */
export function usePaginatedGraph(
  apiBase: string,
  projectId: string,
  query: string,
  pageSize: number = 100
): UsePaginatedGraphResult {
  const [nodes, setNodes] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalNodes, setTotalNodes] = useState(0);
  const [totalLinks, setTotalLinks] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);

  const currentCursor = useRef<string | undefined>(undefined);
  const allLoadedData = useRef<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });

  /**
   * Load the next page of data using cursor-based pagination
   */
  const loadMore = useCallback(async () => {
    if (loading || !hasMore && currentPage > 0) return;

    setLoading(true);
    setError(null);

    try {
      const options: PaginatedGraphOptions = {
        limit: pageSize,
        offset: currentPage * pageSize
      };

      if (currentCursor.current) {
        options.cursor = currentCursor.current;
      }

      const response: PaginatedGraphResponse = await fetchPaginatedGraph(
        apiBase,
        projectId,
        query,
        options
      );

      // Append new data to existing data
      allLoadedData.current = {
        nodes: [...allLoadedData.current.nodes, ...response.nodes],
        links: [...allLoadedData.current.links, ...response.links]
      };

      setNodes(allLoadedData.current.nodes);
      setLinks(allLoadedData.current.links);
      setHasMore(response.has_more);
      setTotalNodes(response.total_nodes);
      setTotalLinks(response.total_links);
      setCurrentPage(prev => prev + 1);
      currentCursor.current = response.next_cursor;
    } catch (err: any) {
      setError(err.message || 'Failed to load paginated graph');
      logger.error('[usePaginatedGraph] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [apiBase, projectId, query, pageSize, loading, hasMore, currentPage]);

  /**
   * Load a specific page by offset (for direct page navigation)
   */
  const loadPage = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);

    try {
      const options: PaginatedGraphOptions = {
        limit: pageSize,
        offset: page * pageSize
      };

      const response: PaginatedGraphResponse = await fetchPaginatedGraph(
        apiBase,
        projectId,
        query,
        options
      );

      // For direct page loading, replace current data (don't append)
      allLoadedData.current = {
        nodes: response.nodes,
        links: response.links
      };

      setNodes(response.nodes);
      setLinks(response.links);
      setHasMore(response.has_more);
      setTotalNodes(response.total_nodes);
      setTotalLinks(response.total_links);
      setCurrentPage(page + 1);
      currentCursor.current = response.next_cursor;
    } catch (err: any) {
      setError(err.message || 'Failed to load page');
      logger.error('[usePaginatedGraph] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [apiBase, projectId, query, pageSize]);

  /**
   * Reset pagination state and load initial page
   */
  const reset = useCallback(() => {
    setNodes([]);
    setLinks([]);
    setLoading(false);
    setError(null);
    setHasMore(true);
    setTotalNodes(0);
    setTotalLinks(0);
    setCurrentPage(0);
    currentCursor.current = undefined;
    allLoadedData.current = { nodes: [], links: [] };
  }, []);

  return {
    nodes,
    links,
    loading,
    error,
    hasMore,
    totalNodes,
    totalLinks,
    currentPage,
    loadMore,
    reset,
    loadPage
  };
}

/**
 * Infinite scroll hook for automatically loading more data as user scrolls
 */
export function useInfiniteScroll(
  loadMore: () => Promise<void>,
  hasMore: boolean,
  loading: boolean
): (node: HTMLElement | null) => void {
  const observer = useRef<IntersectionObserver | null>(null);

  const lastElementRef = useCallback((node: HTMLElement | null) => {
    if (loading || !hasMore) return;

    if (observer.current) {
      observer.current.disconnect();
    }

    observer.current = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && hasMore) {
        loadMore();
      }
    }, {
      threshold: 0.1,
      rootMargin: '100px'
    });

    if (node) {
      observer.current.observe(node);
    }
  }, [loading, hasMore, loadMore]);

  return lastElementRef;
}
