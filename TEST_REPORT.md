# Test report

Date: 2026-09-28. Windows, Node 22.23.3, real installed Google Chrome controlled by Playwright, and the real Workers/D1 runtime through Miniflare. Baseline acf644a; final source includes upstream a64e13c and 3b3bdbb. All data-bearing automated tests use disposable SQLite/D1 databases. No real customer/order or live migration was created by testing.

## Baseline before changes

| Command | Result |
|---|---|
| Application npm test | PASS: smoke, sync-smoke, platform, resilience, storefront |
| Root npm ci | PASS: 52 packages |
| Root npm run build | PASS |
| Root npm test | PASS: 11 hosted-cloud checks |
| PowerShell tools/test.ps1 | PASS: all five application suites |
| Chrome baseline, six staff roles | Login/navigation exercised; Kitchen customer navigation and unreachable user-edit controls identified |

The passing baseline did not provide account, loyalty, remote command, release installer or comprehensive authorization coverage.

## Final executed checks

| Command / suite | Exact final result |
|---|---|
| Root npm ci --offline --cache .runtime/npm-cache --no-audit --no-fund | PASS: 55 packages installed from the available cache |
| npm run check | PASS: 90 JavaScript/CommonJS/module files parsed |
| npm run build | PASS: Worker and customer assets generated; staff POS pages and restaurant data excluded |
| npm test --prefix trackbite-system | PASS: all five original suites, including after merging newest GitHub changes |
| powershell -NoProfile -ExecutionPolicy Bypass -File tools/test.ps1 | PASS: five suites; machine execution policy unchanged |
| Root npm test: hosted-cloud.cjs | PASS: 11 checks, real D1 persistence, private sync auth, concurrent duplicate ordering and status replay |
| Root npm test: security.cjs | PASS: 640 authorization cases covering 94 protected endpoints, plus validation/session/stock/loyalty/security checks |
| Root npm test: accounts.cjs | PASS: 12 check groups, scrypt, unique phone, two-device cookie sessions, addresses/favourites/history isolation, logout/password revocation, concurrent redemption and origin rejection |
| Root npm test: connected.cjs | PASS: 17 check groups, actual POS + Worker/D1, offline recovery, poison event isolation, accounts/loyalty/refunds/rewards, remote commands and catalog revisions |
| Root npm test: updates.cjs | PASS: 5 approval/version/integrity/source checks |
| npm run test:browser | PASS: 8 workflow groups; desktop and 390-pixel mobile; zero unexpected console errors or page errors |
| powershell -NoProfile -ExecutionPolicy Bypass -File tools/test-updater.ps1 | PASS: success, bad-checksum rejection, failed-health application rollback; orders/secrets/committed migrations preserved |
| git diff --check | PASS |

The authorization count includes permission decisions for allowed combinations, HTTP denials for every forbidden role/route, and HTTP 401 for anonymous access to every protected route. Separate integration/browser scenarios exercise successful business operations. It does not imply every possible successful payload for every endpoint was executed.

The security suite also runs inventory edge cases: FIFO/FEFO/preferred ordering, variant-specific rejection, brand substitution, timezone expiry boundary, physical consumption restrictions, duplicate stocktake rejection, invalid expiry, negative-ledger prevention, and failed production/transfer rollback. Migration tests upgrade pre-daily-numbering and pre-identity snapshots containing an existing order, preserving user/stock/order data and passing SQLite integrity checks. Staff session revocation, global IDs and migration idempotency are checked.

Browser coverage: Arabic/English direction, signup/login/logout, account address save, search, favourites, customization/notes, cart quantity edits, pickup and delivery checkout, tracking, cross-device history/reorder, points/reward display; all six staff role logins/navigation; shift open/close, customer lookup/attachment, split payment, receipt preview, order progression, receive/transfer/waste/production/stocktake, recipe editing and reports; remote Owner login, price change, recipe-based publication and reward creation.

## Failures found during implementation

Phone-pattern browser errors, collection-selector customer attachment errors, a required remote-form reason omitted by the test, an asynchronous refresh race, and a quoted numeric selector in the test were corrected before the final browser pass. A new cloud-balance assertion exposed an incorrect HTTP request option; the endpoint and assertion now pass. Initial new stock fixture setup attempted a forbidden immutable update, omitted a required batch field and asserted the wrong invalid-location error; the fixture now inserts valid immutable rows and verifies rollback. These were not ignored failures.

PowerShell blocks npm.ps1 under the machine policy; npm.cmd is used for direct npm commands. The Node SQLite experimental warning is expected runtime output, not a browser console error or a failing assertion.

## Boundaries

CI is configured for Ubuntu application/build/Worker/browser checks and Windows updater checks. Local results do not themselves prove remote GitHub CI passed; consult the PR's check results for that separate run. Do not merge while required checks fail.

The actual hosted 0.6 rollout/smoke test is pending the explicit authorization required by phase 24. Physical thermal printers, Arabic raster output on actual hardware, Windows spoolers and a real cash drawer have not been certified. Existing tests simulate transport/queue behavior. Use HARDWARE_ACCEPTANCE.md.

No GitHub Release package has been published or installed on the restaurant PC. Updater network/service operations are mocked in disposable Windows workspaces. Historical-database compatibility must be reviewed before approving a real release. See DEPLOYMENT_CHECKLIST.md.
