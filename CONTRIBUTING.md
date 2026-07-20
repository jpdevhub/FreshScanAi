# Contributing to FreshScan AI

Thank you for your interest in contributing.

> [!CAUTION]
> **Security issues must NOT be reported here.** Read [SECURITY.md](SECURITY.md) and email the maintainer privately instead.

---

## Table of Contents

- [Before You Start](#before-you-start)
- [Understanding the Codebase](#understanding-the-codebase)
- [Branch Naming](#branch-naming)
- [Commit Message Conventions](#commit-message-conventions)
- [Pull Request Requirements](#pull-request-requirements)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)
- [What Will Be Rejected](#what-will-be-rejected)
- [Review Timeline](#review-timeline)
- [Issue Labels](#issue-labels)

---

## Before You Start

1. Set up your local environment fully by following [README.md](README.md). If your environment is not running correctly, do not open a PR.
2. Search open issues and open PRs before starting work. Duplicate work will be closed.
3. For any change that is **not** a clear bug fix or a `good first issue` task, **open an issue first** and get explicit approval from a maintainer before writing code. PRs submitted without prior discussion on non-trivial changes will be closed.
4. Do not begin working on an issue until it is assigned to you. Comment to request assignment; do not self-assign.

---

## Understanding the Codebase

Read [DOCUMENTATION.md](DOCUMENTATION.md) before touching any of the following areas. A PR that contradicts the documented architecture will be rejected regardless of code quality.

| Area | Entry point | What to understand first |
|------|-------------|--------------------------|
| AI inference pipeline | `backend/inference.py`, `backend/fusion.py` | Dual-stream architecture (Stream A + Stream B), temperature scaling, fusion formula |
| Scan endpoints | `backend/main.py` → `/api/v1/scan`, `/api/v1/scan-auto` | Demo mode vs. real inference path, image routing via `router.py` |
| Frontend scan flow | `src/pages/ScannerPage.tsx` | `ScanPhase` state machine: `idle → capturing → processing → done/error` |
| Analysis display | `src/pages/AnalysisDashboard.tsx` | Score loading priority: `?id=` param → sessionStorage → latest scan |
| API client | `src/lib/api.ts` | All backend calls go through this single wrapper |
| Design system | `src/index.css` | Color tokens, typography, utility classes — do not introduce inline styles |
| Database schema | `backend/migrations/` | All schema changes require a new migration file |

---

## Branch Naming

Branches must follow this exact pattern. PRs from branches that do not match will not be reviewed.

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/<short-description>` | `feat/scan-history-export` |
| Bug fix | `fix/<short-description>` | `fix/map-marker-overlap` |
| Documentation | `docs/<short-description>` | `docs/update-setup-guide` |
| Refactor | `refactor/<short-description>` | `refactor/inference-pipeline` |
| Tests | `test/<short-description>` | `test/auth-endpoint-coverage` |
| Chore | `chore/<short-description>` | `chore/update-fastapi` |

Rules:
- Use lowercase letters and hyphens only. No underscores, no slashes within the description.
- Keep the description under 40 characters.
- Never push directly to `main` or `dev`. Force pushes to `main` are disabled.

---

## Commit Message Conventions

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification exactly.

```text
<type>(<scope>): <summary>
```

**Allowed types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Scopes map to the codebase:**

| Scope | What it covers |
|-------|---------------|
| `scanner` | `ScannerPage.tsx`, camera/upload logic |
| `dashboard` | `AnalysisDashboard.tsx` |
| `map` | `MarketMapPage.tsx`, Leaflet layer |
| `auth` | `auth.py`, `AuthPage.tsx`, OAuth flow |
| `inference` | `inference.py`, `fusion.py`, `router.py` |
| `api` | `main.py` endpoints |
| `db` | `backend/migrations/`, schema changes |
| `ci` | `.github/workflows/` |
| `deps` | Dependency updates |

**Rules:**
- Use the imperative mood: `add`, `fix`, `remove` — not `added`, `fixed`, `removed`.
- Keep the summary line under 72 characters.
- Do not end the summary line with a period.
- Do not write vague summaries (`update files`, `fix stuff`, `changes`). These commits will be asked to be reworded before the PR is reviewed.

**Examples:**

```text
feat(scanner): add live confidence threshold display
fix(auth): handle OAuth redirect loop on mobile Safari
test(inference): add unit tests for temperature scaling edge cases
chore(deps): upgrade fastapi to 0.115
```

---

## Pull Request Requirements

Every PR must pass **all** of the following before a review will begin. The CI pipeline (`ci.yml` and `check-linked-issue.yml`) enforces the automated checks automatically on every PR opened against `main`.

### Automated gates (must be green)

| Check | Command | Failure means |
|-------|---------|---------------|
| Linked issue check | Automated (CI) | PR description does not link to a GitHub issue (e.g., `Closes #123`) |
| Frontend lint | `npm run lint` | ESLint errors in TypeScript/React code |
| Frontend build | `npm run build` | TypeScript compile error or Vite build failure |
| Backend lint | `ruff check . --config ruff.toml` | PEP 8 / style violations in Python code |
| Backend tests | `python -m pytest tests/test_ci.py -v` | Regression in a CI-covered endpoint |

Do not open a PR if any of these are failing locally. Fix them first.

### Manual requirements (checked during review)

- [ ] Branch is up to date with `main` — rebase, do not merge
- [ ] PR description links to a GitHub issue (e.g., `Closes #123`)
- [ ] No `.env` or `.env.local` files, credentials, secrets, or API keys are present anywhere in the diff
- [ ] No model weight files (`.pth`, `.pt`, `.onnx`, `.bin`) are committed
- [ ] No `__pycache__/` directories, `.pyc` files, or macOS `._*` metadata files are committed
- [ ] New endpoints include corresponding tests in `backend/tests/` or `backend/test_*.py`
- [ ] New utility functions in the frontend include a test file (Vitest)
- [ ] UI changes include before/after screenshots in the PR description
- [ ] Schema changes include a new migration file under `backend/migrations/`

### PR description template

Use the template that loads automatically from `.github/PULL_REQUEST_TEMPLATE.md`. Every section must be filled in. Placeholder text left in the description ("What does this PR do?", "Why is this change needed?") means the PR is not ready for review and it will be marked as **Draft** until it is.

---

## Code Standards

### Python / FastAPI

- Type-annotate every function signature. Unannotated functions will not be merged.
- Keep route handlers thin. Business logic belongs in dedicated modules (`inference.py`, `fusion.py`, `router.py`, `auth.py`), not in `main.py` route bodies.
- All secrets and configuration must come from environment variables via `os.environ.get(...)`. No hardcoded fallback values for credentials.
- Follow the existing pattern for error handling: raise `HTTPException` with a precise `status_code` and `detail`. Do not swallow exceptions silently.
- Do not add a dependency to `requirements.txt` without a prior issue discussion. Add a comment next to it explaining why it is needed.
- Run `ruff check . --config ruff.toml` before pushing. Ruff is enforced in CI.

### TypeScript / React

- Strict TypeScript mode is enabled in `tsconfig.app.json`. No `any` types without an explicit `// eslint-disable` comment that explains why.
- Use functional components and hooks only. Class components will not be accepted.
- Components go in `src/components/`. Pages go in `src/pages/`. Do not create new top-level directories without maintainer approval.
- All backend calls must go through `src/lib/api.ts`. Do not call `fetch()` directly from a component.
- Use the existing CSS design tokens defined in `src/index.css`. Do not introduce arbitrary color values, font sizes, or spacing that are not part of the design system.
- Do not add a new npm dependency without a prior issue discussion and maintainer approval.

### General

- Do not commit generated files, build artifacts (`dist/`), or editor configuration (`.vscode/`, `.idea/`) except for files already tracked.
- Do not modify `vercel.json`, `Dockerfile`, or `backend/startup.sh` without explicit maintainer approval — these affect production deployments.

---

## Testing Requirements

### Backend

```bash
cd backend
python -m pytest tests/test_ci.py -v
```

- All new API endpoints must have at least one test in `backend/tests/` or as a new `test_*.py` file.
- All new inference or fusion logic must have unit tests covering the normal path and at least one edge case (e.g., zero confidence, boundary score values).
- Tests must pass with `DEV_BYPASS_AUTH=false`. Do not write tests that only work in bypass mode.

### Frontend

Vitest is configured. There are currently no component tests; if you add a utility function or a custom hook, include a co-located `.test.ts` or `.test.tsx` file.

---

## What Will Be Rejected

PRs will be closed without review if they:

- Are submitted without a prior issue or maintainer approval for non-trivial changes
- Fail any automated CI gate
- Contain `.env` or `.env.local` files, secrets, model weights, or binary artifacts
- Touch the deployment configuration (`vercel.json`, `Dockerfile`, `startup.sh`) without approval
- Introduce a new dependency (npm or PyPI) without prior discussion
- Rewrite existing, working logic without a documented reason
- Have vague commit messages (`fix`, `update`, `wip`, `changes`)
- Do not include tests for new logic
- Leave placeholder text in the PR description template
- Add UI that deviates from the design system tokens in `src/index.css`

---

## Review Timeline

| Action | Target |
|--------|--------|
| Assignment confirmation on issues | Within **24 hours** |
| First review on submitted PR | Within **48 hours** |
| Re-review after requested changes | Within **48 hours** |

If you have not received a response after 48 hours, tag the maintainer (`@jpdevhub`) in a comment.

---

## Issue Labels

| Label | When to use |
|-------|-------------|
| `good first issue` | Self-contained tasks with clear acceptance criteria, no deep codebase knowledge required |
| `bug` | A confirmed deviation from documented behavior |
| `feature` | A new capability not yet described in the roadmap |
| `help wanted` | Maintainer is actively seeking external input |
| `documentation` | Changes or additions to docs only |
| `needs-discussion` | Opened issue requires design or architecture discussion before work can begin |

When opening an issue, apply the most relevant label and provide enough detail for a contributor to start work without asking for clarification. Vague issues will be closed with a request for more information.

---

## Contact

| Channel | Handle / Address |
|---------|-----------------|
| Discord | `Razen04` |
| Email (non-security) | karanrathore23@zohomail.in |
| Security issues | See [SECURITY.md](SECURITY.md) |
