# Track Bite Restaurant System

Arabic-first, bilingual restaurant management and customer ordering platform. Includes a local POS, inventory and recipes, customer records, reporting, receipt and kitchen-ticket printing, and a separate customer-ordering service with synchronization.

**Public customer website:** https://trackbite-restaurant.abdallah-abdelhady04.chatgpt.site/customer/

**0.6 is deployed:** the public site and paired POS are activated. See [deployment status and verification](DEPLOYMENT_STATUS.md). Staff use their configured strong passwords; remote staff access remains opt-in.

The configured restaurant computer synchronizes with this hosted website. A fresh GitHub download runs a separate localhost demo until private connection settings are configured. See [public hosting and POS operation](trackbite-system/docs/PUBLIC-HOSTING.md).

## Run on Windows

1. Install **Node.js 22.5 or newer** and make sure `node` is available on PATH. The development computer already has a portable runtime, but that machine-specific runtime is not included in GitHub.
2. Clone this repository or download and extract its ZIP.
3. Double-click **`01_START_WEBSITE.bat`** for the customer website, or **`02_START_POS.bat`** for staff/POS. Both launchers start the required services.

| Link | Purpose |
| --- | --- |
| http://127.0.0.1:5174/customer/ | Customer website connected through the cloud-demo service |
| http://127.0.0.1:4173/pos/ | Staff dashboard and POS |
| http://127.0.0.1:4173/customer/ | Customer website served directly by the restaurant service |

**Demo POS login:** username `owner`, password `1234`.

Use `03_STOP_TRACK_BITE.bat` to stop services and `04_CHECK_SYSTEM.bat` to inspect their status. These are local addresses and work only while the services are running on your computer.

The default SQLite demo needs no npm dependencies. Databases and sample data are created on first run. Existing restaurant databases, backups, private customer/order records, credentials and logs are not distributed in this repository.

## Run from a terminal

From the repository root, open two terminals:

```powershell
# Terminal 1: customer/cloud service
cd trackbite-system
$env:DEMO_MODE = 'true'
node cloud/server.js
```

```powershell
# Terminal 2: restaurant/POS service
cd trackbite-system
$env:DEMO_MODE = 'true'
$env:CLOUD_API_URL = 'http://127.0.0.1:5174'
node server.js
```

For a PostgreSQL cloud database, install the optional `pg` dependency with `npm install` in `trackbite-system` and configure `DATABASE_URL`. See the architecture and upgrade guides before deploying.

## Features

- Arabic RTL and English LTR interfaces, responsive customer storefront.
- Searchable menu, meal add-ons, favourites, editable cart and delivery/pickup checkout.
- Live order status and account-backed addresses, favourites, history and reordering across devices.
- Staff roles and permissions, shifts, split payments and audited refunds.
- Inventory, generic ingredients, branded variants, recipes, batches, transfers, waste and production.
- Cost/profit estimates, sales reports, customer records and backups.
- Receipt and kitchen-ticket previews, printer routing and configurable Windows/ESC-POS printing.
- Transactional synchronization, queued events and duplicate-order protection.

The customer site has a hosted Workers/D1 backend; the POS remains local. The hosted backend includes customer accounts, shared addresses/favourites/history, immutable loyalty and online reward redemption. Online payment processing, SMS verification and coupons remain unconnected. The Node cloud service is a demo simulator, not the production account service. Opening hours are informational; food photos are temporary placeholders. Review the [feature checklist](trackbite-system/docs/STOREFRONT.md) and [hosting guide](trackbite-system/docs/PUBLIC-HOSTING.md). The local demo credentials are for the restaurant computer and are not accepted by the public website.

## Tests

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/test.ps1
```

Or, with Node available on PATH:

```sh
cd trackbite-system
npm test
```

The application has five integration suites. From the root, run `npm ci`, `npm run check`, `npm run build`, `npm test`, and `npm run test:browser`. Browser tests use installed Google Chrome on Windows; on Linux first run `npx playwright install --with-deps chromium`. Run `tools/test-updater.ps1` on Windows for the isolated release installer checks. All suites use temporary data. See [exact results](TEST_REPORT.md).

## Project guide

- [Start here / ابدأ من هنا](START_HERE.md): launchers and folder map.
- [Customer website](trackbite-system/docs/STOREFRONT.md): working features and remaining work.
- [Management and printing](trackbite-system/docs/UPGRADE-0.3.md): configuration and limitations.
- [Architecture](trackbite-system/docs/ARCHITECTURE.md): data and synchronization rules.
- [Placeholder image notes](trackbite-system/public/customer/assets/README.md).
