# Track Bite feature status

For the current v0.3 implementation and remaining deployment work, see [UPGRADE-0.3.md](docs/UPGRADE-0.3.md). The following is the preserved v0.2 baseline checklist.

## Implemented and tested
- Local-first POS and SQLite database
- Arabic / English UI
- Roles and authenticated sessions
- POS categories, search, cart and orders
- Cash / Vodafone Cash / InstaPay / Visa
- Split payment records and digital payment references
- Shift open/close and cash reconciliation including cash expenses
- Ingredient + brand/variant inventory hierarchy
- Aggregated and detailed stock views
- Multiple stock locations
- Receiving, suppliers and purchase invoices
- Transfers and waste
- Production/conversion actual-yield batches
- Recipe editor and automatic sales consumption
- Physical stocktake adjustments
- Expenses and finance report
- Users, audit log and local backup
- Order history
- Customer receipt and kitchen station print pages
- Print queue records
- Customer website
- Separate cloud website/API service
- Restaurant heartbeat and online-order availability status
- Menu sync local -> cloud
- Online order queue cloud -> local
- Local event queue local -> cloud
- Idempotent cloud sync event ingestion
- Automated local smoke test
- Automated cloud/offline-sync smoke test

## Production completion items
- Native Windows packaging / installer
- Direct ESC/POS USB/Windows spooler auto-print adapter
- PostgreSQL cloud deployment
- Public domain/HTTPS
- Online payment gateway
- Modifier/add-on stock engine
- Batch/expiry/FEFO screens
- Refund/void and manager approvals
- Granular permission editor
- Scheduled backup/restore workflow
- Production security/monitoring/migrations
