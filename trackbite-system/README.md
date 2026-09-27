# Track Bite v0.4

Start with [the launch guide](../START_HERE.md). Double-click `../01_START_WEBSITE.bat` for the website or `../02_START_POS.bat` for the staff system. See [the new website guide](docs/STOREFRONT.md) for customer features and remaining production work.

The v0.3 upgrade adds modular Arabic/English screens, recipes and profitability, customer/delivery workflows, granular permissions, transactional sync, and a local printing subsystem. See [the upgrade guide](docs/UPGRADE-0.3.md) for current feature status, tests and deployment limits. On this PC, use `../01_START_WEBSITE.bat` with the included portable runtime.

The sections below describe the original v0.2 baseline; the upgrade guide supersedes its production-feature checklist.

Working local-first restaurant platform prototype for a burger / loaded-fries restaurant. It includes the restaurant POS/management system, inventory/recipe/production logic, and a separate cloud website service with offline synchronization.

## What works now

### Restaurant / POS
- Arabic-first interface with English switch.
- User roles: Owner, Manager, Accountant, Cashier, Store Keeper, Kitchen.
- Cashier shift opening and closing.
- Cash, Vodafone Cash, InstaPay and Visa/Card, including split payments and transaction references where required.
- Product categories, search, cart and orders.
- Customer receipt print view and station-routed kitchen tickets.
- Daily sales, payment-method and best-selling-product reporting.
- Order history and search.

### Inventory / recipes / production
- Generic ingredients plus multiple purchasable brands/variants.
- Multiple stock locations (main store, freezer, kitchen, drinks fridge).
- Movement-ledger inventory; stock is calculated from movements rather than manually overwritten balances.
- Stock receiving.
- Supplier and purchase records.
- Transfers between locations.
- Waste recording.
- Physical stocktake and adjustment movements.
- Recipe-based automatic stock deduction when an item is sold.
- Production/conversion with user-entered actual yield (e.g. 10 kg minced beef -> 150 patties).
- Admin creation of ingredients, variants, categories, menu products and recipes.

### Finance / administration
- Expenses.
- Finance report with sales by payment method and expenses.
- User creation.
- Audit log foundation and UI.
- Local database backup button.

### Customer website + cloud sync
- Separate cloud website service.
- Local restaurant heartbeat to the cloud.
- Menu/catalog synchronization from restaurant to cloud.
- Website disables online ordering if the restaurant has not been online recently.
- Cloud website orders are queued and imported into the restaurant when connectivity is available.
- Imported website orders use the same local recipe/inventory/printing pipeline as POS orders.
- Local sync events use idempotent event keys to avoid duplicate cloud events.
- Failed local sync events stay queued for retry.

## Development login

All initial development accounts use password `1234`:

- `owner`
- `manager`
- `cashier`
- `store`
- `accountant`
- `kitchen`

Change all default credentials before real use.

## Run only the local restaurant system

Requires Node.js 22.5+ for this development build.

```bash
npm start
```

Open:
- POS: http://127.0.0.1:4173/pos/
- Local customer preview: http://127.0.0.1:4173/customer/

On Windows you can also use `../02_START_POS.bat`.

## Run the local + cloud demo

Terminal 1:

```bash
set SYNC_SECRET=your-secret
npm run cloud
```

Terminal 2:

```bash
set SYNC_SECRET=your-secret
set CLOUD_API_URL=http://127.0.0.1:5174
npm start
```

Open:
- Restaurant POS: http://127.0.0.1:4173/pos/
- Cloud customer website: http://127.0.0.1:5174/customer/

Or use `../01_START_WEBSITE.bat` on Windows.

## Automated tests

```bash
npm test
```

The smoke tests verify POS ordering, split payments, recipe stock deduction, stock receiving, transfer, waste, production conversion, supplier/purchase, expenses, stocktake, users, backup, reports, shift closing, cloud heartbeat, catalog sync, online website ordering, cloud-to-local order import and local-to-cloud event synchronization.

## Still needed before production use

This is a working development system, not yet the final deployable restaurant release. Production work still includes:

- Windows single-executable/installer packaging so the restaurant PC does not need a separate Node installation.
- Direct unattended ESC/POS USB/Windows-spooler printing. The current build has print routing, queue records and printable customer/kitchen pages.
- Proper production PostgreSQL hosting for the cloud service (the demo cloud service deliberately uses a local SQLite database so it can be tested without external credentials).
- Domain, HTTPS and production hosting.
- Real online payment gateway credentials/integration.
- Full item-modifier inventory rules (extra patty, extra cheese, no pickles, etc.).
- Batch/expiry/FEFO UI.
- Refund/void workflow with manager approval.
- Granular custom permission editor/manager PIN flow.
- Automated scheduled backups and restore UI.
- Production monitoring, database migrations and security hardening.

The architecture already separates local restaurant operation from cloud availability, so the cashier and kitchen are not dependent on the internet connection.
