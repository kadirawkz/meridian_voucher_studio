# 🗺️ Meridian Voucher Studio

<p align="center">
  <strong>A premium, enterprise-grade cross-platform Electron desktop application designed for Destination Management Companies (DMCs) to automate, validate, and manage the generation of pristine DOCX and PDF reservation vouchers.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-41.5.0-blue.svg?style=for-the-badge&logo=electron" alt="Electron Badge">
  <img src="https://img.shields.io/badge/React-18.3.1-61dafb.svg?style=for-the-badge&logo=react" alt="React Badge">
  <img src="https://img.shields.io/badge/Tailwind-3.4.15-38bdf8.svg?style=for-the-badge&logo=tailwindcss" alt="Tailwind Badge">
  <img src="https://img.shields.io/badge/Supabase-Cloud-3ecf8e.svg?style=for-the-badge&logo=supabase" alt="Supabase Badge">
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License Badge">
</p>

---

## 🌟 Core Capabilities

- **🖥️ Bespoke Native Shell & Anchor Steel Theme**
  Wrapped in a high-performance Electron shell featuring customized native OS menus and context options. Engineered with the **Anchor Steel Dark Theme**—a premium, low-contrast metallic interface designed to reduce operator eye fatigue during high-volume processing.
- **📊 Transactional Entry Grid**
  A high-fidelity spreadsheet-like grid that enables rapid multi-row voucher inputs. Fully backed by **React Hook Form** and strict **Zod** schema validation to catch errors before compilation.
- **🛌 Intelligent Occupancy Splits**
  Fully customizable lodging inputs accommodating complex occupancy matrices (Single, Double, Twin, Triple) coupled with age-stratified child category splits (2–5 years and 6–11 years) and sub-allocations (Extra Bed, Sharing Bed, or Dedicated Room).
- **🏷️ Premium Supplement Overrides**
  Bespoke multi-select interfaces with checkbox indicators for boarding rules (e.g. `HB`, `FB`). Supplements are parsed as compact tokens (e.g. `HB|FB`) and formatted cleanly without layout overflow.
- **⚡ Real-Time Rate Validation Engine**
  An automated lookups engine scanning active hotel contracts inside a **Supabase** cloud datastore, instantly matching reservation dates, rooms, markets, and guest configurations to suggest current contractual rates. Includes customizable **Rate Applicable Text Layouts**—choose between a flat Legacy structure and an optimized Grouped structure that eliminates redundant entries by grouping pricing parameters by room category, keeping date-wise exceptions (FOC rules, surcharges, events) separated.
- **📂 Resilient Folder Integrity & Relocation Explorer**
  An active path monitoring service. If the local export folder is disconnected, the interface renders a smooth recovery wizard in the side drawer for fast, one-click storage relocation.
- **📄 Premium Document Compilation**
  Compiles standard Microsoft Word templates (`.docx`) utilizing **Docxtemplater** with full support for looping tables (`{#lineItems}...{/lineItems}`), fallback values, and dynamic reservation-vs-amendment conditional layouts.
- **🖨️ Headless PDF Engine**
  Utilizes Electron-native offscreen printing to instantly compile high-fidelity, customer-facing PDF copies of vouchers locally with zero third-party software requirements.
- **⚙️ Core Settings & Workspace Manager**
  Securely persists application-wide preferences (export paths, default operator profiles) in a local reactive state store.
- **🐳 Containerized Browser Deployment (Docker & Web Bridge Polyfill)**
  Enables running the application completely containerized in standard browser environments. A custom web-bridge polyfill translates native Electron IPC calls into REST API requests against a standalone Express API backend, served concurrently via Nginx.

---

## 📁 Repository Architecture

```text
├── .github/                  # CI/CD Workflows
│   └── workflows/            # Automated integration & build actions
├── electron/
│   ├── main/                 # Electron main process & OS bindings
│   │   ├── lib/              # Core modules (document compilers, PDF engines)
│   │   ├── config.ts         # Path and file resolution configurations
│   │   └── standalone.ts     # Standalone Express API backend (Docker / Web mode)
│   ├── preload/              # Secure IPC bridge (sandboxed contextIsolation)
│   └── shared/               # TypeScript models & shared API contracts
├── src/                      # UI Rendering Layer
│   ├── domain/               # Voucher specifications, default schemas, validation rules
│   ├── ui/                   # React screens, modules, and components
│   │   ├── App.tsx           # Main application frame & navigation router
│   │   ├── AppPanels.tsx     # Workspace layout configurations
│   │   ├── DashboardScreen.ts# Logs explorer, audit trials, and filters
│   │   ├── HotelRateMasterScreen.ts # Hotel contracts & boarding rules engine
│   │   └── webBridgePolyfill.ts # Web bridge polyfill for browser/Docker mode
│   └── styles.css            # Base Tailwind CSS styles
├── templates/                # Standard master template configurations (.docx)
├── supabase/                 # Database migrations & seeds
├── scripts/                  # Development utility tools & local scripts
├── data/                     # Local persistent storage (e.g. auth sessions, ignored)
├── Dockerfile.api            # Docker container for the standalone API server
├── Dockerfile.web            # Docker container for the Vite web build & Nginx
├── docker-compose.yml        # Docker Compose configuration for multi-container orchestration
└── package.json              # App manifest & compile configurations
```

---

## 🚀 Getting Started

Follow these steps to configure your local development workspace.

### 📋 Prerequisites

1.  **Node.js**: Recommended `v18.x` or `v20.x` LTS.
2.  **Docker**: Optional (required for containerized web deployment).

### 🔧 Installation & Setup

1.  **Install Node Modules**:

    ```bash
    npm ci
    ```

2.  **Configure Environment Defaults**:
    Duplicate the configuration template to establish your local `.env` file:

    ```bash
    cp .env.example .env
    ```

    Populate the variables with your development credentials:

    ```ini
    SUPABASE_URL=https://your-project.supabase.co
    SUPABASE_ANON_KEY=your-anon-public-key
    VOUCHER_API_PORT=5183
    MERIDIAN_EMPLOYEE_EMAIL=operator@meridian.com
    ```

3.  **Synchronize Runtime Configuration**:
    Generate target configuration manifests for the Electron shell process:

    ```bash
    npm run sync:public-config
    ```

4.  **Launch Local Server (Electron)**:
    Boot the Vite dev environment, TypeScript compiler, and Electron container concurrently:

    ```bash
    npm run dev
    ```

5.  **Launch via Docker (Web / Browser Mode)**:
    For instructions on running containerized web and API services, refer to the [DOCKER.md](file:///d:/repos/meridian_voucher_studio/DOCKER.md) guide:
    ```bash
    docker compose up --build -d
    ```

---

## 🔁 CI/CD Pipelines

Automated integration workflows are configured using **GitHub Actions**:

- **Continuous Integration (`ci.yml`)**: Triggered automatically on pushes and pull requests to `main`, `master`, and `dev` branches. Executes Prettier verification, strict ESLint analysis (`npm run lint`), TypeScript checks (`npm run typecheck`), and verifies build compatibility (`npm run build`).
- **Continuous Delivery & Draft Releases (`release.yml`)**: Triggered when pushing tags starting with `v` (e.g., `v1.0.0`). Compiles production builds and packages installers for Windows (`.exe`) and macOS (`.dmg`) using standard runner pools, uploading assets directly to a draft release in your repository.

---

## 📝 Document Template Customization

Master templates are maintained under `templates/voucher-template.docx`. Customize layouts by placing **Docxtemplater** placeholders directly into your Word documents.

### 🏷️ Standard Tags

| Placeholder          | Resolution                                                             |
| :------------------- | :--------------------------------------------------------------------- | ----- |
| `{voucherTypeLabel}` | Resolves to "Hotel Reservation Voucher", "Amendment Voucher", etc.     |
| `{hotelName}`        | Targeted hotel name.                                                   |
| `{requisitionNo}`    | Unique tracking reservation requisition number.                        |
| `{tourNo}`           | Operator reference tour number.                                        |
| `{tourName}`         | Name of the tourist group or itinerary path.                           |
| `{customerName}`     | Lead guest / primary passenger.                                        |
| `{employeeName}`     | Creating Meridian operator name.                                       |
| `{employeeEmail}`    | Creating Meridian operator email.                                      |
| `{totalRooms}`       | Combined count of rooms (Single, Double, Twin, Triple).                |
| `{rateApplicable}`   | Standard pricing structure format with supplements: `Rate: USD 150 (HB | FB)`. |
| `{remarks}`          | Freeform billing exceptions or coordinator remarks.                    |

### 🔄 Multi-Row Booking Iterations

Insert standard loops inside table rows to dynamically generate invoice grids:

| Date           | Category         | Basis     | Sgl     | Dbl     | Twin     | Tpl     | Guide              | Notes           |
| :------------- | :--------------- | :-------- | :------ | :------ | :------- | :------ | :----------------- | :-------------- |
| `{#lineItems}` | `{roomCategory}` | `{basis}` | `{sgl}` | `{dbl}` | `{twin}` | `{tpl}` | `{guideWithBasis}` | `{arrivingFor}` |
|                |                  |           |         |         |          |         |                    | `{/lineItems}`  |

- `{guideWithBasis}`: Pre-formatted guide credentials, e.g., `1 (HB)`.
- `{requiredDateDisplay}`: Formatted dates, e.g., `14-Feb-2026`.

### 🔀 Section Conditions

Toggle specific text blocks depending on the booking type:

```text
{#isReservation}
Payment settled by Meridian (Pvt) Ltd.
{/isReservation}

{#isAmendment}
AMENDMENT NOTICE: Please replace and ignore prior vouchers.
{/isAmendment}
```

---

## 🏛️ Database Migrations

Database tables are stored in **Supabase**. To initialize or migrate the database:

1. Navigate to your Supabase project's SQL editor dashboard.
2. Load and execute the schema configurations found in [schema.sql](file:///d:/repos/meridian_voucher_studio/supabase/schema.sql).

---

## 📦 Distribution Compiles

To compile distribution packages and generate installers locally:

```bash
# Package standard production installers
npm run dist

# Generate production packages with native code-signatures
npm run dist:signed
```

Installers are exported to the local `/release` directory.

---

## 🧼 Code Clean & Sanitization

To ensure production keys or large binaries are never committed to public branches, perform the sanitization routine before pushing:

1.  **Execute Clean Script**:
    Purges cache directories and build outputs:
    ```powershell
    ./scripts/cleanup-release.ps1
    ```
2.  **Verify Secrets Exclusion**:
    Confirm configuration secrets are unindexed:
    ```bash
    git ls-files --error-unmatch .env || echo "Secure: .env is ignored"
    git ls-files --error-unmatch build-resources/config.json || echo "Secure: config.json is ignored"
    ```
3.  **Sanitize Git Cache**:
    If intermediate outputs were previously committed, clear them from the local stage index:
    ```bash
    git rm -r --cached release dist-electron build-resources dist out test-out.docx
    git commit -m "chore: remove tracked binaries and configurations"
    ```

---

<p align="center">
  Developed by <strong>Meridian Destination Management</strong>. Released under the <a href="LICENSE">MIT License</a>.
</p>
