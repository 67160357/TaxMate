# Taxmate architecture

## Stack and runtime

- React 19 / React Router 7 HashRouter / Vite 6, ESM source.
- Express 5 REST API; Node.js 24+ built-in SQLite. No database server installation.
- Browser IndexedDB fallback, with an adapter API matching the local server behavior.
- Tesseract.js 6 OCR in a worker. Thai and English assets retrieved at first use.
- CSS design tokens, semantic HTML, native dialog, responsive drawer and print styles.

## Data flow

1. Frontend probes relative `./api/health` with a timeout.
2. Exact `app: taxmate` response selects local mode. Otherwise static demo mode.
3. Local mode requires an authenticated session; static mode opens seeded demo data.
4. Upload stays in frontend memory until user confirms. OCR suggests text/category; it never marks a deduction as confirmed.
5. Shared validation runs before writes. Local mode revalidates on the server independently.
6. Shared calculation ignores unverified, unsupported and out-of-year receipts, applies category/combined caps, then progressive tax.
7. CSV excludes attachments; JSON backup includes attachments. Native browser Print supports PDF output.

## Database schema

| Table | Columns | Purpose |
|---|---|---|
| users | id PK, name, email UNIQUE, salt, password, profile JSON | Account + annual salary inputs |
| receipts | id PK, user_id FK, data JSON | Receipt metadata + optional image data URL |
| sessions | token SHA256 PK, user_id FK, expires epoch ms | 24h local sessions |

Foreign keys enabled, WAL journal mode; all queries parameterized. Receipt mutations require both receipt ID and authenticated user ID. Import validation finishes before a transaction replaces any data. Demo is a shared local account with a random, undisclosed password and an explicit `/auth/demo` action.

### Browser database

`taxmate-v1` IndexedDB, object store `store`:
- `account:<email>`: name, email, salt, PBKDF2 hash
- `data:<user-id>`: profile and receipt array
- `taxmate-user` sessionStorage selects the demo identity

Browser-only identity is an interaction simulation, not an access-control boundary. All browser accounts on one browser profile can be inspected by the device user. PBKDF2 avoids casually storing cleartext passwords but does not make client-only auth secure.

## Security and operation boundary

- Local binds only 127.0.0.1; users should not expose it publicly.
- Password: Node scrypt with a per-user random 128-bit salt; timing-safe comparison.
- Session: random 256-bit token, only digest stored; HttpOnly/SameSite Strict cookie; 24-hour expiration.
- Cookie is HTTP local, so no Secure flag. A future HTTPS deployment must add it and review proxy behavior.
- Reject foreign Origin and cross-site Fetch Metadata for mutations; JSON only, no wildcard CORS.
- Authentication endpoints limited to 30 POST requests/IP/minute (prototype in-memory limiter).
- Image types limited to PNG/JPEG/WebP data URL; no SVG. Data URL max 5.6M characters (~4 MiB); JSON body cap 35 MB.
- React escapes text; no raw HTML insertion; CSV formula prefixes escaped.
- Bulk import max 1,000 rows / frontend backup file 30 MB. Imported IDs replaced by generated IDs.
- Not production-ready: no email verification/reset/MFA, distributed limiter, malware/content scanning, encrypted DB/backups, key management, tax authority integration, legal retention workflow or operational monitoring.
- Live frontend metadata and image values are user-provided. An attestation means the user checked conditions, not that Taxmate verified their legal eligibility.

## Static hosting

The build uses `base: './'` and hash navigation. It works at repository paths without a rewrite service. `npm run build` creates `dist/` and copies the same assets to `docs/`, including `.nojekyll`. GitHub Pages can deploy `/docs` directly or build through Actions and publish `dist/`.

No database or runtime attachment is committed or published. `.gitignore` excludes runtime databases and dependency folders. The static bundle contains only fictitious seed data.

## Tax engine boundaries

For salary income only: expense, personal allowance, life/health combined ceiling, mortgage ceiling, verified ordinary donation ceiling, progressive rates and withholding reconciliation. Base rules are deliberately conservative; special donation and shopping claims stay pending. Supported year is explicit (2025). Expanding to other years requires a reviewed ruleset rather than silently changing the display label.

## Extending

- Add routes/pages in `frontend/src/main.jsx` and sidebar `nav`.
- Add categories/conditions in `shared/tax.mjs`; implement calculation and boundary tests together.
- Replace `api` adapter for hosted backend or identity provider when moving beyond demo.
- Use normalized attachment/object storage and pagination before a large archive.
- Keep existing browser backup format migration-compatible; increase `version` for breaking changes.
