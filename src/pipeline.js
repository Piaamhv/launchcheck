// LaunchCheck pipeline: Compare (stale sources) -> Rerank (evidence per claim) -> Verify (grounding per claim)
import { rerank, grounding, compare } from './clocked.js';

export async function check({ copy, docs }) {
  const errors = [];
  // 1. Compare: find conflicting doc versions; the newer doc (by date) wins, the older is marked stale.
  let stale = new Set(), conflicts = [];
  if (docs.length > 1) try {
    const c = await compare({ documents: docs.map(d => ({ id: d.id, text: d.text })), evidence: 'all',
      instructions: 'Documents describe the same product. Treat differing prices, limits, dates or features as conflicts.' });
    for (const p of c.pairs || []) if (p.relation === 'conflicting' || p.conflicts?.length) {
      const [A, B] = [docs.find(d => d.id === p.a), docs.find(d => d.id === p.b)];
      const older = (A.date || '') < (B.date || '') ? A : B; stale.add(older.id);
      conflicts.push({ a: p.a, b: p.b, stale: older.id, findings: p.conflicts || [] });
    }
  } catch (e) { errors.push(`compare: ${e.message}`); }
  const current = docs.filter(d => !stale.has(d.id));

  // 2. Split copy into claims (simple sentence split; Verify also accepts explicit claims).
  const claims = copy.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 12).slice(0, 30);

  // 3. Rerank per claim: keep passages with action "use"; "expand" pulls the whole doc.
  const passages = current.flatMap(d => d.text.split(/\n\s*\n/).map((t, i) => ({ id: `${d.id}#${i}`, doc: d.id, text: t })));
  const evidenceByClaim = {};
  await Promise.all(claims.map(async claim => {
    try {
      const r = await rerank({ query: claim, documents: passages.map(p => ({ id: p.id, text: p.text })), top_n: 5 });
      evidenceByClaim[claim] = (r.results || []).filter(x => x.action !== 'skip').map(x => ({ ...passages.find(p => p.id === x.id), action: x.action, score: x.relevance_score }));
    } catch (e) { errors.push(`rerank: ${e.message}`); evidenceByClaim[claim] = passages; }
  }));

  // 4. Verify: one grounding call over the selected passages (fallback: all current docs).
  const sel = [...new Map(Object.values(evidenceByClaim).flat().map(p => [p.doc, current.find(d => d.id === p.doc)])).values()];
  const sources = (sel.length ? sel : current).map(d => ({ id: d.id, text: d.text }));
  let verdicts = [];
  try {
    if (!sources.length) throw new Error('no current sources');
    const g = await grounding({ documents: sources, answer: copy, claims, evidence: 'all', threshold: 0.65 });
    verdicts = g.claims || [];
  } catch (e) { errors.push(`verify: ${e.message}`); }

  const report = claims.map(claim => {
    const v = verdicts.find(x => x.claim === claim) || { verdict: 'unchecked' };
    const status = { supported: 'green', contradicted: 'red', not_stated: 'amber' }[v.verdict] || 'grey';
    const nums = claim.match(/\$?\d+(?:[.,]\d+)?%?/g) || [];
    const staleHit = conflicts.find(c => nums.some(n => docs.find(d => d.id === c.stale)?.text.includes(n)));
    return { claim, status, verdict: v.verdict, p: v[v.verdict], evidence: v.evidence, passages: evidenceByClaim[claim] || [], staleSource: staleHit?.stale };
  });
  return { report, conflicts, stale: [...stale], errors, live: !!process.env.CLOCKED_API_KEY };
}
