# Customer accounts

The hosted website has signup, login/logout, profile, addresses, favourites, backend order history, points and rewards. Identity uses an immutable UUID and a `TB-000001` style member reference. Egyptian local mobile formats normalize to the same international number. Phone uniqueness does not imply SMS verification; no SMS provider is configured.

Passwords require 12–128 characters and are stored as salted scrypt verifiers. This KDF is tested in the actual Workers runtime. Sessions use random 256-bit tokens; only SHA-256 token hashes are stored in D1. Customer cookies are HttpOnly, Secure, SameSite=Lax and host scoped, with 30-day expiry. Account deactivation or password change increments a revision and invalidates existing sessions. Logout removes the current session. Authentication secrets never enter customer localStorage.

Mutation endpoints require same-origin requests. Signup/login/recovery are rate limited. Every profile, address, favourite and history query is scoped to the authenticated UUID. Public tracking exposes status/amount only. Shared browser carts and guest history remain conveniences, not account identity or loyalty balances.

Recovery is explicit: the owner verifies identity out of band, issues a random one-time token through the protected administration endpoint, and privately delivers it. The database stores only its hash, with a 15-minute expiry. Reset consumes the token and revokes sessions. The UI states that automated SMS/email recovery is not configured. A future delivery provider can wrap this token flow without pretending that a phone has already been verified.

POS users with customer permissions can search phone, name, member code or UUID and attach a customer. An old guest phone match requires explicit linking via `/api/customers/link`, using the cloud's authenticated private account directory and a recorded reason. It does not automatically merge two established accounts.

Local-only/demo-cloud storefronts retain guest checkout and clearly use browser details; real accounts are hosted. `guest_checkout_enabled=false` requires hosted account login for web orders.
