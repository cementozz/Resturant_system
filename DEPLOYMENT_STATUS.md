# Production activation — 28 September 2026

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
