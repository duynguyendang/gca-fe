/**
 * OKF Service — Thin wrappers around /api/v1/query?raw=true for OKF-specific Datalog queries.
 */
import { executeQuery } from './graphService';
import { OKF_PREDICATES } from '../constants';
import type { OKFSmellItem, OKFSmellResponse } from '../types';

function esc(id: string): string {
  return id.replace(/"/g, '\\"');
}

function cleanBase(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * Fetch all OKF concepts (IDs + titles + types) using batch endpoint.
 */
export async function fetchOKFConcepts(
  dataApiBase: string,
  projectId: string
): Promise<Array<{ id: string; title: string; type: string }>> {
  const url = `${cleanBase(dataApiBase)}/api/v1/okf/concepts?project=${encodeURIComponent(projectId)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      // Fallback to Datalog query if batch endpoint not available
      return fetchOKFConceptsLegacy(dataApiBase, projectId);
    }
    const data = await response.json();
    return (data.concepts || []).map((c: any) => ({
      id: c.id,
      title: c.title || c.id,
      type: c.type || 'okf_concept',
    }));
  } catch {
    return fetchOKFConceptsLegacy(dataApiBase, projectId);
  }
}

/**
 * Legacy fallback for fetchOKFConcepts using Datalog queries.
 */
async function fetchOKFConceptsLegacy(
  dataApiBase: string,
  projectId: string
): Promise<Array<{ id: string; title: string; type: string }>> {
  const q = `triples(Subject, "${OKF_PREDICATES.ROLE}", Role)`;
  const result = await executeQuery(dataApiBase, projectId, q, false, null, true);
  const triples = result?.results || result?.triples || [];
  const conceptIds: string[] = triples
    .filter((t: any) => (t[2] || t.Role || t.role) === OKF_PREDICATES.CONCEPT)
    .map((t: any) => t[0] || t.Subject || t.subject)
    .filter(Boolean);

  if (conceptIds.length === 0) return [];

  const titlePromises = conceptIds.map(async (id) => {
    const tq = `triples("${esc(id)}", "${OKF_PREDICATES.TITLE}", Title)`;
    const tr = await executeQuery(dataApiBase, projectId, tq, false, null, true);
    const rows = tr?.results || tr?.triples || [];
    const title = rows.length > 0 ? (rows[0][2] || rows[0].Title || rows[0].title || id) : id;
    return { id, title, type: 'okf_concept' };
  });

  return Promise.all(titlePromises);
}

/**
 * Fetch all okf_link facts (concept → concept) using batch endpoint.
 * Filters to only concept-to-concept links (not code-path bridges).
 */
export async function fetchOKFLinks(
  dataApiBase: string,
  projectId: string
): Promise<Array<{ source: string; target: string }>> {
  const url = `${cleanBase(dataApiBase)}/api/v1/okf/links?project=${encodeURIComponent(projectId)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return fetchOKFLinksLegacy(dataApiBase, projectId);
    }
    const data = await response.json();
    const links = data.links || [];
    // Filter to only concept-to-concept links (target must be an OKF concept URI)
    return links.filter((l: any) => l.target && l.target.includes('/okf/'));
  } catch {
    return fetchOKFLinksLegacy(dataApiBase, projectId);
  }
}

/**
 * Legacy fallback for fetchOKFLinks using Datalog queries.
 */
async function fetchOKFLinksLegacy(
  dataApiBase: string,
  projectId: string
): Promise<Array<{ source: string; target: string }>> {
  const q = `triples(Subject, "${OKF_PREDICATES.LINK}", Object)`;
  const result = await executeQuery(dataApiBase, projectId, q, false, null, true);
  const triples = result?.results || result?.triples || [];
  return triples
    .map((t: any) => ({
      source: t[0] || t.Subject || t.subject,
      target: t[2] || t.Object || t.object,
    }))
    // Filter to only concept-to-concept links
    .filter((l: any) => l.target && l.target.includes('/okf/'));
}

/**
 * Fetch all bridges_to facts (concept → symbol).
 */
export async function fetchOKFBridges(
  dataApiBase: string,
  projectId: string
): Promise<Array<{ conceptId: string; symbolId: string }>> {
  const q = `triples(Concept, "${OKF_PREDICATES.BRIDGE}", Symbol)`;
  const result = await executeQuery(dataApiBase, projectId, q, false, null, true);
  const triples = result?.results || result?.triples || [];
  return triples.map((t: any) => ({
    conceptId: t[0] || t.Subject || t.subject,
    symbolId: t[2] || t.Object || t.object,
  }));
}

/**
 * Fetch outgoing OKF links from a concept to other concepts (concept → concept).
 */
export async function fetchOKFLinksFromConcept(
  dataApiBase: string,
  projectId: string,
  conceptId: string
): Promise<Array<{ targetId: string; title?: string }>> {
  const q = `triples("${esc(conceptId)}", "${OKF_PREDICATES.LINK}", Target)`;
  const result = await executeQuery(dataApiBase, projectId, q, false, null, true);
  const triples = result?.results || result?.triples || [];
  const targetIds: string[] = triples.map((t: any) => t[2] || t.Object || t.object).filter(Boolean);

  // Filter to only concept-to-concept links (target starts with gca://project/.../okf/)
  const conceptTargets = targetIds.filter(id => id.includes('/okf/'));

  // Fetch titles for each target concept
  return Promise.all(
    conceptTargets.map(async (tid: string) => {
      const tq = `triples("${esc(tid)}", "${OKF_PREDICATES.TITLE}", Title)`;
      const tr = await executeQuery(dataApiBase, projectId, tq, false, null, true);
      const rows = tr?.results || tr?.triples || [];
      const title = rows.length > 0 ? (rows[0][2] || rows[0].Title || rows[0].title) : undefined;
      return { targetId: tid, title };
    })
  );
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
  const result = await executeQuery(dataApiBase, projectId, q, false, null, true);
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
  const result = await executeQuery(dataApiBase, projectId, q, false, null, true);
  const triples = result?.results || result?.triples || [];
  const conceptIds = triples.map((t: any) => t[0] || t.Subject || t.subject).filter(Boolean);

  // Fetch titles for each concept
  return Promise.all(
    conceptIds.map(async (cid: string) => {
      const tq = `triples("${esc(cid)}", "${OKF_PREDICATES.TITLE}", Title)`;
      const tr = await executeQuery(dataApiBase, projectId, tq, false, null, true);
      const rows = tr?.results || tr?.triples || [];
      const title = rows.length > 0 ? (rows[0][2] || rows[0].Title || rows[0].title) : undefined;
      return { conceptId: cid, title };
    })
  );
}

/**
 * Fetch OKF body/title/link for a concept using parallel queries.
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
  await Promise.all(
    queries.map(async ({ predicate, key }) => {
      const q = `triples("${esc(conceptId)}", "${predicate}", Value)`;
      const result = await executeQuery(dataApiBase, projectId, q, false, null, true);
      const rows = result?.results || result?.triples || [];
      if (rows.length > 0) {
        const val = rows[0][2] || rows[0].Value || rows[0].value;
        if (key === 'tags' && typeof val === 'string') {
          results[key] = val.split(',').map((s: string) => s.trim());
        } else {
          results[key] = val;
        }
      }
    })
  );

  return results;
}

async function querySmells(
  dataApiBase: string,
  projectId: string,
  smellType: string
): Promise<OKFSmellItem[]> {
  const q = `triples(Subject, "${OKF_PREDICATES.SMELL_TYPE}", "${smellType}")`;
  const result = await executeQuery(dataApiBase, projectId, q, false, null, true);
  const triples = result?.results || result?.triples || [];
  return Promise.all(
    triples.map(async (t: any) => {
      const conceptId = t[0] || t.Subject || t.subject;
      // Fetch description for context
      const dq = `triples("${esc(conceptId)}", "${OKF_PREDICATES.DESCRIPTION}", Desc)`;
      const dr = await executeQuery(dataApiBase, projectId, dq, false, null, true);
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
