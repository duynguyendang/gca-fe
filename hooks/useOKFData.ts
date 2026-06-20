/**
 * useOKFData — Fetches OKF concepts + bridges + smells for the current project.
 * useOKFBridgesForSymbol — Fetches OKF bridges pointing TO a specific code symbol.
 */
import { useState, useEffect, useRef } from 'react';
import { fetchOKFConcepts, fetchOKFBridges, fetchOKFSmells, fetchOKFBridgesForSymbol } from '../services/okfService';
import type { OKFSmellResponse } from '../types';

export interface OKFNodeData {
  id: string;
  name: string;
  title: string;
  role: 'okf_concept';
  kind: 'okf_concept';
  type: string;
  okf_type: string;
  okf_title: string;
}

export interface OKFBridgeData {
  source: string;
  target: string;
  relation: 'bridges_to';
  source_type: 'okf';
}

export interface OKFDataResult {
  okfNodes: OKFNodeData[];
  okfBridgeLinks: OKFBridgeData[];
  okfSmells: OKFSmellResponse | null;
  loading: boolean;
  error: string | null;
}

export function useOKFData(
  dataApiBase: string | undefined,
  projectId: string | undefined
): OKFDataResult {
  const [okfNodes, setOkfNodes] = useState<OKFNodeData[]>([]);
  const [okfBridgeLinks, setOkfBridgeLinks] = useState<OKFBridgeData[]>([]);
  const [okfSmells, setOkfSmells] = useState<OKFSmellResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!dataApiBase || !projectId) {
      setOkfNodes([]);
      setOkfBridgeLinks([]);
      setOkfSmells(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchOKFConcepts(dataApiBase, projectId),
      fetchOKFBridges(dataApiBase, projectId),
      fetchOKFSmells(dataApiBase, projectId),
    ])
      .then(([concepts, bridges, smells]) => {
        if (cancelled || !mountedRef.current) return;

        const nodes: OKFNodeData[] = concepts.map(c => ({
          id: c.id,
          name: c.title,
          title: c.title,
          role: 'okf_concept' as const,
          kind: 'okf_concept' as const,
          type: c.type,
          okf_type: c.type,
          okf_title: c.title,
        }));

        const bridgeLinks: OKFBridgeData[] = bridges.map(b => ({
          source: b.conceptId,
          target: b.symbolId,
          relation: 'bridges_to' as const,
          source_type: 'okf' as const,
        }));

        setOkfNodes(nodes);
        setOkfBridgeLinks(bridgeLinks);
        setOkfSmells(smells);
        setLoading(false);
      })
      .catch((err: any) => {
        if (cancelled || !mountedRef.current) return;
        setError(err.message || 'Failed to load OKF data');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [dataApiBase, projectId]);

  return { okfNodes, okfBridgeLinks, okfSmells, loading, error };
}

/**
 * useOKFBridgesForSymbol — Fetches OKF bridges pointing TO a specific code symbol.
 * Used by CodePanel to show "Knowledge Links" for the selected code symbol.
 */
export function useOKFBridgesForSymbol(
  symbolId: string | null,
  dataApiBase?: string,
  selectedProjectId?: string
): { concepts: Array<{ conceptId: string; title?: string }>; loading: boolean; error: string | null } {
  const [concepts, setConcepts] = useState<Array<{ conceptId: string; title?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbolId || !dataApiBase || !selectedProjectId) {
      setConcepts([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchOKFBridgesForSymbol(dataApiBase!, selectedProjectId!, symbolId!)
      .then((result) => {
        if (cancelled) return;
        setConcepts(result);
        setLoading(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load knowledge links');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [symbolId, dataApiBase, selectedProjectId]);

  return { concepts, loading, error };
}
