# LaunchCheck

Check launch copy (release notes, pricing pages, sales emails) against your **current** product docs before it ships.

Built for the Clocked Build Challenge 2026. Uses three Clocked knowledge-layer endpoints:

| Step | Endpoint | What its output changes |
|---|---|---|
| 1 | **Compare** `/compare` | Finds conflicting doc versions (e.g. old vs new pricing). The older doc is marked *stale* and excluded from evidence; claims that match a stale doc are flagged "out of date". |
| 2 | **Rerank** `/rerank` | For each claim, picks the doc passages that answer it (`use` / `expand` / `skip`). Only kept passages' docs go to Verify; the UI shows what was kept. |
| 3 | **Verify** `/grounding` | Judges each claim only against the passages Rerank kept (`expand` = whole doc): supported / contradicted / not stated with a quote. Drives green / red / amber. |
| 4 | **Verify** again | Failing claims are re-checked against the retired docs; if a stale doc supports them, the claim is flagged "out of date" with that quote. |

## Run
```bash
node --version   # >= 20, no npm install needed
npm test         # offline smoke test (mock mode)
npm start        # http://localhost:3000
```
Live mode: copy `.env.example`, set `CLOCKED_API_KEY`, and run `CLOCKED_API_KEY=... npm start`. Without a key, the demo fixture replays responses recorded from the live API (`fixtures/recorded.json`); any other input uses a deterministic offline mock (`src/clocked.js`) with the documented response shapes, so judges can run it without credentials.

## Uncertainty and failure handling
- "Not stated" is shown as amber (needs a source), never as false.
- Each endpoint call retries with the same Idempotency-Key on 408/409/429/5xx, then the pipeline degrades: no Compare → all docs used; no Rerank → all passages; no Verify → claims shown grey "unchecked". Errors are listed in the UI.
- Demo data in `fixtures/` is synthetic.

## License
MIT
