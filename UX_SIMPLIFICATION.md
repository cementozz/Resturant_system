# Track Bite — simpler daily workflows

The existing Arabic-first visual style, stock ledger, permissions, order confirmation, synchronization, accounting, loyalty and printing remain in place. The staff app now starts with nine clear sections: Cashier, Orders & kitchen, Menu, Raw materials, Stock & production, Purchases & expenses, Customers, Reports and Settings. Sections and actions follow the signed-in account's permissions.

## Daily tasks

| Task | Where to start |
|---|---|
| Create or edit a material | **Raw materials** → New material, or click its name/default location to edit inline |
| Archive or restore a material | **Raw materials** → Archive; enable Show archived to restore it. History remains intact |
| Change a selling price | **Menu** → click the price, enter the actual price, press Enter |
| Edit a recipe | **Menu** → Recipe. Search materials, enter quantity/unit, add rows with Enter |
| Record a purchase | **Purchases & expenses** → Purchase invoice. Find/create the supplier and materials within the invoice |
| Record an expense | **Purchases & expenses** → General expense |
| Find stock | **Stock & production** → select a warehouse. Expand details for brands and the link to batches, expiry and movement history |
| Move stock | **Stock & production** → Transfer stock. Choose material, source, destination and quantity |
| Run production | **Stock & production** → Production. Choose a saved template or enter inputs/outputs, then record actual quantities |
| Inspect a website order | Hover a cashier incoming-order card for 650 ms, or tap it. Staff still explicitly accept/reject through the existing confirmation service |
| Prepare/finish an order | **Orders & kitchen** → Kitchen. One-click progress waits for backend confirmation; failure keeps the prior state |
| Collect a ready order | Select the wallet/payment action. Enter a reference only when the selected method requires one. Kitchen accounts never receive this control |
| Get help | Header **Help**, page-specific help, or the small explanation icons |
| Find a record | Header **Search** searches available menu/material records and permitted recent orders, customers and suppliers |

Menu items show essential fields first; recipes, modifiers, website, kitchen and history are expandable. Materials remember an optional default location, while each receipt can override it. Purchase rows accept a unit price or a whole-line price, and optional lot, expiry and carton conversion details remain collapsed. Historical costs are entered through traceable purchases/receipts rather than silently overwriting the ledger.

Use Tab for normal field movement, Enter to move through compact rows/add the next row, Escape to dismiss an inline edit or selector, and Ctrl+S to submit the current form. Searchable selectors can create supported records in place. Transfer and production require actual quantities; saving a template itself changes no stock.

## Spreadsheet import

Download the **CSV** template from Raw materials, Menu, Menu prices/costs, or Purchases. UTF-8 CSV and tab-separated files are supported; native XLSX workbooks are not. Paste tab-separated rows directly into the recipe/purchase entry tools where offered.

Upload, inspect the editable preview, correct errors, and select **Check rows** before **Confirm import**. No preview writes records. Every row must validate; a failed import rolls back the entire commit. Purchase matching normalizes Arabic and English names and asks for an explicit choice if multiple records match. Repeating the same confirmed file is idempotent. Purchase files group rows by supplier, invoice date and optional invoice number: give separate invoices distinct identifiers when they otherwise share those values. Limits are 500 rows and 1 MB per file.

## Technical scope and validation

Migration 13 creates a verified SQLite backup and adds material defaults/display units, invoice date/notes, production templates and durable UX request keys. Thin adapters call the existing purchase, transfer and production services; they do not replace the accounting or stock ledger. The former detailed inventory tools remain under **More details**.

Automated coverage includes material create/edit/archive/restore, invoice autocomplete and inline creation, prices, recipes, CSV preview/commit, warehouse transfer, saved production templates, compact website approval, ready-order payment, help, search and Arabic mobile layout. See [TEST_REPORT.md](TEST_REPORT.md). Desktop and mobile screenshots were also visually reviewed using isolated test records.

No real restaurant prices, recipes, purchases or opening quantities were invented for this change. The real menu remains in setup until those values are supplied. See [REAL_MENU_SETUP.md](REAL_MENU_SETUP.md) and [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md).
