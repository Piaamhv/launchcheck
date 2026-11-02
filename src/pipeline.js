// LaunchCheck pipeline:
//   1. Compare  -> which doc versions conflict; older one is retired as "stale"
//   2. Rerank   -> per claim, which current passages answer it (use / expand / skip)
//   3. Verify   -> per claim, grounded ONLY in the passages Rerank kept (expand = whole doc)
//   4. Verify   -> for claims that fail, re-check against the stale docs: "copy is out of date"
import { rerank, grounding, compare, isLive } from './clocked.js';
import { readFileSync } from 'node:fs';
const RECORDED = JSON.parse(readFileSync(new URL('../fixtures/recorded.json', import.meta.url)));

const RULES = 'Judge the whole claim. If any part of a claim is contradicted, the claim is contradicted. ' +
  'A feature that is "planned" is not available. "Under X" is contradicted by a measured value above X. Use only the supplied sources.';

export function splitClaims(copy) {
  return copy.split(/(?<=[.!?])\s+(?=[A-Z])|\n+/).map(s => s.trim()).filter(s => s.length > 12).slice(0, 30);
}

async function verifyClaim(claim, documents) {
  const g = await grounding({ documents, answer: claim, claims: [claim], evidence: 'all', threshold: 0.65, instructions: RULES, rotations: 2 });
  return (g.claims || [])[0];
}

export async function check({ copy, docs }) {
  // Without a key, the demo fixture replays responses recorded from the live API; other input uses the heuristic mock.
  if (!isLive() && RECORDED[copy]) return { ...RECORDED[copy], replay: true };
  const errors = [], trace = [];
  // 1. Compare
  const stale = new Set(), conflicts = [];
  if (docs.length > 1) try {
    const c = await compare({ documents: docs.map(d => ({ id: d.id, text: d.text })), evidence: 'all',
      instructions: 'Documents describe the same product. Treat differing prices, limits, dates or features as conflicts.' });
    for (const p of c.pairs || []) if (p.relation === 'conflicting' || p.conflicts?.length) {
      const A = docs.find(d => d.id === p.a), B = docs.find(d => d.id === p.b);
      const older = (A.date || '') < (B.date || '') ? A : B; stale.add(older.id);
      conflicts.push({ a: p.a, b: p.b, stale: older.id, findings: (p.conflicts || []).map(f => ({ a: f.a?.quote, b: f.b?.quote })) });
    }
    trace.push(`compare: ${(c.pairs || []).length} pairs, ${conflicts.length} conflicting`);
  } catch (e) { errors.push(`compare: ${e.message}`); }
  const current = docs.filter(d => !stale.has(d.id)), staleDocs = docs.filter(d => stale.has(d.id));
  const passages = current.flatMap(d => d.text.split(/\n\s*\n/).map((t, i) => ({ id: `${d.id}#${i}`, doc: d.id, title: d.text.split('\n')[0], text: t })));

  const claims = splitClaims(copy);
  const report = await Promise.all(claims.map(async claim => {
    const row = { claim, passages: [] };
    // 2. Rerank: choose evidence
    let sources;
    try {
      const r = await rerank({ query: claim, documents: passages.map(p => ({ id: p.id, title: p.title, text: p.text })), top_n: 4,
        instructions: 'Keep passages that confirm or contradict the claim.' });
      row.passages = (r.results || []).filter(x => x.action !== 'skip')
        .map(x => ({ ...passages.find(p => p.id === x.id), action: x.action, score: x.relevance_score }));
      const expandDocs = new Set(row.passages.filter(p => p.action === 'expand').map(p => p.doc));
      sources = [...expandDocs].map(id => current.find(d => d.id === id)).map(d => ({ id: d.id, text: d.text }))
        .concat(row.passages.filter(p => p.action === 'use' && !expandDocs.has(p.doc)).map(p => ({ id: p.id, text: `${p.title}\n${p.text}` })));
    } catch (e) { errors.push(`rerank: ${e.message}`); }
    if (!sources?.length) { row.noDirectEvidence = true; sources = current.map(d => ({ id: d.id, text: d.text })); }
    // 3. Verify against chosen evidence
    try {
      const v = await verifyClaim(claim, sources);
      Object.assign(row, { verdict: v.verdict, p: v[v.verdict], evidence: v.evidence });
    } catch (e) { errors.push(`verify: ${e.message}`); row.verdict = 'unchecked'; }
    // 4. Out-of-date check: does a retired doc support the failing claim?
    if (staleDocs.length && ['contradicted', 'not_stated'].includes(row.verdict)) try {
      const s = await verifyClaim(claim, staleDocs.map(d => ({ id: d.id, text: d.text })));
      if (s?.verdict === 'supported') { row.staleSource = s.evidence?.document || staleDocs[0].id; row.staleQuote = s.evidence?.quote; }
    } catch (e) { errors.push(`verify-stale: ${e.message}`); }
    if (!row.evidence && row.passages[0]) row.evidence = { document: row.passages[0].doc, quote: row.passages[0].text, fromRerank: true };
    row.status = { supported: 'green', contradicted: 'red', not_stated: 'amber' }[row.verdict] || 'grey';
    return row;
  }));
  return { report, conflicts, stale: [...stale], errors, trace, live: !!process.env.CLOCKED_API_KEY };
}
