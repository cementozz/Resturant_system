# Website → restaurant order audit

## Live installation findings (2026-09-28 Cairo)

Read-only inspection confirmed the launcher uses production mode and the configured origin is `https://trackbite-restaurant.abdallah-abdelhady04.chatgpt.site`. A private secret and installation ID are configured. The live cloud accepts authenticated restaurant heartbeats; the local and cloud catalog revisions matched. No outbound dead letters were present. Credentials were not printed or committed.

One website order remained cloud-pending with no local mapping. The owner subsequently confirmed that all orders were experimental. It contained Classic Burger, Double Burger and Loaded Fries. Import failed with `Kitchen stock is insufficient. Transfer/replenish stock.` Its experimental recipe needs 250 g of fries. The experimental ledger contains 26,250 g in Freezer and none in the fryer's allowed Kitchen/Preparation locations. Other required ingredients were available. No stock was changed during diagnosis.

The kitchen UI loaded only on navigation/manual refresh. Thus even successfully imported orders could remain invisible in an already-open browser. More seriously, import errors were recorded only in cloud storage: the POS had no durable incoming/review queue. The sync health reported connected and zero outbound failures despite the failed incoming order.

## Original path and failure points

| Stage | Existing behavior / failure risk | Required correction |
|---|---|---|
| Configuration | Demo localhost cloud can differ from public site; generic health obscures this | Explicit mode, origin, pairing, heartbeat and revision diagnostics |
| Checkout | UUID/request-key uniqueness and private tracking already exist; stale heartbeat rejects new checkout | Preserve idempotency and connectivity guard; initial state awaiting confirmation |
| Cloud storage | Durable D1 order, but generic pending state | Permanent traceable lifecycle and rejection reason |
| Heartbeat/download | Authenticated secret and installation guard; first 100 pending only | Paginated durable local inbox; recover independently of catalog/customer/command failures |
| Customer links | Directory/link errors can stop the loop or roll back import | Persist incoming order first; visible review and UUID-only linking |
| Product/recipe/modifier | Missing/disabled records cause rollback | Safe review reason; authoritative validation on staff acceptance |
| Stock/variants | Locations, expiry, usable variants enforced; website ignores this | Practical sellability projection plus final transactional validation |
| Price | Only grand-total comparison | Per-item and pricing snapshot validation; no silent repricing |
| Loyalty | Website redemption ledger entry reserves spend; earning is deferred | Validate reservation; rejection reverses reservation once; earn outbox remains retryable |
| Import | Automatic create/deduct/print with no staff decision | Explicit permission-controlled Accept/Reject; durable inbox |
| Transaction | Nested SQLite savepoints and unique cloud mapping already exist | Test failure at every write boundary and restart after commit |
| ACK | Network can fail after local commit; idempotent mapping helps | Durable decision delivery, monotonic cloud updates, repeatable ACK |
| Outbox | Per-entity retries/dead letters; incoming failures excluded | Separate incoming/review/decision counts; no silent failed order |
| Printing | Queue records are transactional; transport occurs separately | Preserve accepted order when printer transport fails; visible retry |
| Orders/Kitchen | Manual refresh, no incoming queue, dialog-only progression | Poll with lifecycle cleanup; counts, alerts, one-tap columns, persistent state |
| Fulfillment | Local forward state machine exists; payment separate | Preserve guards, test retries and customer tracking |
| Restart/outage | Cloud preserves pending; no local inbox before import | Persist inbox before validation; recover decisions and show stale-connection warning |

## Implementation and evidence

The automatic importer was replaced by the durable `online_order_inbox`. Arrival changes no order, stock, payment, points or print records. Explicit permissioned Accept validates the cloud reservation, customer identity, products, recipes, modifiers, current item prices, totals and available preparation stock. The local order, deductions, print job, mapping and decision commit together. Reject records a visible reason and releases any website reward reservation once.

Decisions retry after network failures and restarts. Order events wait for their decision acknowledgement so kitchen progress cannot be lost before cloud mapping exists. Cloud acknowledgements and stale events cannot regress terminal fulfillment or paid/refunded payment. A concurrent second Accept rechecks the committed local decision after its cloud request and returns the existing order.

Incoming/Needs Review queues have counts, timers, overdue alerts, optional sound/mute, stock-shortage detail and retry controls. Timeout keeps the order waiting and alerts staff; it never silently accepts it. Kitchen has three live columns with one-tap forward actions, WEB/POS badges, notes and failed-print warnings. Requests stop when leaving the view or logging out. Staff also see incoming counts while using other screens. Kitchen projections exclude financial and private customer fields.

Diagnostics identify DEMO/PRODUCTION, actual cloud origin, installation pairing, heartbeat, catalog revisions and incoming/outbound failures. `04_CHECK_SYSTEM.bat` runs these checks against the configured public origin. Checkout pauses when the restaurant heartbeat is stale. Local public checkout uses the same cloud confirmation path.

Regression testing exposed and corrected three additional failures: a kitchen timer function shadowed by a polling handle, an error on the second concurrent Accept, and kitchen events that could leave the outbox before cloud acknowledgement. The isolated tests cover these fixes. See `TEST_REPORT.md` for exact counts and limitations. No new live transactional order is used for this deployment; existing experimental orders remain auditable.
