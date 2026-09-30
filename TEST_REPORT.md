# Test report — forms, customers, categories and invoice details

Invoice-header follow-up, 30 September: syntax check passed (130 files), both updated browser suites passed (11 and 16 groups), the 12 UX service scenarios passed, and all five application suites passed. Tests assert supplier/date retention through UI creation, database snapshots, restart, reopening and downloaded HTML. Legacy missing-supplier snapshots resolve their recorded supplier link without mutating history; invalid calendar dates roll back before any purchase is saved.

30 September 2026: all root service suites, all five application suites, and all four browser suites passed. Source validation covers **130 files**; authorization covers **843 denial cases over 123 protected endpoints**. The new `customer-workflows.cjs` suite adds **11** service/browser groups covering Egyptian number formats, duplicate records and preserved loyalty history, linked customer edits/session revocation, protected categories, immutable invoice snapshots/reopening/export, form cancellation and Arabic permissions. The existing browser suites retain their 8, 5 and 16 passing groups. See [change details](CUSTOMER_AND_FORMS_FIXES.md).

## Earlier UX validation

Executed 28 September 2026 on Windows with Node 22.23.3, installed Google Chrome through Playwright, and Workers/D1 through Miniflare. Transactional tests use disposable databases and test accounts. No new production order, sale, refund or stock movement was created for these tests.

## Final commands and results

| Command / suite | Result |
|---|---|
| npm run check | PASS — 123 JavaScript/CommonJS/module files, including module parsing |
| npm run build | PASS — Worker/customer assets; staff app and local data excluded |
| Root npm test: hosted-cloud | PASS — 12 check groups |
| Root npm test: security | PASS — 794 authorization cases over 116 protected endpoints, plus 20 check groups |
| Root npm test: accounts | PASS — 13 check groups |
| Root npm test: connected | PASS — 17 check groups |
| Root npm test: updates | PASS — 5 check groups |
| Root npm test: online-orders | PASS — 21 scenarios |
| Root npm test: real-menu | PASS — 15 scenarios |
| Root npm test: ux-service | PASS — 12 scenarios |
| npm test --prefix trackbite-system | PASS — all 5 suites: smoke, sync-smoke, platform, resilience, storefront |
| npm run test:browser: browser.cjs | PASS — 8 check groups, including all six staff roles |
| npm run test:browser: kitchen-browser.cjs | PASS — 5 scenario groups, simultaneous customer/Owner/Kitchen browsers |
| npm run test:browser: ux-browser.cjs | PASS — 16 workflow groups |
| git diff --check | PASS |

## UX simplification evidence

The 12 service scenarios cover normalized material/supplier reuse; default locations and displayed units; purchase unit/total conversion and retry idempotency; unknown-price rejection and historical-unit protection; stock transfer and production; reusable templates; preview without writes; atomic import rollback and repeat prevention; archive with stock history intact; and explicit resolution of ambiguous invoice matches.

The 16 Playwright groups exercise inline selling-price changes; material creation, inline edits, archive and restore; invoices with a new supplier/existing material and existing supplier/new material; CSV preview and commit; compact recipe editing; warehouse transfer; saved production templates; cashier hover preview and acceptance; one-click kitchen progress and ready-order payment; task Help; global search; and Arabic mobile rendering with no unexpected browser errors. Desktop material/invoice screenshots and the Arabic mobile screenshot were visually inspected. The original staff browser tests still cover the detailed inventory tools through their new More details entry point.

## Order confirmation evidence

The 21 order scenarios cover durable arrival without transactional side effects; restart before acceptance; simultaneous Accept; duplicate checkout; customer-visible rejection; stock shortage rollback; retry without acceptance; injected failures after stock deduction, before print queue, before cloud mapping and before local decision commit; cloud ACK failures both before and after cloud commit; price changes; outage and restart; forward-only fulfillment with independent payment; payment insertion failure; tracking; duplicate refunds; printer transport failure; and stale-heartbeat checkout pause.

Both ACK failure scenarios also progress the kitchen while acknowledgement is unavailable, restart the POS process, and verify the queued progress arrives after recovery without another order, deduction or ticket. Hosted tests verify both replayed and newly identified stale events cannot regress terminal fulfillment or paid status. Account tests reject a reward-backed order twice and verify its reservation is restored exactly once.

The browser tests exercise pickup in English and delivery in Arabic at mobile width, with modifiers and item/order notes. Before Accept, no local order or preparation action appears. Explicit acceptance creates the kitchen card automatically, one-tap statuses update customer tracking, and fulfillment persists after refresh. Kitchen cards exclude phone numbers and financial values. Owner health/timeout controls are visible, polling stops after logout, and no unexpected console/page errors occur.

Additional browser coverage retains POS sales, shifts, split payments, print previews, receiving, transfers, waste, production, stocktake, recipe editing, reports, remote Owner administration, loyalty, account history and reorder.

## Menu/costing evidence

The 15 seed/costing scenarios verify repeatable seeding without duplicate categories/products/ingredients/templates; unchanged order/purchase/stock/customer/recipe/modifier history; all 29 supplied SKUs with existing Cola reuse; generic ingredients; seven inactive extras with unknown prices; blocked draft sales/publication; equivalent fries reuse; unknown costs without misleading margins; costing before selling-price entry; deliberate publication after setup; latest and weighted-average cost recalculation; carton-to-piece conversion; missing packaging with known subtotal; repeatable experimental archival; and unknown receipt prices remaining null rather than zero.

Tests use explicitly supplied fixture prices/recipes only. They do not establish any real restaurant recipe, purchase cost, selling price or physical quantity.

## Production verification and limits

See DEPLOYMENT_STATUS.md for the deployed source, backup/seed summary, history comparison and read-only pairing verification. Deployment preserves the current operational state; pending experimental orders must never be accepted merely to make a health check appear clear. The final UX deployment passed 11 read-only live browser check groups, and its before/after operational-history hashes match. An existing loyalty event for an unlinked customer remains queued intentionally.

The real purchase receipt has not been provided in an accessible file or identified in the app. Real menu prices and recipe quantities remain incomplete. Existing stock is experimental and needs reconciliation before actual service. Physical printer output requires testing on the restaurant's connected hardware; automated transport/queue checks and browser previews do not certify a physical printer. No claim of zero possible defects is made.
