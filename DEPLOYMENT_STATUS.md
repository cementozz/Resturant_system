# Production update — 28 September 2026

Sites **version 3** deployed successfully from source `468f650ab3a7b76a9fcc95a00eb15889755eef22`. GitHub main contains the same implementation. The existing public URL, audience, D1 data and installation pairing were retained:

- Website: https://trackbite-restaurant.abdallah-abdelhady04.chatgpt.site/customer/
- Windows POS: http://127.0.0.1:4173/pos/
- Run file: `02_START_POS.bat` in the repository root.

The POS now requires explicit staff acceptance of website orders. Incoming and Needs Review are durable queues; the kitchen refreshes automatically and status changes synchronize back. Read-only production verification found production mode, the correct cloud origin, valid pairing, a fresh heartbeat, matching catalog revisions, **0 pending / 0 failed outbound jobs**, and **0 pending decision acknowledgements**.

The previously hidden experimental website order **#5004** is visible in **Needs Review**. It was not accepted, rejected or deleted during deployment. Its original preparation-stock failure is retained for review. The owner confirmed all historical orders were experiments, not real service.

The real-menu seed ran with `--keep-demo --experimental-existing`. It created 5 categories and reused 2; created 28 products and reused Cola, representing all **29** supplied menu items; created 28 generic ingredients and reused 8, representing **36** supplied ingredients; and prepared **7** inactive extra templates. All 29 real products await recipes and selling prices. No actual purchase costs are present. **Zero products are published**, intentionally, until setup is complete.

Existing experimental menu definitions were archived and marked unverified; no operational history was removed. Before migration/seeding, the SQLite backup passed integrity verification. The post-seed content hashes matched for all **8 orders, 17 order items, 3 payments, 0 purchases, 76 stock movements, 3 customers, 15 recipe lines and 8 modifiers**. Migrations 11–12 also created verified backups. The four pre-existing hosted order rows were exported without truncation before deployment. Private backups and verification records are under `.runtime/backups/order-confirmation/`, excluded from GitHub.

Read-only live browser verification passed **6 check groups**: public Arabic/English mobile rendering with no unverified product published; #5004 visible in Needs Review; menu drafts and all seven item tabs; production health/settings; restricted Kitchen board without financial filters; and zero unexpected console/page errors. No production checkout or stock transaction was created. Exact isolated regression results are in [TEST_REPORT.md](TEST_REPORT.md).

**Still required for real service:** the ingredient purchase receipt, actual recipe quantities and selling prices, reconciliation of experimental stock against real opening inventory, and physical printer verification. See [REAL_MENU_SETUP.md](REAL_MENU_SETUP.md). Staff passwords are unchanged and remain private in `.runtime/access/PRODUCTION-LOGINS.txt`. Keep this PC awake and the POS running to receive website orders.

## Previous activation record

Version 0.6 is deployed at https://trackbite-restaurant.abdallah-abdelhady04.chatgpt.site/customer/ and the paired Windows POS is running at http://127.0.0.1:4173/pos/.

Deployed source: `784bd63dae17f298c5b2a553ecd233ed7ca50e24`. Existing Sites project, public audience, D1 binding and installation pairing were retained. Sites version 2 completed successfully. After the user authorized completion, GitHub [PR #1](https://github.com/cementozz/Resturant_system/pull/1) was merged into main as `cb535318c9aa21f7b8b185bd50a90642b7f1b929`, and the local checkout was fast-forwarded to main. Its application code matches the deployed source; later changes document acceptance results.

Before activation, the local SQLite backup passed integrity verification. A logical export of all existing hosted application tables was reconstructed into SQLite and passed integrity and row-count verification. The complete catalog was recovered from the unchanged public projection because the bounded provider table viewer truncated that one value. Private backup artifacts are under `.runtime/backups/activation-0.6/` and are excluded from GitHub.

The POS applied migrations 8–10 and passed SQLite integrity verification. Existing orders, stock movements, users and the open shift were preserved. All six demo staff passwords were replaced with unique strong passwords; `1234` is no longer the production login. The private credential file is `.runtime/access/PRODUCTION-LOGINS.txt` on the restaurant computer. Never upload it. Remote Owner access is enabled and verified at `/customer/admin.html`, using the same Owner credentials. Manager remote access remains opt-in in POS settings.

Post-deployment verification passed:

- Public health, account API and published catalog.
- Matching POS/cloud catalog revisions and online synchronization, without errors or dead letters.
- Desktop/mobile page rendering, Arabic/English switching and product search.
- Owner POS browser login and existing order screen.
- All six staff credentials and Kitchen bootstrap restrictions.
- No unexpected browser console or page errors.

The complete isolated test suites and GitHub CI passed before deployment. The authorized production checks above were read-only apart from ordinary authentication sessions and the deployment's credential setup.

**Live transaction acceptance passed after explicit authorization.** A clearly marked test account signed in from two independent browsers. Its website order imported once into the POS with the same customer UUID; payment and fulfillment synchronized back and earned 3 points. An audited refund restored the stock and reversed all 3 points. The dedicated test payment method had zero net collected/refunded value, and both it and the test customer account were disabled afterward. Cloud tracking reached cancelled/refunded. Immutable audit, order, stock and loyalty records were retained.

A remote Owner command preserving the existing menu price reached Applied in the POS; the published price remained unchanged. Final checks found matching catalog revisions, no pending or failed sync records, and SQLite integrity OK. No unexpected browser errors occurred. Private detailed test reports remain in the excluded activation-backup directory.

Physical printer certification still requires the hardware checklist. These results cover tested workflows, not a guarantee of zero software defects.

No approved GitHub Release was published or installed automatically. Keep the restaurant computer awake and the POS running; local sales work offline, while receiving website orders and publishing updates requires internet connectivity.
