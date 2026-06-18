import { useState, useEffect, useCallback } from 'react';
import { useSettingsContext } from '../context/SettingsContext';
import { fetchOKFConcepts, fetchOKFBridges, fetchOKFBridgesForSymbol as fetchBridgesForSymbol } from '../services/okfService';
import type { OKFNode, OKFBridgeLink, OKFSmellResponse } from '../types';
import { OKF_COLORS } from '../theme';

interface UseOKFDataResult {
  okfNodes: OKFNode[];
  okfBridgeLinks: OKFBridgeLink[];
  okfSmells: OKFSmellResponse | null;
  loading: boolean;
  error: string | null;
}

export function useOKFData(): UseOKFDataResult {
  const { dataApiBase, selectedProjectId } = useSettingsContext();
  const [okfNodes, setOkfNodes] = useState<OKFNode[]>([]);
  const [okfBridgeLinks, setOkfBridgeLinks] = useState<OKFBridgeLink[]>([]);
  const [okfSmells, setOkfSmells] = useState<OKFSmellResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!dataApiBase || !selectedProjectId) return;
    setLoading(true);
    setError(null);

    try {
      const [concepts, bridges] = await Promise.all([
        fetchOKFConcepts(dataApiBase, selectedProjectId).catch(() => []),
        fetchOKFBridges(dataApiBase, selectedProjectId).catch(() => []),
      ]);

      // Build OKF nodes from concepts
      const nodes: OKFNode[] = concepts.map(c => ({
        id: c.id,
        name: c.title,
        type: 'okf_concept',
        role: 'okf_concept' as const,
        okf_type: c.type,
        okf_title: c.title,
      }));

      // Build bridge links
      const links: OKFBridgeLink[] = bridges.map(b => ({
        source: b.conceptId,
        target: b.symbolId,
        relation: 'bridges_to' as const,
        source_type: 'okf' as const,
      }));

      setOkfNodes(nodes);
      setOkfBridgeLinks(links);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dataApiBase, selectedProjectId]);

  useEffect(() => {
    load();
  }, [load]);

  return { okfNodes, okfBridgeLinks, okfSmells, loading, error };
}

/**
 * Hook to fetch bridges_to facts for a specific symbol (code → concept links)
 */
export function useOKFBridgesForSymbol(symbolId: string | null | undefined): {
  concepts: Array<{ conceptId: string; title?: string }>;
  loading: boolean;
} {
  const { dataApiBase, selectedProjectId } = useSettingsContext();
  const [concepts, setConcepts] = useState<Array<{ conceptId: string; title?: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!dataApiBase || !selectedProjectId || !symbolId) {
      setConcepts([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchBridgesForSymbol(dataApiBase, selectedProjectId, symbolId)
      .then(rows => {
      if (!cancelled) {
        setConcepts(rows.map(r => ({ conceptId: r.conceptId })));
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setConcepts([]);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [dataApiBase, selectedProjectId, symbolId]);

  return { concepts, loading };
}
