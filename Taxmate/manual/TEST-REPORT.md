# Taxmate v2 — Validation report

Date: 2026-10-09. Runtime: Node.js 24.19.0 / SQLite 3.53.3.

## Automated verification performed

`npm test`: **20 passed, 0 failed** (includes API parent and 7 subtests; migration test; 11 tax/OCR/validation tests).

- Root and /api authentication aliases, username uniqueness/case handling, invalid credentials and registration role escalation rejected.
- Owner/admin account permissions, expert restricted, pagination bounds and username prefix search, last-admin protection.
- Receipt ownership enforced against user, expert and admin; negative amount and foreign-Origin writes rejected; invalid import preserves old data.
- Explicit expert assignment, shared attachment access, forbidden unrelated accounts, review result, edit resets pending, revoke denies access.
- 125 receipts: `/data` bounded to100 metadata rows; totals include125; page7 has5 rows; full attachment loaded by ID; backup and CSV contain all125.
- SQL query plan uses `idx_receipts_user_date`; only admin sees index metadata.
- Role/status changes revoke sessions; disabled account cannot log in; admin deletes another user.
- Password change invalidates both existing sessions; old password rejected; new password works; logout revokes server token; audit records event.
- v1 database migrated twice without data loss; valid legacy username, generated fields, index and schema version verified.
- Progressive rate boundaries, salary expense/personal allowance, life-health combined ceiling, housing/donation caps, unsupported/unverified/out-of-year exclusions, invalid receipt/prototype category rejection, OCR parser, unsupported year rejection, source-linked case, coverage warning and decimal ceiling.

`npm run build`: passed; React/Vite production assets generated in both `dist/` and `docs/`. GitHub workflow runs tests and build before deploy.

`npm run lab:index -- --rows=300000`: executed on separate synthetic SQLite DB, 5 warmups and50 measurements. Exact before/after query results matched. Full measured timings, CPU/version and SQL plans are in `indexing-results.json` and `INDEXING-RESULTS.md`. Median uses the mean of two middle observations. Timings depend on workload/machine/cache and are not production guarantees.

CLI bootstrap: tested against disposable DB using environment variables; first create succeeds, a second bootstrap with an active admin is refused. No generated account or DB is included in the ZIP.

## What this report does not claim

The cloud browser could not connect to the workspace's localhost (ERR_CONNECTION_REFUSED), so the updated pages have **not been verified through a complete browser interaction or visual pass in this revision**. Compilation and HTTP integration tests passed. Existing OCR image-reading UI remains; the parser is tested, but a fresh external Thai/English model download and image OCR were not rerun here.

No GitHub repository was created/pushed and no live GitHub Pages deployment was performed. The deployable build and workflow are included for the owner to use.

Tests validate implemented behavior and reference-based formulas within the supported scope, not legal certification, all tax cases, load/concurrency limits, external-service availability, or production security.

## Suggested classroom acceptance run

1. Open run-local, register user, create first admin through CLI, promote a separate expert.
2. Login as each role; verify its menus and attempt forbidden API requests using Postman.
3. Upload the included fictitious receipt; run OCR if network permits, correct fields and save.
4. Send bill to expert, enter review, revoke access and verify loss of access.
5. Change own password and confirm all prior sessions require login again.
6. Run indexing lab at two dataset sizes; compare plan, median/p95, write cost and file size.
7. Review year2568 source links and confirm unsupported items stay outside calculation; compare the worked case in TAX-RULES-2568.md.
8. Deploy docs to a test GitHub Pages repository: verify demo banner, browser persistence, hash routes and Local-only explanations for role features.
