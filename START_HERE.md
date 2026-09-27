# Track Bite — Start here / ابدأ من هنا

**Double-click `01_START_WEBSITE.bat` to run the customer website.**
**اضغط مرتين على `01_START_WEBSITE.bat` لتشغيل موقع الطلبات.**

On the original development computer, no installation is needed because a portable Node runtime is available in `.runtime`. For a fresh GitHub download, install Node.js 22.5 or newer first and make sure `node` is on PATH. The portable runtime, local databases and logs are not uploaded to GitHub; the application creates a fresh demo database on first run.

| File | What it does / الوظيفة |
| --- | --- |
| `01_START_WEBSITE.bat` | Starts both services and opens the customer website / تشغيل موقع العملاء |
| `02_START_POS.bat` | Starts both services and opens staff/POS / تشغيل الكاشير والإدارة |
| `03_STOP_TRACK_BITE.bat` | Stops services started by the launcher; keeps data / إيقاف النظام مع حفظ البيانات |
| `04_CHECK_SYSTEM.bat` | Checks runtime, services, and menu connection / فحص التشغيل |

Public website: https://trackbite-restaurant.abdallah-abdelhady04.chatgpt.site/customer/  
Local demo website: http://127.0.0.1:5174/customer/  
Staff/POS: http://127.0.0.1:4173/pos/  
Local website: http://127.0.0.1:4173/customer/

Demo staff login: **owner** / **1234**.

The public website is accessible from other devices. Keep the configured restaurant computer awake, online and running the POS to receive website orders. Localhost links only work on this computer while the services are running. Do not open HTML files directly: use the launchers so ordering and databases work. See [the public hosting guide](trackbite-system/docs/PUBLIC-HOSTING.md).

## Where files live

```text
01_START_WEBSITE.bat       Customer website launcher
02_START_POS.bat           Staff/POS launcher
03_STOP_TRACK_BITE.bat     Stop services
04_CHECK_SYSTEM.bat        Check operation
START_HERE.md             This guide
tools/                    PowerShell launch and test scripts
trackbite-system/
  server.js               Restaurant service entry point
  cloud/                  Website order/sync service
  public/customer/        Customer website
    modules/              Menu, checkout, customer preferences
    assets/               Replaceable images and brand assets
  public/app/             Staff/POS UI modules
  public/print/           Receipt previews
  src/                    Restaurant business logic and printing
  data/                   Restaurant database and backups — keep these
  docs/                   Features, setup and limitations
  tests/                  Automated checks
.runtime/                 Portable Node, logs, development artifacts
```

Developer tests: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/test.ps1`.

See [website features and remaining setup](trackbite-system/docs/STOREFRONT.md) and [restaurant/printing details](trackbite-system/docs/UPGRADE-0.3.md).
