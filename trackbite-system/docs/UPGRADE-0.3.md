# Track Bite 0.3

This extends the existing Node/SQLite restaurant platform with additive database migrations and modular screens. The original source and database were backed up before the upgrade.

## Run

Double-click the workspace `01_START_WEBSITE.bat`.

- Restaurant: http://127.0.0.1:4173/pos/
- Customer website: http://127.0.0.1:5174/customer/
- Local customer preview: http://127.0.0.1:4173/customer/
- Development owner: `owner` / `1234`. Change passwords in Administration → Users.

## Implemented

- Arabic-first modular staff interface with English and RTL/LTR switching.
- Ingredient-first inventory totals; brand/location details are secondary. Receiving supports optional brand, supplier, batch, expiry, units and purchase cost.
- Transfers, waste, controlled stocktake, FIFO/FEFO/preferred allocation, thresholds, expiry alerts, multiple-input production and actual output yields.
- Recipe component table with ingredient search, unit conversion and live estimates. Menu tabs cover general, recipe, modifiers, pricing, kitchen, website and history.
- Searchable/sortable menu profitability, target food-cost pricing, latest receipt price or quantity-weighted receipt-history average. Unknown costs remain unknown.
- POS modifiers and instructions, separate notes per item, order notes, configurable order types, delivery details, customer lookup and saved addresses.
- Split payments, required references, discounts with authorization, shifts, full refunds and amendments with settlement differences.
- Expense date, notes and optional recurrence classification; period estimated food cost, gross profit and operating profit. Recurrence does not automatically post future expenses.
- Customer profiles, spending/order history and name/phone search.
- Configurable role permissions and protected reporting. Audit records retain actors, reasons, before/after values and manager approvers for sensitive workflows.
- Website customization, pickup/delivery checkout, payment-due status and private tracking tokens. Public users cannot query the customer database.
- Transactional synchronization outbox with unique event IDs, retries, bounded requests, import deduplication and cloud heartbeat.
- Manual consistent SQLite backups and scheduled backups while the service is running.

## Central pricing

`public/shared/pricing.js` is shared by POS, website, local service and cloud:

1. Sum rounded item lines, including modifiers.
2. Deduct discount.
3. Add optional service, calculated on the discounted subtotal.
4. Add optional tax, calculated on discounted subtotal plus service.
5. Add delivery, packaging and other charges. Percentage packaging/other charges use discounted subtotal.
6. Round amounts to two decimal places.

Tax/service start disabled. Fixed and percentage modes are configurable. Receipts retain historical item, modifier, price and charge snapshots. Food-cost reports use the selected purchase-cost method and remain estimates, not exact accounting profit.

## Local printing

Administration → Printers configures each receipt/preparation station: browser, Windows installed printer or ESC/POS TCP; 58/80 mm; language; copies; automatic printing; rendering mode; and supported drawer pulses.

- Customer receipts include financial totals, payment references, customer/delivery data and footer. Kitchen tickets exclude prices/payments/totals and emphasize quantity, modifiers and notes.
- Each station receives only its items under the same order number. Delivery slips are optional.
- Image mode shapes Arabic using Windows fonts, then uses the Windows print driver or ESC/POS raster stripes. Native text mode intentionally accepts English ASCII; it does not guess printer-specific Arabic code pages.
- Automatic physical printing is disabled until configured. `sent` means transport/spooler handoff, not proof of physical output. Browser jobs can be marked printed manually.
- Printer failure never reverses a sale. Retry targets a failed job; successful jobs are not resent. Ambiguous retries are marked REPRINT.
- Reprints can target the receipt, all kitchen stations or one station. Requests retain actor, reason and time.
- Amendments print ADDITION/CANCEL ITEM tickets. Full refunds create CANCEL ORDER kitchen tickets and a refund receipt.
- Removing a prepared item does not return food to inventory. Orders with item cancellations cannot later use automatic full-refund restocking; use a controlled adjustment for usable returns.
- Browser preview supports the optional logo. The Windows image adapter currently renders text only. Drawer pulses work through ESC/POS/native RAW; ordinary Windows image printing does not send a drawer pulse.

## Verification

Run workspace `tools/test.ps1`, or `npm test` with Node on PATH.

Four suites cover original local operations, original cloud sync, platform integrity and offline recovery. Checks include negative-quantity rollback, modifier stock, idempotency, permissions, archived receipts, station additions, authorized refunds, shift reconciliation, tax/service/delivery, saved addresses, production rollback, expense dates, simulated ESC/POS/cash drawer, printer-failure isolation, deferred online collection and reconnect deduplication.

Browser checks exercised Arabic/English staff screens, recipe editing, administration tabs, local website delivery checkout, the cloud storefront and mobile layout. Arabic ESC/POS raster generation was tested locally. No physical printer was used.

## Deployment boundaries

The running demo is local. Public hosting/domain/HTTPS, real online payments and physical printer certification still need deployment details.

The cloud includes a PostgreSQL adapter: run `npm install`, configure `DATABASE_URL`, `SYNC_SECRET` and `CLOUD_HOST`, then `npm run cloud`. Without `DATABASE_URL`, it uses demo SQLite. PostgreSQL has not been integration-tested against a running server here. Optional `CLOUD_ADMIN_TOKEN` protects `/api/owner/report`, a replicated order-summary API; there is no separate cloud accounting UI in this release.

Native installer/service packaging, automated restore UI, partial itemized-refund wizard, production load/security acceptance and restore drills remain deployment work. Full refunds and controlled order amendments are available. Use the portable launcher for this version; internet independence requires the local PC and service to remain operational.

Change development passwords and synchronization secrets before real use. Existing data backups are under `data/backups`; restoration must be performed with the restaurant service stopped and verified before operations resume.
