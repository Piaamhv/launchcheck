# Submission draft – LaunchCheck
**Overview:** LaunchCheck checks product launch copy against current docs before it ships. For PMs and marketers who publish release notes, pricing pages and sales emails. Problem: copy often quotes stale prices, limits or features.
**Demo:** <video link TBD>  **Repo:** <public GitHub URL TBD>
**Endpoints:** Compare finds conflicting doc versions and retires the older one; Rerank selects the passages that answer each claim; Verify grounds each claim and returns the quote. Together: only current, relevant evidence is used to judge each claim.
**Uncertainty:** not_stated = amber, never false; retries with idempotency keys; graceful degradation listed in UI.
**Awards:** Best Use of Verify, Compare, or Rerank (primary); Best Overall App (default). People's Choice optional (needs LinkedIn post).
**Team:** Payam Hoveidi (solo) – email/GitHub TBD.
