# Test report

Baseline commit: acf644a. Date: 2026-09-28.

| Command | Result |
|---|---|
| trackbite-system: npm test | PASS (smoke, sync-smoke, platform, resilience, storefront) |
| root: npm ci --no-audit --no-fund | PASS, 52 packages |
| root: npm run build | PASS, Worker and customer assets |
| root: npm test | PASS, 11 hosted Worker/D1 integration checks |
| powershell -NoProfile -ExecutionPolicy Bypass -File tools/test.ps1 | PASS, all 5 suites |

Tests used temporary databases. No real order or customer was created. Physical printing, new account/loyalty functionality and remote management are not yet verified. Browser baseline and post-change results will be appended as executed.
