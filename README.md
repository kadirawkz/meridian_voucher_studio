# Meridian Voucher Studio

<p align="center">
  <strong>Cross-platform Electron desktop software for generating and managing reservation vouchers, rate lookups, and document exports for destination management teams.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-41.5.0-blue.svg?style=for-the-badge&logo=electron" alt="Electron Badge">
  <img src="https://img.shields.io/badge/React-18.3.1-61dafb.svg?style=for-the-badge&logo=react" alt="React Badge">
  <img src="https://img.shields.io/badge/Tailwind-3.4.15-38bdf8.svg?style=for-the-badge&logo=tailwindcss" alt="Tailwind Badge">
  <img src="https://img.shields.io/badge/Supabase-Cloud-3ecf8e.svg?style=for-the-badge&logo=supabase" alt="Supabase Badge">
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License Badge">
</p>

## What It Does

- Electron app with a React UI for voucher entry, review, and export.
- DOCX generation through Docxtemplater, with PDF output handled locally by Electron.
- Hotel rate lookup and voucher persistence backed by Supabase.
- Web/Docker mode for running the app with a standalone API bridge.

## Repository Layout

```text
├── electron/            # Electron main, preload, and shared runtime code
├── src/                 # React UI, domain logic, and browser bridge
├── templates/           # Controlled Word template guidance and source assets
├── supabase/            # Database schema and seed SQL
├── scripts/             # Local maintenance and sync scripts
├── build-resources/     # Generated runtime config and packaged assets
├── data/                # Local session storage and other machine-specific state
├── Dockerfile.api       # Standalone API container
├── Dockerfile.web       # Web container used for browser mode
├── docker-compose.yml   # Local container orchestration
└── package.json         # Scripts, dependencies, and Electron Builder config
```

## Getting Started

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Create your local `.env` from the example file and fill in the Supabase and API values:

   ```bash
   copy .env.example .env
   ```

   Required values:

   ```ini
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-public-key
   VOUCHER_API_PORT=5183
   ```

3. Generate the public runtime config used by Electron builds:

   ```bash
   npm run sync:public-config
   ```

   This writes `build-resources/config.json` from `.env` and keeps the generated file out of source control. Docker builds now generate the browser config inside the image using Compose build args, so the container path stays self-contained.

4. Start the local Electron workflow:

   ```bash
   npm run dev
   ```

5. Run the containerized web mode if you want the browser-facing deployment:

   ```bash
   docker compose up --build -d
   ```

   See [DOCKER.md](DOCKER.md) for the full container workflow.

## Useful Scripts

- `npm run lint` for ESLint.
- `npm run typecheck` for TypeScript validation.
- `npm run build` for production builds.
- `npm run dist` for packaged installers.
- `npm run dist:signed` for signed production packages.

## Template Customization

Voucher template guidance lives in [templates/README.md](templates/README.md). That file explains the supported Docxtemplater tags, the `lineItems` loop, and the conditional sections used by the generator.

## Database Setup

Database schema and seed files live in [supabase/schema.sql](supabase/schema.sql) and [supabase/seed.sql](supabase/seed.sql). Apply them from the Supabase SQL editor or your preferred migration flow.

## Generated Files

- `dist/` and `dist-electron/` are build outputs.
- `release/` contains packaged installers.
- `build-resources/config.json` is generated from `.env` and ignored by git.
- `data/` stores local machine state and should stay untracked.

<p align="center">
  Developed by <strong>Meridian Destination Management</strong>. Released under the [MIT License](LICENSE).
</p>

