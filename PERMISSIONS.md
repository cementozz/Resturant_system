# Permissions

Default role matrix. Owner always retains every capability; overrides cannot remove owner recovery access. Other roles can be explicitly customized through the protected permission editor. Server checks use the same catalog, with explicit method/path routes in `src/routes.js`; unknown endpoints fail closed. UI visibility is not authorization.

| Capability | Owner | Manager | Accountant | Cashier | Store keeper | Kitchen |
|---|---|---|---|---|---|---|
| `audit.read` | Yes | Yes | — | — | — | — |
| `backup.manage` | Yes | Yes | — | — | — | — |
| `customers.edit` | Yes | Yes | — | Yes | — | — |
| `customers.pii` | Yes | Yes | — | Yes | — | — |
| `customers.read` | Yes | Yes | — | Yes | — | — |
| `expenses.read` | Yes | Yes | Yes | — | — | — |
| `expenses.write` | Yes | Yes | Yes | — | — | — |
| `inventory.adjust` | Yes | Yes | — | — | — | — |
| `inventory.read` | Yes | Yes | Yes | — | Yes | — |
| `inventory.receive` | Yes | Yes | — | — | Yes | — |
| `inventory.transfer` | Yes | Yes | — | — | Yes | — |
| `inventory.write` | Yes | Yes | — | — | Yes | — |
| `loyalty.adjust` | Yes | Yes | — | — | — | — |
| `loyalty.read` | Yes | Yes | — | Yes | — | — |
| `menu.read` | Yes | Yes | Yes | Yes | Yes | Yes |
| `menu.write` | Yes | Yes | — | — | — | — |
| `orders.amend` | Yes | Yes | — | — | — | — |
| `orders.discount` | Yes | Yes | — | — | — | — |
| `orders.fulfill` | Yes | Yes | — | Yes | — | Yes |
| `orders.read` | Yes | Yes | Yes | Yes | — | Yes |
| `orders.refund` | Yes | Yes | — | — | — | — |
| `payments.manage` | Yes | Yes | Yes | — | — | — |
| `pos.sell` | Yes | Yes | — | Yes | — | — |
| `printing.manage` | Yes | Yes | — | — | — | — |
| `printing.use` | Yes | Yes | — | Yes | — | Yes |
| `purchases.read` | Yes | Yes | Yes | — | Yes | — |
| `purchases.write` | Yes | Yes | — | — | Yes | — |
| `reports.costs` | Yes | Yes | Yes | — | — | — |
| `reports.sales` | Yes | Yes | Yes | — | — | — |
| `settings.manage` | Yes | Yes | — | — | — | — |
| `sync.manage` | Yes | Yes | — | — | — | — |
| `users.manage` | Yes | — | — | — | — | — |

Kitchen receives preparation-only order details and station tickets. Customer receipts, customer profiles, amounts, purchase costs and private settings are excluded. Customer PII and customer spending/history use separate capabilities. Cashier sales access does not grant profit/cost reports.

One-request approval uses an active owner/manager credential and checks that approver’s capability. It is not a persistent privilege elevation. Passwords, approval objects and tokens are recursively removed from audit values. Staff account disabling and password changes revoke sessions.

## Local endpoint registry

| Method | Endpoint | Required capability |
|---|---|---|
| GET | `/api/status` | Public, endpoint-specific validation/rate limit |
| POST | `/api/login` | Public, endpoint-specific validation/rate limit |
| POST | `/api/logout` | authenticated |
| GET | `/api/public/menu` | Public, endpoint-specific validation/rate limit |
| POST | `/api/public/orders` | Public, endpoint-specific validation/rate limit |
| GET | `/api/tracking/:token` | Public, endpoint-specific validation/rate limit |
| GET | `/api/me` | authenticated |
| GET | `/api/bootstrap` | authenticated |
| GET | `/api/orders` | orders.read |
| GET | `/api/orders/:id` | orders.read |
| POST | `/api/orders` | pos.sell |
| POST | `/api/orders/:id/refund` | orders.refund |
| POST | `/api/orders/:id/amend` | orders.amend |
| POST | `/api/orders/:id/fulfill` | orders.fulfill |
| POST | `/api/orders/:id/collect` | pos.sell |
| POST | `/api/orders/:id/reprint` | printing.use |
| GET | `/api/shifts/current` | pos.sell |
| GET | `/api/shifts/history` | pos.sell |
| POST | `/api/shifts/open` | pos.sell |
| POST | `/api/shifts/close` | pos.sell |
| GET | `/api/inventory/summary` | inventory.read |
| GET | `/api/inventory/alerts` | inventory.read |
| GET | `/api/inventory/movements` | inventory.read |
| POST | `/api/inventory/receive` | inventory.receive |
| POST | `/api/inventory/receive-simple` | inventory.receive |
| POST | `/api/inventory/transfer` | inventory.transfer |
| POST | `/api/inventory/waste` | inventory.write |
| POST | `/api/inventory/threshold` | inventory.write |
| POST | `/api/production` | inventory.write |
| POST | `/api/stocktake` | inventory.adjust |
| GET | `/api/stocktakes` | inventory.read |
| GET | `/api/suppliers` | purchases.read |
| POST | `/api/suppliers` | purchases.write |
| GET | `/api/purchases` | purchases.read |
| POST | `/api/purchases` | purchases.write |
| GET | `/api/expenses` | expenses.read |
| POST | `/api/expenses` | expenses.write |
| GET | `/api/reports/today` | reports.sales |
| GET | `/api/reports/finance` | reports.costs |
| GET | `/api/reports/platform` | reports.costs |
| GET | `/api/menu/costing` | reports.costs |
| GET | `/api/menu/history` | menu.read |
| POST | `/api/menu/item` | menu.write |
| DELETE | `/api/menu/item` | menu.write |
| GET | `/api/menu/publication` | menu.read |
| GET | `/api/customers` | customers.read |
| GET | `/api/customers/lookup` | customers.read |
| GET | `/api/customers/:id` | customers.read |
| POST | `/api/customers/link` | customers.edit |
| GET | `/api/permissions` | users.manage |
| POST | `/api/permissions` | users.manage |
| GET | `/api/admin/users` | users.manage |
| POST | `/api/admin/users` | users.manage |
| PATCH | `/api/admin/users/:id` | users.manage |
| POST | `/api/admin/categories` | menu.write |
| POST | `/api/admin/products` | menu.write |
| POST | `/api/admin/stations` | menu.write |
| PATCH | `/api/admin/products/:id` | menu.write |
| POST | `/api/admin/ingredients` | inventory.write |
| POST | `/api/admin/variants` | inventory.write |
| POST | `/api/admin/locations` | inventory.write |
| POST | `/api/admin/waste-reasons` | inventory.write |
| PATCH | `/api/admin/variants/:id` | inventory.write |
| GET | `/api/admin/recipes` | menu.read |
| POST | `/api/admin/recipes` | menu.write |
| GET | `/api/admin/modifiers` | menu.write |
| POST | `/api/admin/modifiers` | menu.write |
| GET | `/api/admin/payment-methods` | payments.manage |
| POST | `/api/admin/payment-methods` | payments.manage |
| GET | `/api/settings` | settings.manage |
| POST | `/api/settings` | settings.manage |
| GET | `/api/settings/order-types` | settings.manage |
| POST | `/api/settings/order-types` | settings.manage |
| GET | `/api/settings/consumption-locations` | inventory.adjust |
| POST | `/api/settings/consumption-locations` | inventory.adjust |
| GET | `/api/audit` | audit.read |
| POST | `/api/admin/backup` | backup.manage |
| GET | `/api/admin/backups` | backup.manage |
| GET | `/api/print-queue` | printing.use |
| GET | `/api/printing/jobs` | printing.use |
| GET | `/api/printing/jobs/:id/preview` | printing.use |
| POST | `/api/printing/jobs/:id/retry` | printing.use |
| POST | `/api/printing/jobs/:id/confirm` | printing.use |
| POST | `/api/printing/reprint` | printing.use |
| POST | `/api/printing/complete` | printing.use |
| GET | `/api/printing/settings` | printing.manage |
| POST | `/api/printing/settings` | printing.manage |
| POST | `/api/printing/test` | printing.manage |
| GET | `/api/printing/devices` | printing.manage |
| GET | `/api/sync/status` | sync.manage |
| GET | `/api/sync/pending` | sync.manage |
| POST | `/api/sync/retry` | sync.manage |
| GET | `/api/loyalty/settings` | loyalty.adjust |
| POST | `/api/loyalty/settings` | loyalty.adjust |
| POST | `/api/loyalty/rewards` | loyalty.adjust |
| POST | `/api/loyalty/adjust` | loyalty.adjust |
| GET | `/api/loyalty/customer` | loyalty.read |
| GET | `/api/remote/status` | users.manage |
| GET | `/api/updates/check` | users.manage |

## Hosted authority

Customer account routes require the authenticated customer and scope every query to that UUID. Signup/login/recovery and public catalog/checkout/tracking have their explicit public controls. Hosted `/api/sync/*` routes require the private synchronization secret and paired installation. Remote owner/manager access is explicitly enabled locally, uses separate cookies, and checks current capabilities again before a local command is applied. Remote customer activation/recovery requires owner access.
