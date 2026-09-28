# Real menu setup

The owner confirmed that all existing orders and operational entries were experimental. Their history is retained. Experimental product prices and recipes are archived and excluded from current costing and sales until manually verified. Existing stock quantities are historical test entries, not confirmed physical stock.

The supplied list contains **29 products**, **7 categories**, **36 generic ingredients** and **7 reusable extra templates**. The example counts in the request were smaller than its actual lists. Stable SKUs/codes make the seed repeatable; existing equivalent ingredients and the Cola SKU are reused.

Run from the repository root with Node 22.13 or newer:

```powershell
npm run seed:real-menu -- --keep-demo
```

The restaurant's initial conversion additionally uses `--experimental-existing`, following the owner's clarification. This archives existing non-setup products, retains their records and recipes, and disables their sale/publication. It does not delete orders, purchases, stock movements, customers or recipes. Every seed and migration makes an integrity-checked database backup. Do not use this conversion flag later on a restaurant with verified products.

Open **POS → Recipes & profitability**. All real items are drafts. Each item has General, Recipe, Modifiers, Pricing, Kitchen, Website and History tabs. Enter actual recipe quantities, selling price and preparation station. Enter purchase costs in Receiving/Purchases; specify the purchase unit and conversion (for example, pieces per carton), using values from the real receipt. Brands remain secondary variants of generic ingredients.

Costing follows the configured Latest Purchase Price or weighted Average Cost. Missing costs stay unknown: the screen lists missing ingredients, the known subtotal, separate ingredient/packaging totals, and hides final profit percentages until complete. Extra templates have neither assumed price nor consumption; configure them before use.

New items remain unavailable to sell and hidden online. A real draft requires a verified recipe, known ingredient costs and a positive manually entered price before it can be sold. Then explicitly enable Available for sale and Visible online. An unavailable preparation-stock projection disables website ordering; final stock validation still happens at restaurant acceptance.

**Remaining input:** the actual ingredient purchase receipt, recipe quantities and selling prices. No prices or recipes have been invented. The receipt has not been located in the supplied text attachments or entered as verified cost data. Reconcile experimental stock with the real opening inventory through the existing audited stock workflow before real service.

For operations, run `02_START_POS.bat`. Run `04_CHECK_SYSTEM.bat` to check production mode, pairing, catalog revisions and incoming/review queues. Credentials remain in `.runtime/access/PRODUCTION-LOGINS.txt` on this PC and are never uploaded.
