# Taxmate v2 architecture

React 19 + React Router 7 (HashRouter) + Vite 6; Express 5, Node.js 24 built-in SQLite; Tesseract.js 6 Thai/English OCR. UI adapts through `frontend/src/data.js`: relative `/api/health` selects local mode, otherwise IndexedDB static demo. Role features require local mode.

## Database and indexes

`backend/db.mjs` migrates v1 data in place to schema v2. Missing columns are detected with `PRAGMA table_xinfo`; indexes use IF NOT EXISTS. Old accounts retain IDs/passwords/profile/receipts and receive a valid `legacy_...` username plus user role. Back up the stopped DB directory before upgrades.

| Table | Key fields | Relationships |
|---|---|---|
| users | id PK, name, email UNIQUE, username UNIQUE NOCASE, role, status, salt, password hash, profile JSON, created_at | Account |
| receipts | id PK, user_id FK, data JSON; virtual date/category/amount/verified columns | Owner; generated columns indexed |
| sessions | token SHA256 PK, user_id FK, expires | 24-hour session |
| reviews | id PK, receipt_id UNIQUE FK, owner_id FK, expert_id FK, status, comment, timestamps | Explicit owner consent, one expert per bill |
| audit | id, actor_id, action, target_id, created_at | No FK so deleted-account action remains traceable |

Foreign keys ON with cascades; WAL, busy_timeout 5000ms. Values are parameterized. Dynamic SQL identifiers are selected from fixed internal choices, never interpolated from user input. See INDEXING-LAB.md for actual index/query mappings and limitations.

List endpoints return 20 rows by default, maximum100; receipt metadata strips images/OCR. Details load one owned/shared receipt. `/data` returns only100 recent metadata rows plus SQL aggregates across all owned receipts. Calculator previews use category totals, so tax results do not depend on the displayed page. CSV/JSON exports iterate rows and respect response backpressure. Backup can exceed import's 1,000-row/30MB browser limit; larger restoration needs a stopped full SQLite directory backup, not the browser importer.

## Authentication and authorization

- scrypt + independent random salt; timing-safe hash comparison, dummy hash for unknown login.
- Random 256-bit session token; only SHA256 digest stored. HttpOnly, SameSite=Strict cookie,24h. Local HTTP binding127.0.0.1; Secure flag required if adapted to HTTPS hosting.
- Same-origin mutation check, JSON requirement, cross-site Fetch Metadata rejection; no open CORS.
- Shared in-memory limiter30 requests/IP/minute on login/register/password-change/username availability aliases.
- Registration always user. First admin created by physical local CLI; no embedded privileged credentials. Admin grants expert/admin roles.
- Server checks active status and current role each request. Role/status/password changes revoke sessions; last active admin protected.
- Owner-only receipts; admin manages accounts but does not get raw receipt access. Expert reads only an explicit review assigned to that expert. Revocation removes the review; expert demotion/disable removes assignments. Edits reset expert result to pending.
- Expert result is advisory; receipt verified is a separate owner action.
- Credentials, hashes, income, and receipt contents are excluded from public user responses and audit metadata.

Roles are enforced only through the API. Anyone with OS/file access to the local database can read it. This is a classroom/local application; not a multi-tenant production service.

## Browser-only mode

IndexedDB `taxmate-v1` / store `store`: `account:<email>` has PBKDF2 salt/hash and username; `username:<name>` maps demo login; `data:<email>` contains profile/receipts; sessionStorage selects current demo user. Old email-based browser accounts can still log in. Browser-only identity has no server security boundary. Management/password-change/reviews/index-lab UI explicitly require Local API. Never put real financial data or reused passwords in a public demo.

## Files and hosting

`shared/tax.mjs` is the same calculator/validator used on both sides; backend validates independently. `frontend/src/main.jsx` owns pages, `management.jsx` owns account/roles/reviews/lab. `manual/TAX-RULES-2568.md` maps implemented constants to official year-specific instructions; scope/warnings travel with calculation results.

Vite uses relative assets and HashRouter for `/repository/#/page`. Build generates `dist/` and identical `docs/` including `.nojekyll`. GitHub workflow deploys only frontend. No SQLite runtime or session server runs on GitHub Pages. Secrets, cookies, dependency folders, runtime/lab DBs are gitignored.

OCR downloads Tesseract language/worker assets on first use; processing stays on the browser device. Saving in local mode then sends the attachment to the local API. OCR/category suggestion never confirms a tax right.

## Operating limits

Image ≤4MiB; JSON body≤35MB; import≤1,000 rows and frontend file≤30MB. React escapes user text; SVG data URLs rejected; CSV formula prefixes escaped. No email verification/reset/MFA, production hardening, encrypted storage/backups, duplicate-bill validation, e-Donation verification, automatic law updates, or actual tax submission.

For much larger concurrent production workloads: normalize attachment storage, choose a suitable asynchronous DB/service, measure FTS/keyset strategies, add production identity and secure hosting. Current lab demonstrates indexes; it does not certify production capacity.
