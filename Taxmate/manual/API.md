# Local REST API

Base: `http://localhost:3000/api`. Requests with a body use `Content-Type: application/json`. Session cookie is issued on login/register/demo and must be retained. Errors are JSON `{ "error": "Thai message" }`.

| Method | Path | Body / result |
|---|---|---|
| GET | /health | `{app:"taxmate",status:"ok",storage:"sqlite"}` |
| POST | /auth/register | `{name,email,password}` → user + session cookie |
| POST | /auth/login | `{email,password}` → user + session cookie |
| POST | /auth/demo | `{}` → shared local fictitious demo account |
| GET | /auth/me | current public user |
| POST | /auth/logout | `{}` → revoke current session |
| GET | /data | `{profile,receipts}` of current user |
| PUT | /profile | `{salary,bonus,withheld}` annual nonnegative numbers |
| POST | /receipts | receipt payload → created receipt + ID |
| PUT | /receipts/:id | replacement payload, only owned receipt |
| DELETE | /receipts/:id | remove owned receipt |
| GET | /summary | shared-engine calculated totals + brackets |
| POST | /import | `{profile,receipts}` replace user data transactionally |
| DELETE | /data | clear current user's receipts and annual profile |

Receipt payload:

```json
{
  "merchant": "หน่วยรับบริจาคตัวอย่าง",
  "amount": 2000,
  "date": "2025-09-01",
  "category": "donation",
  "verified": false,
  "notes": "รอตรวจหลักฐาน",
  "image": "",
  "ocrText": ""
}
```

Categories: `donation`, `special`, `health`, `life`, `mortgage`, `shopping`, `food`, `travel`, `other`.
`verified: true` only affects the four supported deductible categories. `special` remains pending even if a client sends verified=true. Date must be a real date in 2025; amount positive ≤1e9; image optional data:image/jpeg|png|webp;base64. These validations are enforced server-side.

Example using curl (macOS/Linux/Git Bash):

```bash
curl -c cookies.txt -H 'Content-Type: application/json' -d '{}' http://localhost:3000/api/auth/demo
curl -b cookies.txt http://localhost:3000/api/data
curl -b cookies.txt http://localhost:3000/api/summary
```

The frontend uses the same API through relative paths. Static GitHub Pages has no REST API; its matching operations run in the browser adapter.
