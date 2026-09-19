# Taxmate validation report

Validated in the build environment on 2026-09-19.

## Build

`npm run build` passes. React production bundle generated in `dist/` and `docs/`. Hash routing and relative asset URLs checked for GitHub repository subpaths.

## Automated checks — 9 tests passed

Run with `npm test` (Node's built-in test runner):

1. Local API integration: registration, duplicate account, wrong password, cookie session, new account empty state, create receipt, invalid amount, profile update, summary, cross-user update/delete denied, cross-origin mutation denied, invalid import preserves existing data, logout invalidates session, login restores access, delete own receipt.
2. Progressive tax boundaries through 6 million THB.
3. Salary expense, personal allowance, withholding reconciliation.
4. Shared life/health insurance ceiling and health sublimit.
5. Mortgage ceiling and donation limit/order.
6. Exclusion of pending/special/out-of-year/everyday receipts.
7. Validation rejects impossible dates, negative/NaN amounts, unknown categories and SVG image payload.
8. OCR text parser recognizes total with commas and Buddhist-year date.
9. Unsupported tax year explicitly rejected.

## Browser checks

- Desktop dashboard rendered and visually inspected.
- Mobile 390px iframe viewport inspected; inner page width 375px and document scroll width 375px after layout fix (vertical scrollbar accounts for difference). This is a responsive viewport check, not a physical-phone camera test.
- Add-receipt dialog and manual fields inspected.
- Uploaded the supplied fictitious `sample-data/sample-receipt.png` through the file picker.
- Ran real Tesseract.js Thai+English worker; the clean English sample produced `TAXMATE TEST COFFEE`, 345.00, 2025-09-19 and category `food`.
- Saved the OCR result into browser IndexedDB, reloaded the page and confirmed the receipt persisted.
- Opened the calculator route and verified it rendered.
- Backend account/auth flows tested programmatically, not through a real user's credentials.

## Not validated / remaining limitations

- No deployment to the user's GitHub account performed. The workflow is supplied, but its first run must occur in the user's repository after Pages configuration.
- No physical Windows double-click test; batch file is supplied and reviewed. Local server/build tested in Linux with Node 24.
- No physical mobile camera capture test. `capture=environment` behavior depends on browser/device.
- The OCR check used a clean synthetic English receipt, with Thai and English models loaded. It does not establish Thai handwriting/blurred receipt accuracy. Manual review is required.
- No claim of full WCAG conformance or production security audit.
- No tax filing, e-Donation lookup, or validation against an official annual return engine. Tax coverage is limited as documented in README.
