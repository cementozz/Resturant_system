# Loyalty and rewards

Points are immutable signed ledger transactions with UUID, customer/order references, event type, idempotency key, reason, actor and timestamp. Balances are sums of the ledger. Neither clients nor staff can write a mutable balance.

Default earning: one point per 10 EGP of item subtotal after discount, rounded down, finalized when paid and fulfilled. Taxes, service and delivery charges are excluded. Settings control enabled state, amount per point, rounding, minimum spend and qualifying state. Changes use the existing Settings cards and forms.

Each order snapshots its earning policy so later configuration changes do not change an older order's refund/amendment calculation. The spendable balance is cloud-authoritative and includes website and POS redemptions. The POS customer-points API reads that cloud balance; when disconnected or unlinked it returns an explicit unavailable balance plus local ledger entries, never a misleading spendable total calculated from local earnings alone.

Rewards support a free product, fixed discount or percentage discount, Arabic/English names, cost, activation and optional validity dates. No sample reward is silently enabled. A free item must be in the cart and consumes its normal recipe stock. Zero-total orders need no collected payment.

The cloud serializes redemption debits in the same D1 transaction as the order or POS reservation. A database trigger rejects a debit beyond the balance. Concurrent clients cannot spend the same points twice. POS redemption requires an attached cloud account and a working connection. Offline sales still earn locally; a loss of connectivity never enables offline redemption.

POS reservations survive an uncertain response and are retried by the same request key. If the local order rolls back, its reservation is released with a compensating ledger entry. An interrupted reservation with an uncertain local result remains held for reconciliation. Do not manually restore those points without checking the local request/order.

Refunds append earned-point reversals and, where applicable, redemption reversals. Replaying imports/events cannot award the same earn event again. A refunded earning can make a balance negative if points were already spent; future redemption remains blocked until the balance is sufficient. Manual adjustments require `loyalty.adjust`, a reason and an idempotency key. Expiration is reserved as a later policy; no expiration job currently runs.
