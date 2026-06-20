/**
 * OKF Service — Thin wrappers around /api/v1/query?raw=true for OKF-specific Datalog queries.
 */
import { executeQuery } from './graphService';
import { OKF_PREDICATES } from '../constants';
import type { OKFSmellItem, OKFSmellResponse } from '../types';

function esc(id: string): string {
  return id.replace(/"/g, '\\"');
}

/**
 * Fetch all OKF concepts (IDs + titles + types).
 */
export async function fetchOKFConcepts(
  dataApiBase: string,
  projectId: string
): Promise<Array<{ id: string; title: string; type: string }>> {
  const q = `triples(Concept, "${OKF_PREDICATES.ROLE}", "${OKF_PREDICATES.CONCEPT}")`;
  const result = await executeQuery(dataApiBase, projectId, q, false);
  const triples = result?.results || result?.triples || [];
  const conceptIds: string[] = triples.map((t: any) => t[0] || t.Subject || t.subject).filter(Boolean);

  if (conceptIds.length === 0) return [];

  // Fetch titles for all concepts
  const titlePromises = conceptIds.map(async (id) => {
    const tq = `triples("${esc(id)}", "${OKF_PREDICATES.TITLE}", Title)`;
    const tr = await executeQuery(dataApiBase, projectId, tq, false);
    const rows = tr?.results || tr?.triples || [];
    const title = rows.length > 0 ? (rows[0][2] || rows[0].Title || rows[0].title || id) : id;
    return { id, title, type: 'okf_concept' };
  });

  return Promise.all(titlePromises);
}

/**
 * Fetch all bridges_to facts (concept → symbol).
 */
export async function fetchOKFBridges(
  dataApiBase: string,
  projectId: string
): Promise<Array<{ conceptId: string; symbolId: string }>> {
  const q = `triples(Concept, "${OKF_PREDICATES.BRIDGE}", Symbol)`;
  const result = await executeQuery(dataApiBase, projectId, q, false);
  const triples = result?.results || result?.triples || [];
  return triples.map((t: any) => ({
    conceptId: t[0] || t.Subject || t.subject,
    symbolId: t[2] || t.Object || t.object,
  }));
}

/**
 * Fetch outgoing bridges from a concept to source symbols (concept → symbol).
 * Returns symbol IDs that this concept bridges to — the "source files" references.
 */
export async function fetchOKFBridgesFromConcept(
  dataApiBase: string,
  projectId: string,
  conceptId: string
): Promise<Array<{ symbolId: string; title?: string }>> {
  const q = `triples("${esc(conceptId)}", "${OKF_PREDICATES.BRIDGE}", Symbol)`;
  const result = await executeQuery(dataApiBase, projectId, q, false);
  const triples = result?.results || result?.triples || [];
  const symbolIds: string[] = triples.map((t: any) => t[2] || t.Object || t.object).filter(Boolean);

  // Fetch names for each symbol (strip prefix for display)
  return symbolIds.map((sid: string) => {
    // Try to extract a readable name from the symbol ID
    // e.g., "genkit:ai/src/chat.ts#Chat" → "ai/src/chat.ts#Chat"
    const name = sid.includes(':') ? sid.split(':').slice(1).join(':') : sid;
    return { symbolId: sid, title: name };
  });
}

/**
 * Fetch bridges for a specific symbol (symbol ← concept).
 */
export async function fetchOKFBridgesForSymbol(
  dataApiBase: string,
  projectId: string,
  symbolId: string
): Promise<Array<{ conceptId: string; title?: string }>> {
  const q = `triples(Concept, "${OKF_PREDICATES.BRIDGE}", "${esc(symbolId)}")`;
  const result = await executeQuery(dataApiBase, projectId, q, false);
  const triples = result?.results || result?.triples || [];
  const conceptIds = triples.map((t: any) => t[0] || t.Subject || t.subject).filter(Boolean);

  // Fetch titles for each concept
  return Promise.all(
    conceptIds.map(async (cid: string) => {
      const tq = `triples("${esc(cid)}", "${OKF_PREDICATES.TITLE}", Title)`;
      const tr = await executeQuery(dataApiBase, projectId, tq, false);
      const rows = tr?.results || tr?.triples || [];
      const title = rows.length > 0 ? (rows[0][2] || rows[0].Title || rows[0].title) : undefined;
      return { conceptId: cid, title };
    })
  );
}

/**
 * Fetch OKF body/title/link for a concept.
 */
export async function fetchOKFConceptDetail(
  dataApiBase: string,
  projectId: string,
  conceptId: string
): Promise<{ title?: string; description?: string; body?: string; link?: string; tags?: string[]; timestamp?: string }> {
  const queries = [
    { predicate: 'okf_title', key: 'title' },
    { predicate: 'okf_description', key: 'description' },
    { predicate: 'okf_body', key: 'body' },
    { predicate: 'okf_link', key: 'link' },
    { predicate: 'okf_tags', key: 'tags' },
    { predicate: 'okf_timestamp', key: 'timestamp' },
  ];

  const results: any = {};
  for (const { predicate, key } of queries) {
    const q = `triples("${esc(conceptId)}", "${predicate}", Value)`;
    const result = await executeQuery(dataApiBase, projectId, q, false);
    const rows = result?.results || result?.triples || [];
    if (rows.length > 0) {
      const val = rows[0][2] || rows[0].Value || rows[0].value;
      if (key === 'tags' && typeof val === 'string') {
        results[key] = val.split(',').map((s: string) => s.trim());
      } else {
        results[key] = val;
      }
    }
  }

  return results;
}

async function querySmells(
  dataApiBase: string,
  projectId: string,
  smellType: string
): Promise<OKFSmellItem[]> {
  const q = `triples(Subject, "${OKF_PREDICATES.SMELL_TYPE}", "${smellType}")`;
  const result = await executeQuery(dataApiBase, projectId, q, false);
  const triples = result?.results || result?.triples || [];
  return Promise.all(
    triples.map(async (t: any) => {
      const conceptId = t[0] || t.Subject || t.subject;
      // Fetch description for context
      const dq = `triples("${esc(conceptId)}", "${OKF_PREDICATES.DESCRIPTION}", Desc)`;
      const dr = await executeQuery(dataApiBase, projectId, dq, false);
      const dRows = dr?.results || dr?.triples || [];
      const description = dRows.length > 0 ? (dRows[0][2] || dRows[0].Desc || dRows[0].desc) : undefined;
      return {
        concept_id: conceptId,
        smell_type: smellType,
        description,
        detail: undefined,
        severity: ('high' as 'high' | 'medium' | 'low'),
      };
    })
  );
}

/**
 * Fetch all OKF smells by querying each smell_type.
 */
export async function fetchOKFSmells(
  dataApiBase: string,
  projectId: string
): Promise<OKFSmellResponse> {
  const [orphans, stale, bridgeBreak, hubAnomaly] = await Promise.all([
    querySmells(dataApiBase, projectId, 'okf_orphan_concept'),
    querySmells(dataApiBase, projectId, 'okf_stale_concept'),
    querySmells(dataApiBase, projectId, 'okf_bridge_break'),
    querySmells(dataApiBase, projectId, 'okf_hub_anomaly'),
  ]);

  const totalCount = orphans.length + stale.length + bridgeBreak.length + hubAnomaly.length;

  return {
    orphans,
    stale,
    bridge_break: bridgeBreak,
    hub_anomaly: hubAnomaly,
    total_count: totalCount,
  };
}
