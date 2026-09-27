# Activate the 0.6 candidate

The source changes are tested locally. They have not been deployed to the public site, installed as an approved GitHub Release, or activated against the restaurant database. The user's phase 24 requires explicit deployment authorization after local checks pass.

## Before activation

1. Review AUDIT_REPORT.md and TEST_REPORT.md. Keep the current public URL/project and its existing D1 binding; do not create a replacement site or database.
2. Choose a maintenance window. Preserve the existing application version, `.runtime/public-cloud.json`, data directory and printer configuration. Never put these private files in GitHub.
3. Export/verify a hosted D1 backup using the hosting provider, and create a SQLite `VACUUM INTO` backup followed by `PRAGMA integrity_check`. Confirm order/customer/stock counts before migration.
4. Through the currently running POS's Owner settings, replace every staff password that will remain in use with a unique password of at least 12 characters. Disable unused demo accounts. Keep one active Owner. The new production login refuses `1234`; downloading source does not rotate passwords.
5. Check the private HTTPS cloud URL, strong synchronization secret and installation pairing. Keep the original installation ID. Do not run production with `DEMO_MODE=true`.
6. Review consumption locations against the actual kitchen/fridge/preparation areas. Main Store and Freezer require transfers. Confirm the restaurant timezone and loyalty earning policy before taking new orders.

## Coordinated activation after authorization

Deploy the tested Worker/client version to the existing hosted project and binding, then stop/start the POS with the tested application in the maintenance window. The migration runner verifies backups before identity and loyalty changes. Check migration versions 8, 9 and 10, health, catalog revision acknowledgement, account linking errors and the outbox review screen. The launchers enforce production mode when the public connection file exists.

Enable Owner/Manager remote access explicitly in Settings, setting a strong password at enrollment. After roster synchronization, use `/customer/admin.html` on the hosted domain. Remote changes show Pending/Delivered/Applied/Failed; an offline restaurant keeps them pending. Failed revision checks require refreshing and resubmitting the intended change.

## Hosted acceptance after authorization

Use clearly marked test identities/orders agreed for the maintenance window. Verify hosted health, catalog, account signup/login on two browsers, checkout, POS import, collection/fulfillment, status returning to the website, points and account history. Cancel/refund test orders through audited business operations. Do not delete immutable financial/stock/loyalty records to hide testing. Reconcile test cash and inventory explicitly.

Stop activation if migrations, pairing or reconciliation fail. Preserve diagnostics and the current database. Revert application code only when database compatibility is established; never blindly restore an earlier database over newer restaurant transactions.

Physical printers and drawer hardware require HARDWARE_ACCEPTANCE.md. Real payment gateways, SMS delivery, branches, delivery drivers and verified nutrition data are outside this implementation.

## Fresh developer/demo copy

Use Node 22.23.3 (the tested version). With no public connection file, `01_START_WEBSITE.bat` and `02_START_POS.bat` start the explicit local demo; `owner` / `1234` works only there. The Node cloud is a demo simulator: hosted accounts, remote administration and atomic cloud rewards use the Worker/D1 backend. For a brand-new production database, set `INITIAL_OWNER_PASSWORD` to a strong password before the first start; only Owner is seeded.

The old running process does not automatically load changed backend code. Source updates and restaurant-data synchronization are separate operations.
