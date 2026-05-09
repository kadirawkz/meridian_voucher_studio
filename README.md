# Meridian Voucher Studio

Cross-platform Electron desktop software for a Destination Management Company to create controlled DOCX and PDF vouchers from one Word template.

## Stack

- Electron desktop shell with native Windows/macOS menus
- React + Tailwind renderer
- React Hook Form + Zod validation
- Node.js + Express local backend
- Docxtemplater for DOCX generation
- LibreOffice headless conversion for PDF generation
- Supabase for voucher persistence
- electron-builder for Windows/macOS installers

## Project Structure

```text
electron/
  main/                 Electron main process, native menus, Express API, document generation
  preload/              Secure IPC bridge exposed to the renderer
  shared/               Shared app contracts
src/
  domain/               Voucher schema and default values
  ui/                   React application
templates/              Controlled DOCX template location
supabase/               Database schema
```

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Add your Supabase credentials to `.env`. If LibreOffice is not in PATH, set `LIBREOFFICE_PATH` to the `soffice` executable.

## Template

Place the master template at `templates/voucher-template.docx`. See `templates/README.md` for the supported Docxtemplater tags.

## Database

Run `supabase/schema.sql` in Supabase SQL editor. In production, prefer authenticated employee access and avoid shipping a service-role key to employee machines. The current service layer supports development and should be connected to a proper auth/session flow before rollout.

## Build Installers

```bash
npm run dist
```

Installers are emitted to `release/`.

## Security Notes

- Renderer uses `contextIsolation`, disabled Node integration, sandboxing, and a narrow preload API.
- Express binds to `127.0.0.1`.
- Supabase persistence is isolated in the main/backend layer.
- Generated files are written to the user's Documents folder under `Meridian Voucher Studio`.

**Public Release Checklist**

- **Remove build artifacts:** Run `scripts/cleanup-release.ps1` and inspect the results.
- **Secrets:** Ensure no secrets or service keys exist in `.env` or `config.json`. Remove or replace with example files.
- **.gitignore:** Confirm `node_modules`, build outputs, and environment files are ignored.
- **Licensing:** Add a license (recommended: MIT) in `LICENSE`.
- **README:** Remove internal-only notes and add public usage and contribution guidance.
- **Personal data:** Verify `supabase/schema.sql` and other DB seeds contain no real user data.
- **Minimize release size:** Remove `release/`, `dist-electron/`, and large `locales` or binary assets before publishing.
- **History purge (optional):** If large binaries were previously committed, use `git filter-repo` or BFG to remove them from history.
- **Security audit:** Ensure electron `preload` surface is intentionally minimal and audited.
- **CI / Tests:** Add a basic CI (GitHub Actions) to run `npm test`, `npm run lint`, and `npm run build` on PRs.

**Public release steps**

- Create a release branch: `git checkout -b release/public`
- Run the cleanup script and commit changes.
- Add `LICENSE` and a short `CONTRIBUTING.md`.
- Review and remove any remaining secrets.
- Push and open a PR for review.

**Notes on removing history**

If you committed large artifacts (installers, compiled builds), they remain in git history. Use a history rewrite tool (BFG or `git filter-repo`) and follow these steps locally, then force-push the cleaned branch:

- Install `git-filter-repo` (recommended) or `bfg`.
- Example with `git filter-repo`:

```powershell
# make a backup clone
git clone --mirror <repo-url> repo-mirror.git
cd repo-mirror.git

# remove directories
git filter-repo --path release --path dist-electron --path build-resources --invert-paths

# push cleaned history
git push --force
```

- After history rewrite, notify collaborators to re-clone.

## Public Release Checklist

- Remove all build artifacts and packaged installers from the repository (these are large, platform-specific binaries): `release/`, `dist-electron/`, `build-resources/`, `dist/`, `out/`.
- Ensure no secrets or service-role keys are committed. Look for `.env`, `config.json` in the repo and remove or replace with examples.
- Keep `config.public.example.json` and `.env.example` (or create them) so users can configure runtime values without secrets.
- Add a license (`LICENSE`) appropriate for your project (e.g., MIT) and include contributor guidelines if needed.
- Add `.gitattributes` (already present) to normalize line endings and run `git add --renormalize .` if not done.
- Use `git rm -r --cached` to remove tracked large artifacts, then commit. To purge large files from history use tools such as BFG or `git filter-repo`.
- Verify `templates/voucher-template.docx` doesn't contain any real customer data — use a sanitized template for public repos.
- Update `README.md` (this file) to include build and privacy/security notes for public users.

### Quick commands to remove tracked artifacts (manual step)

```powershell
# Remove tracked copies and commit (run from repo root)
git rm -r --cached release dist-electron build-resources dist out
git commit -m "Remove packaged build artifacts"
# If files are very large and need history rewrite, use BFG or git filter-repo (manual step)
```

For convenience there is a safe cleanup script at `scripts/cleanup-release.ps1` that interactively deletes common build and release folders from the working copy. Use it locally, then run the git commands above to update the index.
