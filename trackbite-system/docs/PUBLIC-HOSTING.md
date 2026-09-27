# Public website and POS synchronization

Customer website: https://trackbite-restaurant.abdallah-abdelhady04.chatgpt.site/customer/

The customer website runs on Sites with managed D1 order storage. The restaurant POS stays on the restaurant computer at http://127.0.0.1:4173/pos/. Staff pages, staff authentication, local files and restaurant administration are not served by the public deployment.

## Daily operation

1. Double-click `02_START_POS.bat` on the configured restaurant computer.
2. Keep that computer awake and connected to the internet while receiving website orders.
3. Use `04_CHECK_SYSTEM.bat` to inspect POS connectivity, the public website and the current menu.
4. Open the public website on a phone or another computer to order.

The same launchers still support the localhost demo when no public connection file exists. `01_START_WEBSITE.bat` opens the configured public website and starts the POS.

## What synchronizes

- The POS uploads current menu items, modifiers, prices, enabled order types and public restaurant details about every ten seconds.
- A website order is stored durably in the hosted database with a unique request ID and private tracking token.
- The POS retrieves pending orders, records them and deducts stock in a local transaction, then acknowledges receipt.
- Staff preparation/payment updates are sent back to the customer's tracker.
- Retries and reconnects do not create another POS order for the same web order.
- If the POS has not checked in for three minutes, the website remains viewable but new orders pause. Orders accepted just before an outage stay queued for reconnection.

## Connection and secrets

The local `.runtime/public-cloud.json` contains the public origin, private synchronization key and paired restaurant installation ID. It is ignored by Git. The matching key and installation ID are secret runtime variables in Sites. Do not put this file into the public repository or share it with customers.

The site is paired to the existing restaurant database. A fresh download from GitHub creates a separate demo installation and does not automatically connect to this restaurant. To move the POS, restore its database backup and transfer the private connection settings securely, then run only one active POS installation against this hosted restaurant.

Website callers cannot use the POS login or synchronization endpoints without the private key. The hosted service stores website orders, status and sync receipt IDs; it does not provide public inventory or financial report APIs. Public order submissions have request-size, item-quantity and per-IP rate limits. Payment remains on receipt; there is no online card processing.

## Source and deployment

- `.openai/hosting.json`: persistent Sites project identity and the managed DB binding.
- `trackbite-system/cloud/sites/worker.mjs`: hosted order and sync endpoints.
- `vite.config.mjs`: Workers runtime and asset configuration.
- `tools/prepare-public-site.cjs`: copies only customer assets and required shared helpers.
- Root `npm run build`: produces `dist/server`, `dist/client` and Sites metadata.
- Root `npm test`: tests the hosted Workers/D1 runtime against an isolated local POS.
- `tools/test.ps1`: runs the five original local/cloud integration suites.

Build tools need Node.js 22.13 or newer and root `npm ci`. Running the restaurant alone still needs only Node.js 22.5 or newer. Deployment requires a pushed source commit, a saved Sites version and a successful production deployment; a GitHub push alone does not publish website changes. The source commit is mirrored to the configured Sites source repository. Runtime secrets are never packaged into the deployment archive.

Customer accounts, coupons, loyalty, online payments, delivery-driver maps and scheduled orders are still separate future features. Product images are placeholders.
