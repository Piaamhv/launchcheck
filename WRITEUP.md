# Submission draft – LaunchCheck
**Overview:** LaunchCheck checks product launch copy against current docs before it ships. For PMs and marketers who publish release notes, pricing pages and sales emails. Problem: copy often quotes stale prices, limits or features.
**Demo:** https://youtu.be/J74o0UJ8U3w  **Repo:** https://github.com/Piaamhv/launchcheck
**Endpoints:** Compare finds conflicting doc versions and retires the older one (stale docs never count as evidence). Rerank selects the passages that answer each claim; its use/expand actions decide exactly what Verify sees (expand = whole doc). Verify grounds each claim and returns the quote and confidence that set the red/amber/green status; a second Verify pass against the stale docs flags claims that are out of date rather than invented.
**vs similar entries:** unlike Margin (comparing submissions to each other), LaunchCheck judges source freshness first and chains Rerank output into Verify input. Together: only current, relevant evidence is used to judge each claim.
**Uncertainty:** not_stated = amber, never false; retries with idempotency keys; graceful degradation listed in UI.
**Awards:** Best Use of Verify, Compare, or Rerank (primary); Best Overall App (default). People's Choice optional (needs LinkedIn post).
**Team:** Payam Hoveidi (solo) – payam.hoveidi@gmail.com, GitHub Piaamhv.
