# CI/CD and Deployment

## GitHub Actions (CI)

The repository uses **GitHub Actions** for continuous integration:

- **Workflow file**: [.github/workflows/ci.yml](../.github/workflows/ci.yml)
- **Triggers**: Push to `main`, and all pull requests targeting `main`
- **Steps**:
  1. Checkout code
  2. Setup Node.js 20 with npm cache
  3. `npm ci` — install dependencies
  4. `npm run lint` — Next.js ESLint
  5. `npm run typecheck` — TypeScript `tsc --noEmit`
  6. `npm run build` — Next.js production build (with placeholder env vars so build succeeds without secrets)

No deployment is performed by the workflow; it only validates that the project lint and build pass. Deployment is typically done by connecting the repo to a host (e.g. Vercel).

## Branch and PR workflow

- **main**: Default branch; should always be buildable and passing CI.
- **Feature work**: Create a branch (e.g. `feature/your-feature`), open a PR into `main`. CI runs on every push to the PR branch.
- **Templates**: New issues use [.github/ISSUE_TEMPLATE/](../.github/ISSUE_TEMPLATE/) (bug report, feature request). New PRs use [.github/PULL_REQUEST_TEMPLATE.md](../.github/PULL_REQUEST_TEMPLATE.md).

## Deploying the app (e.g. Vercel)

1. **Connect repo**: In Vercel, import the GitHub repository.
2. **Environment variables**: In the Vercel project settings, set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. **Build**: Vercel uses `npm run build` by default; no extra config needed for a standard Next.js app.
4. **Optional**: Enable “Automatically deploy on push to main” so every merge to `main` deploys.

Other hosts (Netlify, Railway, etc.) can be used similarly: point them at the repo and set the same env vars for the Next.js app.

## Self-hosting

For self-hosting, see the [Self-Hosting section in README](../README.md#self-hosting). Run migrations against your Supabase project and set the same environment variables where you run `next start` or your Node server.

---

*Last updated: March 2026*
