# Indexing experiment

Rows: 300,000 (synthetic), users: 1,000.

| Metric | Before | After |
|---|---:|---:|
| Median query ms | 11.9143 | 0.0173 |
| p95 ms | 18.6203 | 0.0523 |
| 5,000 inserts ms, no commit | 5.10 | 28.87 |
| DB bytes | 10186752 | 18538496 |

Measured median speedup: 687.7x.

Before: `SCAN receipts; USE TEMP B-TREE FOR ORDER BY`

After: `SEARCH receipts USING INDEX idx_receipts_user_date (user_id=? AND receipt_date>? AND receipt_date<?)`

Measured locally on deterministic synthetic data; warmed reads, no concurrency. 5,000 write timings exclude commit and are rolled back. Results are workload/hardware-specific, not guaranteed production speed.
