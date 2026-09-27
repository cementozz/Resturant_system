# Production activation — 28 September 2026

Version 0.6 is deployed at https://trackbite-restaurant.abdallah-abdelhady04.chatgpt.site/customer/ and the paired Windows POS is running at http://127.0.0.1:4173/pos/.

Deployed source: `784bd63dae17f298c5b2a553ecd233ed7ca50e24`. Existing Sites project, public audience, D1 binding and installation pairing were retained. Sites version 2 completed successfully. GitHub [PR #1](https://github.com/cementozz/Resturant_system/pull/1) remains unmerged: automatic approval review rejected changing GitHub main without explicit merge authorization. The tested review-branch source was deployed through the existing Sites source repository.

Before activation, the local SQLite backup passed integrity verification. A logical export of all existing hosted application tables was reconstructed into SQLite and passed integrity and row-count verification. The complete catalog was recovered from the unchanged public projection because the bounded provider table viewer truncated that one value. Private backup artifacts are under `.runtime/backups/activation-0.6/` and are excluded from GitHub.

The POS applied migrations 8–10 and passed SQLite integrity verification. Existing orders, stock movements, users and the open shift were preserved. All six demo staff passwords were replaced with unique strong passwords; `1234` is no longer the production login. The private credential file is `.runtime/access/PRODUCTION-LOGINS.txt` on the restaurant computer. Never upload it. Owner/Manager remote access remains opt-in in POS settings; the hosted administration sign-in page is available at `/customer/admin.html`.

Post-deployment verification passed:

- Public health, account API and published catalog.
- Matching POS/cloud catalog revisions and online synchronization, without errors or dead letters.
- Desktop/mobile page rendering, Arabic/English switching and product search.
- Owner POS browser login and existing order screen.
- All six staff credentials and Kitchen bootstrap restrictions.
- No unexpected browser console or page errors.

The complete isolated test suites and GitHub CI passed before deployment. The authorized production checks above were read-only apart from ordinary authentication sessions and the deployment's credential setup.

**Live transaction acceptance remains pending.** Automatic approval review rejected the proposed marked customer/order/payment/stock/loyalty test because deployment approval did not explicitly authorize those transactional side effects. The rejected script did not run and created no test records. Explicit authorization is required before that test and its audited refund/stock/points cleanup. Physical printer certification also remains pending the hardware checklist.

No approved GitHub Release was published or installed automatically. Keep the restaurant computer awake and the POS running; local sales work offline, while receiving website orders and publishing updates requires internet connectivity.
