/**
 * OKF Service — thin wrappers around /api/v1/query for OKF-specific Datalog queries.
 */
import { executeQuery } from './graphService';
import type { OKFSmellItem, OKFSmellResponse } from '../types';

interface RawQueryResult {
  results?: any[];
  [key: string]: any;
}

async function rawQuery(
  dataApiBase: string,
  projectId: string,
  datalogQuery: string
): Promise<any[]> {
  const res = await executeQuery(dataApiBase, projectId, datalogQuery, false);
  // executeQuery returns the parsed JSON; raw=true results come back as { results: [...] }
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object' && Array.isArray((res as any).results)) {
    return (res as any).results;
  }
  return [];
}

/**
 * Fetch all OKF concepts (IDs + titles + types)
 */
export async function fetchOKFConcepts(
  dataApiBase: string,
  projectId: string
): Promise<Array<{ id: string; title: string; type: string }>> {
  const ids = await rawQuery(
    dataApiBase,
    projectId,
    'triples(Concept, "has_role", "okf_concept")'
  );

  const titles = await rawQuery(
    dataApiBase,
    projectId,
    'triples(Concept, "okf_title", Title)'
  );

  const types = await rawQuery(
    dataApiBase,
    projectId,
    'triples(Concept, "okf_type", Type)'
  );

  // Index titles and types by concept id
  const titleMap = new Map<string, string>();
  for (const row of titles) {
    const concept = row.subject || row[0];
    const title = row.object || row[1];
    if (concept && title) titleMap.set(concept, title);
  }

  const typeMap = new Map<string, string>();
  for (const row of types) {
    const concept = row.subject || row[0];
    const type = row.object || row[1];
    if (concept && type) typeMap.set(concept, type);
  }

  return ids.map((row: any) => {
    const id = row.subject || row[0];
    return {
      id,
      title: titleMap.get(id) || id,
      type: typeMap.get(id) || 'unknown',
    };
  }).filter((c: any) => c.id);
}

/**
 * Fetch bridges_to facts (concept → symbol)
 */
export async function fetchOKFBridges(
  dataApiBase: string,
  projectId: string
): Promise<Array<{ conceptId: string; symbolId: string }>> {
  const rows = await rawQuery(
    dataApiBase,
    projectId,
    'triples(Concept, "bridges_to", Symbol)'
  );

  return rows.map((row: any) => ({
    conceptId: row.subject || row[0],
    symbolId: row.object || row[1],
  })).filter((b: any) => b.conceptId && b.symbolId);
}

/**
 * Fetch bridges for a specific symbol (which concepts bridge to this symbol)
 */
export async function fetchOKFBridgesForSymbol(
  dataApiBase: string,
  projectId: string,
  symbolId: string
): Promise<Array<{ conceptId: string }>> {
  const rows = await rawQuery(
    dataApiBase,
    projectId,
    `triples(Concept, "bridges_to", "${symbolId}")`
  );

  return rows.map((row: any) => ({
    conceptId: row.subject || row[0],
  })).filter((b: any) => b.conceptId);
}

/**
 * Fetch bridges from a specific concept (what symbols this concept bridges to)
 */
export async function fetchOKFBridgesFromConcept(
  dataApiBase: string,
  projectId: string,
  conceptId: string
): Promise<Array<{ symbolId: string }>> {
  const rows = await rawQuery(
    dataApiBase,
    projectId,
    `triples("${conceptId}", "bridges_to", Symbol)`
  );

  return rows.map((row: any) => ({
    symbolId: row.object || row[1],
  })).filter((b: any) => b.symbolId);
}

/**
 * Fetch all OKF smells by querying each smell_type
 */
export async function fetchOKFSmells(
  dataApiBase: string,
  projectId: string
): Promise<OKFSmellResponse> {
  const smellTypes = [
    { type: 'okf_orphan_concept', category: 'orphans' as const },
    { type: 'okf_stale_concept', category: 'stale' as const },
    { type: 'okf_bridge_break', category: 'bridge_break' as const },
    { type: 'okf_hub_anomaly', category: 'hub_anomaly' as const },
  ];

  const results = await Promise.allSettled(
    smellTypes.map(async ({ type }) => {
      const rows = await rawQuery(
        dataApiBase,
        projectId,
        `triples(Subject, "has_smell_type", "${type}")`
      );
      return { type, rows };
    })
  );

  const orphans: OKFSmellItem[] = [];
  const stale: OKFSmellItem[] = [];
  const bridge_break: OKFSmellItem[] = [];
  const hub_anomaly: OKFSmellItem[] = [];

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const { type, rows } = result.value;
    for (const row of rows) {
      const subject = row.subject || row[0];
      if (!subject) continue;

      const item: OKFSmellItem = {
        concept_id: subject,
        smell_type: type,
        severity: 'medium',
      };

      switch (type) {
        case 'okf_orphan_concept':
          orphans.push(item);
          break;
        case 'okf_stale_concept':
          stale.push(item);
          break;
        case 'okf_bridge_break':
          bridge_break.push(item);
          break;
        case 'okf_hub_anomaly':
          hub_anomaly.push(item);
          break;
      }
    }
  }

  return {
    orphans,
    stale,
    bridge_break,
    hub_anomaly,
    total_count: orphans.length + stale.length + bridge_break.length + hub_anomaly.length,
  };
}
