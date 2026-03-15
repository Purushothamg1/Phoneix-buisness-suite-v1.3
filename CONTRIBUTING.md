# Contributing to Phoneix Business Suite

Thank you for your interest in contributing! This document explains how to get involved.

## Development Setup

See [SETUP.md](SETUP.md) for full local development instructions.

## Branching Strategy

```
main          ← production-ready, protected
develop       ← integration branch
feature/*     ← new features (branch from develop)
fix/*         ← bug fixes
chore/*       ← maintenance, deps, tooling
```

## Pull Request Process

1. Branch from `develop` (not `main`)
2. Keep PRs focused — one feature or fix per PR
3. All tests must pass: `cd backend && npm test`
4. Frontend must build: `cd frontend && npm run build`
5. Update SETUP.md if you add new env vars or setup steps
6. Squash commits before merging

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | When |
|--------|------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `test:` | Adding or updating tests |
| `chore:` | Build, deps, tooling |
| `refactor:` | Code change that is neither feat nor fix |
| `perf:` | Performance improvement |

Examples:
```
feat(invoices): add automatic PDF generation on create
fix(payments): prevent double-refund on same payment
test(auth): add change-password coverage
docs: update API reference table
```

## Code Standards

- **TypeScript strict mode** must pass with zero errors
- **All API routes** must have corresponding Jest tests
- **All new endpoints** must apply `authenticate` + `authorize` middleware
- **No `any` types** unless absolutely unavoidable (add a comment explaining why)
- **Error handling** — use `AppError` subclasses, never `res.status(500).json(...)` directly
- **Pagination** — all list endpoints must use `getPaginationParams` + `buildPaginatedResult`

## Adding a New Module

1. Create `backend/src/modules/<name>/`:
   - `<name>.routes.ts`
   - `<name>.service.ts`
   - `<name>.controller.ts` (if complex)
2. Register the router in `backend/src/app.ts`
3. Add Prisma model to `backend/prisma/schema.prisma`
4. Create migration: `npx prisma migrate dev --name add_<name>`
5. Add tests in `backend/tests/api/<name>.test.ts`
6. Add frontend page in `frontend/src/app/<name>/page.tsx`
7. Add nav item in `frontend/src/components/layout/Sidebar.tsx`

## Reporting Bugs

Open a GitHub Issue with:
- Phoneix version
- Node.js version
- Steps to reproduce
- Expected vs actual behaviour
- Relevant logs or screenshots

## Feature Requests

Open a GitHub Issue with the `enhancement` label. Describe:
- The problem you're solving
- Your proposed solution
- Any alternatives you've considered
