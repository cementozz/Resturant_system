# Approved release updates

Use Owner Settings → Updates to check the latest published stable GitHub Release. The system never runs `git pull main` on a restaurant machine. No restaurant database or private runtime file is sent to GitHub.

Each installable release needs:

- A stable semantic tag, such as `v0.6.1`.
- `trackbite-0.6.1.zip` containing the versioned source package.
- `trackbite-approved.json` with matching version/asset, SHA-256, `approved: true`, and an explicitly reviewed `databaseCompatibleFrom` list.

`05_INSTALL_APPROVED_UPDATE.bat` invokes `tools/install-update.ps1`. It downloads only from the configured repository's versioned release, checks metadata and SHA-256, rejects unsafe archive paths/data/secrets, verifies package version, runs the downloaded smoke test with isolated data, and requires an approved database compatibility strategy. It makes a SQLite `VACUUM INTO` backup and verifies integrity before stopping the app.

Application replacement keeps the live data directory, runtime connection secrets and DB-stored printer settings. Startup performs migrations and a health check. If health fails, the previous application is restored against the same current database. The installer never blindly restores an older database. Incompatible migration/rollback combinations are refused before shutdown.

The installer currently replaces `trackbite-system/`; machine launchers and runtime configuration stay in place. Future releases that need a different launcher/runtime require an explicit bootstrap upgrade rather than silently replacing the updater while it runs.

PowerShell tests exercise installation success, failed-health rollback and checksum rejection in disposable workspaces, verifying existing orders/secrets and committed migrations survive. Network responses and the service launcher are simulated there; no real GitHub release or running restaurant is installed during tests.

No release is published automatically by this work. The first upgrade from the historical 0.4 database needs a reviewed migration window and verified backup; do not claim that the old application can use the new identity schema without validating that compatibility.
