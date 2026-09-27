# Synchronization design

The restaurant SQLite database is authoritative for sales, payments, shifts, recipes, stock movements, printing and applied management changes. The hosted D1 database owns customer credentials, customer sessions, addresses, favourites, the customer-facing order queue, and the spendable loyalty ledger. GitHub contains source and releases only.

## Delivery and ordering

The POS polls independently of local sales. Losing the cloud does not suspend a local transaction or printing. The heartbeat expires after three minutes and pauses new website orders. Cloud order IDs are unique local request IDs; order creation, stock consumption, print jobs and import acknowledgement records commit together. A lost acknowledgement retries the existing import.

Local checkout uses `/api/public/orders`; the anonymous `x-public-order` bypass is removed. Hosted checkout uses `/api/orders`. Both validate integer quantities (1–99), at most 100 lines, modifiers, phone numbers, request IDs and server prices. Canonical request serialization ignores object property ordering. A request key cannot be reused for a different order.

## Catalog

`src/catalog.js` produces a deterministic SHA-256 revision. Eligibility requires an active category/product, stock availability, online publication, a valid price and non-empty recipe. Menu management displays reasons for exclusion. Heartbeats return the active cloud revision; the catalog is uploaded on change or revision disagreement, including after cloud storage recovery. Loyalty rules/rewards travel with this public projection.

## Outbox

Operational changes create their outbox event in the same SQLite transaction. Version 9 removes indiscriminate low-level inventory, finance and audit replication. Order status, linked customer order history, loyalty and redemption commit records have explicit projections. Credentials are never part of the general outbox.

Each event has a unique key, attempts, next retry, error and `pending`, `retrying`, `synced` or `dead-letter` status. Backoff starts around one second and is bounded to 375 seconds including jitter. Five failed attempts move an event to review; malformed JSON moves immediately. Later events for that same entity remain behind it; unrelated entities continue. Cloud receipt keys make delivery idempotent. Network errors preserve the queue.

## Identity and points

Authenticated web orders carry the cloud UUID and member reference. Local `customer_links` maps that account to an existing local UUID when an operator explicitly approves linking. Ambiguous phone matches are flagged for review. Guest knowledge of a phone number cannot attach an authenticated account. Linked local order history and earned/reversed points synchronize without credentials, inventory or purchase costs.

Offline earning records immutable local ledger entries. Online redemptions use an atomic cloud ledger debit. POS reservations bind customer, request ID, reward and normalized items; failed local transactions release the reservation. Committed sales emit confirmation; retries reuse the same reservation. Ambiguous interrupted reservations are held, not automatically released, to avoid double spending. Refunds append reversals.

## Remote management

Remote access is opt-in for owner/manager users and requires a new password of at least 12 characters. A private paired sync endpoint publishes the remote login verifier and minimal menu configuration resources. Remote sessions are separate Secure, HttpOnly cookies. Commands carry UUID, installation, schema version, actor, expected catalog revision, operation and payload.

Commands move through Pending → Delivered → Applied/Failed. The POS checks current local account activation, remote access and capabilities before applying a supported operation in one transaction with a durable receipt. Re-delivery returns that receipt. A changed revision fails visibly rather than overwriting newer changes. Arbitrary stock changes and SQL are unsupported.

Pairing requires both a private secret and installation header for every hosted sync endpoint. Demo secrets require explicit `DEMO_MODE=true`. The Node cloud simulator is demo-only; production uses the Worker/D1 service.
