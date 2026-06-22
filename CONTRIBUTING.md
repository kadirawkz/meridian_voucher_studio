# Contributing to Meridian Voucher Studio

First off, thank you for taking the time to contribute! Contributions are what make the open-source community such an amazing place to learn, inspire, and create.

Please read through this guide to understand our development workflow, coding standards, and repository guidelines.

---

## 🛠️ Code Quality & Standards

To maintain a clean and consistent codebase, we enforce strict linting, formatting, and type-checking rules.

### 1. Linting & Formatting
We use **ESLint** for static analysis and **Prettier** for code formatting. Before proposing any changes, verify that your code adheres to our style guidelines:

- **Run Linting**: Checks for code quality issues.
  ```bash
  npm run lint
  ```
- **Format Code**: Automatically formats files to comply with style rules.
  ```bash
  npm run format
  ```

### 2. Static Type Verification
All source files are written in **TypeScript**. Make sure there are no compiler errors:
```bash
npm run typecheck
```

---

## 🌿 Git Development Workflow

To ensure smooth collaboration, we follow a feature-branch workflow.

### 1. Branch Naming Conventions
Create descriptive branch names prefixed with the type of work being performed:
- `feature/short-description` (for new features)
- `bugfix/short-description` (for bug fixes)
- `docs/short-description` (for documentation updates)
- `refactor/short-description` (for code restructuring)

Example:
```bash
git checkout -b feature/dynamic-invoice-rates
```

### 2. Local Verification
Before committing code, verify the local builds run perfectly. Follow the build sequence:
```bash
# Verify clean install
npm ci

# Compile and verify assets
npm run build
```

### 3. Commit Guidelines
- Write clear, concise commit messages.
- Keep commits atomic (one logical change per commit).
- **CRITICAL**: Never commit credentials, private keys, or `.env` files. Check your staged changes before committing.

---

## ✉️ Pull Request Guidelines

When you are ready to submit your changes:

1. **Push your branch** to your fork or origin:
   ```bash
   git push origin feature/dynamic-invoice-rates
   ```
2. **Open a Pull Request (PR)** against the `main` branch.
3. **Describe your changes** in detail within the PR description:
   - What problem does this solve?
   - What approach was taken?
   - How can this be manually tested?
4. **Ensure CI passes**: Your PR should compile, typecheck, lint, and format without errors.

---

## 🔒 Security Best Practices

If you discover a security vulnerability, please do **not** open a public issue. Instead, report it privately to the maintainers to coordinate a patch and release.
Always check files using our [PUSH_CHECKLIST.md](file:///d:/repos/meridian_voucher_studio/PUSH_CHECKLIST.md) before publishing changes.
