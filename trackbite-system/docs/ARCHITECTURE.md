# Track Bite operating model

## Authority and deployment

The restaurant service and SQLite WAL database are authoritative for restaurant operations. Browsers on the terminal or restaurant LAN talk only to this service. Internet failure never participates in a sale's database transaction. A separate cloud service owns online-order intake and a replicated reporting store. A Windows browser plus local Node service is the current equivalent local architecture; native installer and device certification are separate delivery work.

## Domain and integrity

Users have roles and overridable permissions. Categories, products, recipes, generic ingredients, purchasable variants, locations, batches, and modifiers form the catalogue. Purchase units convert to g/ml/pieces. A recipe is mandatory for sale. Modifiers have signed ingredient deltas and server-controlled prices. Negative final recipe requirements are invalid.

Stock equals the sum of immutable movements. Receipts are positive; sales, waste and production inputs are negative; transfers use balanced linked pairs; stocktakes create the difference; explicit refund restocking reverses original allocations. A transaction must validate all quantities, available stock, locations and variants. Production consumes actual inputs and records actual outputs atomically, with shared reference IDs. Duplicate input rows cannot bypass stock validation.

Each batch belongs to a variant and can have an expiry date. Allocation uses preferred variant, FIFO or FEFO; expired stock is excluded from sales. Manual allocation chooses an approved variant. Costs use recorded receipt costs; unknown opening costs remain unknown rather than being presented as zero profit.

## Orders, payments and shifts

POS completion atomically stores item/price/modifier snapshots, payments, stock deductions, print jobs, audit and outbox events. Client request IDs provide retry idempotency. Money is rounded to currency minor units. Quantities and payments must be finite and positive; payment totals must match the discounted order total. Reference requirements belong to configurable payment methods.

Financial state: completed -> refunded (full refund only in this release). Original rows remain immutable evidence. Refunds record separate payment reversals, reason, actor and approving manager. Optional stock return is explicit because prepared food often cannot return to stock. Fulfilment state: accepted -> preparing -> ready -> fulfilled; terminal orders cannot go backwards. Online orders enter this same pipeline; payment due is distinct from collected cash.

Shift expected cash = opening + cash receipts - cash refunds - cash expenses. Refund cash belongs to the shift processing the refund. Reports preserve method separation. Closed shifts retain counted cash and reconciliation history.

## Permissions and audit

Server-side permissions gate each route; UI visibility is only convenience. Owner retains administrative recovery access. Manager approval can authorize a single sensitive request and never persists the manager password. Audit rows hold actor, timestamp, old/new values, reason and approver. Cashier endpoints do not return cost or profit data. Physical inventory correction and price/discount/refund operations require their own permissions.

## Synchronization

SQLite triggers append immutable JSON row snapshots to an outbox in the same transaction as every domain mutation. Each event has a random UUID and installation identifier; retries resend the same event ID. Cloud ingests events and updates its reporting mirror atomically, deduplicating by event ID. Local delivery acknowledgement only follows successful cloud commit. A single-flight loop uses bounded HTTP timeouts and retains failed events with retry counts and errors.

Online orders use globally unique IDs. Local import, sale allocations and cloud-import mapping commit together; repeated imports return the original local order. A crash between import and acknowledgement therefore cannot duplicate the sale. Restaurant heartbeat controls online-order availability. Cloud intake validates the synchronized menu and queues orders; fulfilment and payment status flow back through synchronization.

## Printing and screens

Completion records one customer receipt and one job per preparation station. Tickets snapshot item names, modifiers, notes and station routing. Printer settings select station, transport and 58/80 mm paper. Browser printing is the universal local fallback; Windows/raw transports require configured real devices and validation. Reprints create a new visibly marked job rather than mutating the original receipt. Printing failure never rolls back a paid order.

Screens are separated into shell/shared utilities, POS, orders/kitchen, inventory/operations, reports, and configuration modules. Arabic is default with RTL; all labels and relevant entity names support English. Local fonts and assets avoid internet dependencies.

## Boundaries requiring deployment acceptance

Public hosting, domain/TLS, payment-provider credentials, printer hardware, backup retention/restore drills, and load/security acceptance must be verified on the deployment environment. Demo SQLite cloud storage is not a claim of production PostgreSQL deployment. Offline here means internet loss while the local service/PC remains operational, not surviving loss of the restaurant PC.
