# 🗺️ Meridian Voucher Studio

<p align="center">
  <strong>A premium, cross-platform Electron desktop application designed for Destination Management Companies (DMCs) to automate and control the generation of pristine DOCX and PDF reservation vouchers.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-41.5.0-blue.svg?style=flat-square&logo=electron" alt="Electron Badge">
  <img src="https://img.shields.io/badge/React-18.3.1-61dafb.svg?style=flat-square&logo=react" alt="React Badge">
  <img src="https://img.shields.io/badge/Tailwind-3.4.15-38bdf8.svg?style=flat-square&logo=tailwindcss" alt="Tailwind Badge">
  <img src="https://img.shields.io/badge/Supabase-Cloud-3ecf8e.svg?style=flat-square&logo=supabase" alt="Supabase Badge">
  <img src="https://img.shields.io/badge/License-Proprietary-red.svg?style=flat-square" alt="License Badge">
</p>

---

## 🌟 Core Features

*   **🖥️ Custom Native-Like Shell**: Wrapped in a sleek, high-performance Electron shell featuring customized Windows/macOS native-style menus and workspace management.
*   **📊 Dynamic Entry Grid**: A powerful, spreadsheet-like multi-row entry system powered by **React Hook Form** and **Zod** schema validations.
*   **🛌 Granular Occupancy Splits**: Custom inputs supporting occupancy breakdowns (Sgl, Dbl, Twin, Tpl) alongside dedicated child categories split by age groups (2–5 years and 6–11 years) with sub-options for sharing, extra bed, or individual room.
*   **🏷️ Intelligent Rate Supplement Override**: Supports granular, manual supplement assignment per line-item (such as `HB` - Half Board, `FB` - Full Board, `AI` - All Inclusive). Selected supplements are cleanly formatted as 2-letter codes, joined by delimiters (e.g., `HB|FB`), and automatically appended to the rate applicable descriptions.
*   **⚡ Automated Rate Matching Engine**: Dynamic lookups that scan the **Supabase** cloud datastore, auto-matching hotel contracts by reservation date, room category, client market, and age categories to suggest rates in real-time.
*   **📄 High-Fidelity Document Generation**: Compiles standard Word templates using **Docxtemplater** with robust support for structural array loops (`{#lineItems}...{/lineItems}`), fallback legacy templating, and conditional section rendering (e.g., reservation vs. amendment).
*   **🖨️ Headless PDF Compiler**: Integrates a background **LibreOffice** connection to programmatically render the compiled DOCX templates into production-ready PDFs.
*   **⚙️ Workspace & Settings Manager**: Persists settings (such as local export directories, LibreOffice path overrides, and employee profile data) in local app storage.

---

## 📁 Repository Architecture

```text
├── electron/
│   ├── main/                 # Electron main process, native OS bindings
│   │   ├── lib/              # Core business modules (document generator, Supabase API)
│   │   └── config.ts         # Native path and settings configuration
│   ├── preload/              # Secure IPC bridge (contextIsolation & sandbox)
│   └── shared/               # Type contracts and interfaces shared between processes
├── src/
│   ├── domain/               # Voucher schemas, Zod validation models, and default values
│   ├── ui/                   # React components and styling layers
│   │   ├── App.tsx           # Application frame and routing manager
│   │   ├── AppPanels.tsx     # Workspace layout grids and views
│   │   ├── DashboardScreen.ts# Voucher logs, activity summaries, and search filters
│   │   └── HotelRateMasterScreen.ts # Hotel rate rules, overrides, and supplements manager
│   └── styles.css            # Tailwind CSS system integration
├── templates/                # Word (.docx) templates folder
├── supabase/                 # Cloud database schema configurations
├── scripts/                  # Development utility and automated cleanup scripts
└── package.json              # App configuration, build commands, and dependencies
```

---

## 🚀 Getting Started

Follow these instructions to set up the development environment and launch the studio locally.

### 📋 Prerequisites

1.  **Node.js**: Recommended `v18.x` or `v20.x` LTS.
2.  **LibreOffice**: Required to generate PDFs locally. Make sure the `soffice` executable is in your system's PATH, or configure `LIBREOFFICE_PATH` in your `.env` file.

### 🔧 Installation & Configuration

1.  **Clone the Repository & Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Establish Environment Variables**:
    Copy the example template file to create your local environment configuration:
    ```bash
    cp .env.example .env
    ```
    Populate the following variables inside `.env`:
    ```ini
    SUPABASE_URL=your_supabase_project_url
    SUPABASE_ANON_KEY=your_supabase_anon_public_key
    VOUCHER_API_PORT=5183
    LIBREOFFICE_PATH="C:\\Program Files\\LibreOffice\\program\\soffice.exe" # Windows example
    MERIDIAN_EMPLOYEE_EMAIL=operator@meridian.com
    ```

3.  **Synchronize Runtime Configurations**:
    The build script uses a configuration synchronizer to feed non-sensitive settings to the Electron runner without exposing raw environmental files inside the package:
    ```bash
    npm run sync:public-config
    ```

### 💻 Running Locally

To initiate concurrently the Vite dev server, TypeScript background compilers, and Electron app shell, simply run:
```bash
npm run dev
```

---

## 📝 Word Document Templating

The application populates Word templates located at `templates/voucher-template.docx`. You can customize the document layout by inserting standard **Docxtemplater** tags.

### 🏷️ Supported General Tags

| Tag Name | Description |
| :--- | :--- |
| `{voucherTypeLabel}` | Resolves to "Hotel Reservation Voucher", "Amendment Voucher", etc. |
| `{hotelName}` | The targeted hotel's name. |
| `{requisitionNo}` | The voucher requisition tracking number. |
| `{tourNo}` | The booking reference tour number. |
| `{tourName}` | Name of the tourist group or itinerary. |
| `{customerName}` | The primary guest or client's name. |
| `{employeeName}` | Name of the creating Meridian operator. |
| `{employeeEmail}` | Email address of the creating Meridian operator. |
| `{totalRooms}` | Sum of all single, double, twin, and triple rooms booked. |
| `{rateApplicable}` | The computed final billing rate text, including any manual supplement tags (e.g. `Rate: USD 150 (HB|FB)`). |
| `{remarks}` | Freeform billing and coordinator notes. |

### 🔄 Multi-Row Grid Table Loop

To output booking rows, create a table in Word and place a Docxtemplater block inside the table cells. The engine will dynamically loop over the entries:

| Date | Category | Basis | Sgl | Dbl | Twin | Tpl | Guide | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `{#lineItems}` | `{roomCategory}` | `{basis}` | `{sgl}` | `{dbl}` | `{twin}` | `{tpl}` | `{guideWithBasis}` | `{arrivingFor}` |
| | | | | | | | | `{/lineItems}` |

*   Use `{guideWithBasis}` to format a guide assignment cleanly (e.g. `1 (HB)`).
*   Use `{requiredDateDisplay}` to format a voucher date in a readable layout (e.g. `14-Feb-2026`).

### 🔀 Conditional Render Sections

Wrap sections with simple booleans to control what content displays:
```text
{#isReservation}
All payments will be settled by Meridian (Pvt) Ltd.
{/isReservation}

{#isAmendment}
THIS IS AN AMENDING VOUCHER. Please discard previous updates.
{/isAmendment}
```

---

## 🏛️ Database Migrations

Database tables are stored in **Supabase**. To initialize or migrate the database:
1. Navigate to the Supabase SQL editor dashboard.
2. Open and execute the schema initialization file: [schema.sql](file:///d:/repos/meridian_voucher_studio/supabase/schema.sql).

---

## 📦 Building Installers

To package the studio into high-performance, standalone desktop installers (output to the `release/` folder):

```bash
# Compile code assets and assemble installer packages
npm run dist

# Build production packages with code signatures (if certificates are configured)
npm run dist:signed
```

---

## 🧼 Public Distribution & Sanitization Checklist

Before pushing local branches to public mirrors, follow this standard security check:

1.  **Run the Interactive Purge Tool**:
    An interactive script has been provided to quickly strip common compilation caches, logs, and distributable folders:
    ```powershell
    ./scripts/cleanup-release.ps1
    ```
2.  **Verify Trailed Secrets**:
    Confirm `.env` and `build-resources/config.json` are properly ignored by Git:
    ```bash
    git ls-files --error-unmatch .env || echo "Clean: .env is ignored"
    git ls-files --error-unmatch build-resources/config.json || echo "Clean: config.json is ignored"
    ```
3.  **Perform Git Index Sanitization**:
    If large binary installers or previous configuration cache was accidentally tracked, wipe them from cache before committing:
    ```bash
    git rm -r --cached release dist-electron build-resources dist out test-out.docx
    git commit -m "chore: remove tracked build products and cached secrets"
    ```
4.  **Wipe Git History (Optional)**:
    If large binaries or tokens were committed to the historical records in the past, clean them up locally using `git-filter-repo` and force push the cleaned history:
    ```bash
    git filter-repo --path release --path dist-electron --path build-resources --invert-paths
    ```

---

<p align="center">
  Developed by <strong>Meridian Destination Management</strong>. All rights reserved.
</p>
