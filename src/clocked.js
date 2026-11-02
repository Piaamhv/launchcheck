// Clocked API client with an offline mock. Live mode when CLOCKED_API_KEY is set.
import { randomUUID } from 'node:crypto';
const BASE = process.env.CLOCKED_BASE_URL || 'https://clocked.rezolve.ai/clocked';
export const isLive = () => Boolean(process.env.CLOCKED_API_KEY);

async function call(endpoint, body, retries = 2) {
  const key = randomUUID(); // same key reused on retry (idempotent)
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(`${BASE}/${endpoint}`, { method: 'POST',
        headers: { Authorization: `Bearer ${process.env.CLOCKED_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
      if (r.ok) return r.json();
      if (i >= retries || ![408, 409, 429, 500, 502, 503, 504].includes(r.status)) throw new Error(`${endpoint} HTTP ${r.status}: ${await r.text()}`);
    } catch (e) { if (i >= retries) throw e; }
    await new Promise(s => setTimeout(s, 800 * 2 ** i));
  }
}

// ---------- mock layer (deterministic, keyword-based; shapes follow the docs) ----------
const words = s => new Set(s.toLowerCase().match(/[a-z0-9$.%]+/g) || []);
const overlap = (a, b) => { const A = words(a), B = words(b); let n = 0; A.forEach(w => B.has(w) && n++); return n / Math.max(1, A.size); };
const nums = s => (s.match(/\$?\d+(?:[.,]\d+)?%?/g) || []);
const sentences = t => t.split(/(?<=[.!?])\s+/).filter(Boolean);

const mock = {
  rerank({ query, documents }) {
    const results = documents.map((d, index) => { const s = overlap(query, d.text);
      const action = s > 0.35 ? 'use' : s > 0.2 ? 'expand' : 'skip';
      return { index, id: d.id, action, reason: action === 'skip' ? 'unrelated' : undefined, relevance_score: +s.toFixed(4), document_score: +Math.min(1, s * 1.2).toFixed(4) }; })
      .sort((a, b) => b.relevance_score - a.relevance_score);
    return { model: 'mock', results };
  },
  grounding({ documents, claims }) {
    return { model: 'mock', claims: claims.map(claim => {
      let best = null;
      for (const d of documents) for (const s of sentences(d.text)) { const o = overlap(claim, s); if (!best || o > best.o) best = { o, d, s }; }
      const cn = nums(claim), sn = best ? nums(best.s) : [];
      let verdict = !best || best.o < 0.3 ? 'not_stated' : cn.length && sn.length && !cn.some(n => sn.includes(n)) ? 'contradicted' : 'supported';
      const p = { supported: 0.05, contradicted: 0.05, not_stated: 0.05 }; p[verdict] = 0.9;
      return { claim, kind: 'claim', counted: true, ...p, verdict, source: verdict === 'not_stated' ? null : best.d.id,
        evidence: best && verdict !== 'not_stated' ? { document: best.d.id, quote: best.s, start: best.d.text.indexOf(best.s), end: best.d.text.indexOf(best.s) + best.s.length, confidence: 0.9 } : undefined };
    }) };
  },
  compare({ documents }) {
    const pairs = [];
    for (let i = 0; i < documents.length; i++) for (let j = i + 1; j < documents.length; j++) {
      const a = documents[i], b = documents[j], conflicts = [];
      for (const sa of sentences(a.text)) for (const sb of sentences(b.text)) {
        if (overlap(sa, sb) > 0.5 && nums(sa).join() !== nums(sb).join() && nums(sa).length) conflicts.push({ kind: 'conflict', confidence: 0.85, a: { document: a.id, quote: sa }, b: { document: b.id, quote: sb } });
      }
      pairs.push({ a: a.id, b: b.id, relation: conflicts.length ? 'conflicting' : overlap(a.text, b.text) > 0.3 ? 'overlapping' : 'unrelated', duplicates: [], conflicts });
    }
    return { model: 'mock', pairs, conflicts: pairs.map((p, i) => p.conflicts.length ? i : -1).filter(i => i >= 0) };
  },
};

export const rerank = b => isLive() ? call('rerank', b) : mock.rerank(b);
export const grounding = b => isLive() ? call('grounding', b) : mock.grounding(b);
export const compare = b => isLive() ? call('compare', b) : mock.compare(b);
