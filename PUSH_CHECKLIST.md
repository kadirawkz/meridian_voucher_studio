# Public Release & Push Checklist

Use this checklist to ensure all code, configurations, and assets are fully verified and cleaned of sensitive keys or environment variables before performing a public push or creating a production release.

---

## 🔒 Secret & Credential Safety

- [ ] **Verify Untracked Configurations**
      Ensure `.env` and `build-resources/config.json` are not tracked by version control:

  ```bash
  git ls-files --error-unmatch .env || echo ".env untracked"
  git ls-files --error-unmatch build-resources/config.json || echo "build-resources/config.json untracked"
  ```

- [ ] **Purge Accidental Staging**
      If a secret-bearing file was tracked by accident, remove it from the index:

  ```bash
  git rm --cached path/to/secret-file
  git commit -m "chore: remove credential configurations from tracking"
  ```

- [ ] **Provide Example Templates**
      Verify the repository has template-safe defaults for configuration reference:
  - `.env.example`
  - `config.public.example.json`

---

## 🛠️ Code Validation & Build Verification

- [ ] **Clean Dependency Verification**
      Perform a clean installation of dependencies:

  ```bash
  npm ci
  ```

- [ ] **Static Code Checks**
      Run linter, formatter, and compiler checks:

  ```bash
  npm run lint
  ```

  ```bash
  npm run typecheck
  ```

- [ ] **Local Build Compilations**
      Compile the production binaries and web distribution bundle locally to verify setup:
  ```bash
  npm run build
  ```

---

## 📚 Documentation Updates

- [ ] **Ensure Env Variable Reference**
      Verify that the `README.md` documents every required configuration variable and details how to establish connection strings.

- [ ] **Voucher Template Schemas**
      If any fields were added to the Document Generator, update the dictionary details inside `templates/README.md`.

---

## 🚀 Release Lifecycle Steps

- [ ] **Create a Clean Release Branch**

  ```bash
  git checkout -b release/vX.Y.Z
  git add .
  git commit -m "release: prepare distribution version vX.Y.Z"
  git push origin release/vX.Y.Z
  ```

- [ ] **Merge and Tag the Release**
  ```bash
  git checkout main
  git merge --no-ff release/vX.Y.Z
  git tag -a vX.Y.Z -m "Release version vX.Y.Z"
  git push origin main --tags
  ```

---

## 💡 Key Notes

> [!IMPORTANT]
>
> - `build-resources/config.json` is generated at build time from `.env` properties via `scripts/sync-public-config.mjs`. Do not force-commit this file.
> - If secrets were pushed to public remotes in the commit history, use `git-filter-repo` or BFG Repo-Cleaner to rewrite history before merging to the public remote branch.
