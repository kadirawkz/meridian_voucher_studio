Public push checklist

1. Verify no tracked secrets
   - Ensure `.env` and `build-resources/config.json` are untracked:

     ```bash
     git ls-files --error-unmatch .env || echo ".env untracked"
     git ls-files --error-unmatch build-resources/config.json || echo "build-resources/config.json untracked"
     ```

   - If a secret file was accidentally committed, remove it from the index and commit:

     ```bash
     git rm --cached PATH/TO/SECRET_FILE
     git commit -m "Remove secret file from tracked files"
     ```

   - To purge a secret from history, use `git filter-repo` or BFG (manual, follow their docs).

2. Provide example config files
   - Add `.env.example` and `build-resources/config.example.json` (already present).

3. Build verification
   - Install deps and build locally to verify no build-time secrets are required:

     ```bash
     npm ci
     npm run build
     ```

4. Update README
   - Confirm README documents how to create `.env` from `.env.example` and how to configure Supabase.

5. Final push
   - Create a release branch or tag, then push to remote:

     ```bash
     git checkout -b release/public-ready
     git add .
     git commit -m "Prepare for public release: remove local secrets, add examples"
     git push origin release/public-ready
     ```

   - When ready to publish to `main` or `master`:

     ```bash
     git checkout main
     git merge --no-ff release/public-ready
     git tag -a vX.Y.Z -m "Release vX.Y.Z"
     git push origin main --tags
     ```

Notes

- This project writes `build-resources/config.json` from `.env` during the build (`scripts/sync-public-config.mjs`). Do not commit the generated `config.json` — it is ignored by `.gitignore`.
- If you need help purging secrets from history, I can prepare the `git filter-repo` commands for the specific files.
