# Track Bite customer website

The website uses Track Bite branding with a restaurant-chain style ordering experience. Arabic/RTL is the default; English/LTR is available. The menu and prices come from the restaurant service.

## Working features

- Responsive homepage, food placeholders, meal builder and categorized menu.
- Search, sorting, favourites, item customization, quantities and special instructions.
- Persistent cart, item editing/removal, mobile cart drawer and keyboard navigation.
- Delivery/pickup selection, saved customer details and up to six addresses.
- Three-step checkout: details, payment, review. Server-calculated totals include configured taxes, service, delivery and other charges.
- Payment on receipt. Duplicate submission protection and stale-price rejection.
- Local restaurant and cloud ordering, kitchen/receipt jobs through the existing backend.
- Live status updates, last 50 orders on this browser, and reorder at current prices.
- Restaurant address, phone and opening-hours display from staff Settings → General; directions open Google Maps.
- FAQ, ingredient/allergen contact guidance, and clear-browser-data control.

In the 0.6 hosted backend, signed-in customers share favourites, addresses, history and points across devices. Guests retain browser-local preferences. Authentication uses HttpOnly cookies; localStorage is not the account source of truth. The local Node demo has guest functionality only. The live public deployment was activated after authorization; see ../../DEPLOYMENT_STATUS.md.

## Remaining work for a full chain platform

Public hosting and the managed order database are implemented; see [PUBLIC-HOSTING.md](PUBLIC-HOSTING.md). The following features are not implemented or connected, and are not represented as working website controls:

| Feature | What is needed |
| --- | --- |
| Online card/wallet payment | Chosen payment provider account, server payment integration, verified webhook settlement and refunds |
| SMS / OTP delivery | A real provider integration; password accounts and owner-assisted recovery are implemented |
| Coupon codes | Separate campaign rules; ledger-based loyalty and rewards are implemented in the hosted backend |
| Multiple branches / delivery zones | Real branch and delivery-area data plus routing and availability rules |
| Scheduled orders / live driver map | Hours/capacity rules, scheduling backend and delivery integration |
| Nutrition and allergen listings | Verified data for the restaurant’s actual recipes |
| Physical printing | Select and test the installed printer; see UPGRADE-0.3.md |

Opening hours are informational text, not an automatic order-availability schedule. The status indicator reflects restaurant connectivity. No estimated delivery time is invented.

## Files and launchers

Start from `../../01_START_WEBSITE.bat` or `../../02_START_POS.bat`. The root START_HERE.md documents every runnable file. PowerShell scripts are in `../../tools`; application code stays under `trackbite-system`.

Customer UI:

- `public/customer/index.html`: page structure.
- `public/customer/storefront.css`: independent responsive styles.
- `public/customer/storefront.js`: startup, translations, availability and navigation.
- `public/customer/modules/core.js`: state, storage, formatting and public requests.
- `public/customer/modules/menu.js`: catalog, customization, cart and totals.
- `public/customer/modules/checkout.js`: checkout and submission.
- `public/customer/modules/customer.js`: saved details, history and tracking.
- `public/customer/assets`: replaceable placeholder assets.

Set real product images and descriptions in staff Menu settings. An assigned image overrides the default placeholder. Do not use these illustrative placeholders as a claim about actual ingredients or portion sizes.

## Verification

`../../tools/test.ps1` runs five isolated integration suites. `tests/storefront.js` checks asset delivery, information sync, price-change rollback, cloud/local checkout, duplicate prevention and cancellation tracking. Browser checks cover desktop/mobile, both languages, customization, checkout and reorder. Test databases are separate from restaurant data.
