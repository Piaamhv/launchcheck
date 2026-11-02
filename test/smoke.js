import { readFile } from 'node:fs/promises'; import assert from 'node:assert'; import { check } from '../src/pipeline.js';
delete process.env.CLOCKED_API_KEY;
const out = await check(JSON.parse(await readFile(new URL('../fixtures/demo.json', import.meta.url))));
console.table(out.report.map(r => ({ status: r.status, claim: r.claim.slice(0, 50), stale: r.staleSource || '' })));
assert(out.stale.includes('pricing-2026-03'), 'old pricing should be stale');
assert(out.report.some(r => r.status === 'red'));

console.log('smoke ok', out.errors);
