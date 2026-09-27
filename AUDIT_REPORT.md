# Track Bite reliability audit

Baseline: `acf644a`, 2026-09-28. Existing design is frozen. Live POS and hosted D1 are excluded from development tests. The fixes below are implemented and validated with isolated tests. This report is not a production or physical-printer certification.

## Baseline results

Application `npm test`: all five suites passed. Root `npm ci`, `npm run build`, and hosted Worker/D1 `npm test`: passed. PowerShell launcher passed using process-scoped ExecutionPolicy Bypass (machine policy unchanged). These suites did not cover customer accounts, loyalty, remote commands, release installation, or exhaustive permissions.

## Findings

| ID | Severity | Cause / affected module | Implemented resolution | Status |
|---|---|---|---|---|
| A01 | High | In-memory bearer sessions survive password change but not restart; auth.js | Persist hashed, expiring, revocable sessions | Fixed; automated verification |
| A02 | High | Customer routes use orders.read; Kitchen receives customer profiles | Separate customer capabilities and minimize responses | Fixed; automated verification |
| A03 | High | Printing payload/preview can disclose full receipt to Kitchen | Filter jobs and restrict customer receipts | Fixed; automated verification |
| A04 | High | Bootstrap sends all settings and configuration to every role | Role-aware allowlists | Fixed; automated verification |
| A05 | High | Legacy anonymous x-public-order bypasses public checkout controls | Remove route bypass; one local public checkout | Fixed; automated verification |
| A06 | Medium | Dead shift close and printer settings handlers; fake requireUser role arrays | Explicit method/path registry; remove unreachable handlers | Fixed; automated verification |
| A07 | High | Fractional/huge local quantities and key-order dependent request hash | Shared normalization and canonical hashing | Fixed; automated verification |
| A08 | High | Sale stock allocation searches every location | Station consumption allowlists | Fixed; automated verification |
| A09 | Medium | Expiry uses UTC and inactive variants can retain hidden stock | Restaurant timezone; prevent unsafe deactivation | Fixed; automated verification |
| A10 | High | Failed event aborts entire outbox pass | Per-entity ordering, retry/dead-letter isolation | Fixed; automated verification |
| A11 | Medium | Full catalog and unused operational tables continuously transmitted | Revision acknowledgement; explicit projections | Fixed; automated verification |
| A12 | High | Implicit development sync secret | Explicit demo mode; production configuration validation | Fixed; automated verification |
| A13 | High | No cross-device customer identity or persistent customer authentication | Cloud-owned account and identity linking | Fixed; automated verification |
| A14 | High | No immutable loyalty ledger or redemption concurrency control | Cloud-authoritative redemption; offline earn outbox | Fixed; automated verification |
| A15 | Medium | No safe remote management command queue | Versioned, paired, audited commands | Fixed; automated verification |
| A16 | High | No approved-release updater or rollback protocol | Versioned packages, integrity, verified backup, health gate | Fixed; automated verification |
| A17 | Medium | User-edit controls call .forEach on single querySelector result | Correct collection selector; real browser coverage | Fixed; automated verification |
| A18 | Medium | Publication only checks recipe header; missing reason/status | Shared eligibility and visible publication state | Fixed; automated verification |
| A19 | High | Public local /api/status discloses absolute DB path | Non-sensitive health response | Fixed; automated verification |
| A20 | Medium | No browser CI, exhaustive endpoint matrix, physical printer acceptance | Automated isolated coverage and hardware checklist | Fixed; automated verification |

## Additional findings and corrections

| ID | Severity | Cause / affected module | Fix and evidence |
|---|---|---|---|
| A21 | High | Sync migration reused commercial migration version 4 and could silently skip synchronization setup | Unique version 8; fresh and legacy upgrade tests reach versions 3 through 10 |
| A22 | Medium | Browser phone input used a character-class pattern rejected by current Chromium | Valid phone pattern; customer desktop/mobile checkout passes without console errors |
| A23 | High | Guest phone matching could attach a stranger's order to an authenticated account | UUID-first identity and explicit audited legacy linking; linked identities cannot be claimed by anonymous phone matching |
| A24 | Medium | Missing cloud catalog after reset could retain a locally acknowledged revision | Compare heartbeat cloud revision, including missing revision; republish on mismatch |
| A25 | High | Nested approval/password fields could enter legacy audit payloads | One recursive redactor in permissions; legacy audit wrapper delegates to it |
| A26 | Medium | A fully discounted deferred order could wait for an impossible zero-value collection | Zero-total orders are paid; free reward inventory/refund integration passes |
| A27 | Medium | Order mutations and receipt payloads could bypass a revoked customer PII capability | Central order-response filtering and customer-receipt access checks; override regression test passes |
| A28 | Medium | Local loyalty earnings alone omit cloud redemption debits | Linked customer balance reads cloud ledger; offline/unlinked balance explicitly unavailable; redeemed balance integration assertion passes |
| A29 | Medium | Production launcher could inherit DEMO_MODE and advertised demo credentials | Public-connected launcher forces production mode and displays configured-password guidance |
| A30 | Medium | Fresh CI checkout has no ignored runtime directory | Isolated test entry points create their own runtime parent; no portable runtime dependency on CI |
| A31 | Medium | New customer attachment UI initially used a single selector as a collection | Fixed during development; POS browser attaches customer and completes split payment |
| A32 | Low | Browser tests raced remote portal refresh and used an invalid numeric attribute selector | Await refresh response; quote selector. Final flows verify remote price/item/reward and local recipe changes |

## Verification scope and operating limits

See TEST_REPORT.md for exact suites. The endpoint registry has 94 protected routes: anonymous denial is exercised over HTTP; six role/capability combinations are enumerated and denied combinations are exercised over HTTP. Allowed business operations have separate integration/browser scenarios. This is not a claim that every possible authorized payload is covered.

All identified high-severity source findings above have fixes and automated evidence; none is knowingly left open. Independent security assessment and actual hosted rollout are not represented as completed. Kitchen response filtering is explicit and customer PII overrides apply to order mutations and receipt access. Costs/reports remain separately permission-gated.

GitHub Releases require a reviewed compatibility manifest. No release has been approved/published here. The historical version's ability to use the new schema is not assumed. Hardware acceptance and authorized hosted tests remain deployment gates, documented in DEPLOYMENT_CHECKLIST.md and HARDWARE_ACCEPTANCE.md.

No migration or destructive test has been run against production restaurant data. Deployment requires the explicit authorization requested in phase 24.
