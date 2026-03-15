# Branch Protection & Repository Setup

This guide walks you through configuring branch protection rules and other GitHub settings to keep `main` safe and enforce quality on every pull request.

## Branch Protection Rules

Go to **Settings → Branches → Add branch protection rule** and apply these settings for the `main` branch:

### Required Settings

| Setting | Value | Why |
|---------|-------|-----|
| **Branch name pattern** | `main` | Protects the default branch |
| **Require a pull request before merging** | ✅ | No direct pushes to `main` |
| **Require approvals** | ✅ (1 approval minimum) | Every change is peer-reviewed |
| **Dismiss stale pull request approvals when new commits are pushed** | ✅ | Re-review after changes |
| **Require status checks to pass before merging** | ✅ | CI must be green |
| **Status checks that are required** | `lint-and-build` | The CI job name from `.github/workflows/ci.yml` |
| **Require branches to be up to date before merging** | ✅ | Prevent merge conflicts |
| **Require conversation resolution before merging** | ✅ | All review comments addressed |

### Recommended Settings

| Setting | Value | Why |
|---------|-------|-----|
| **Require signed commits** | Optional | Extra verification for contributors |
| **Include administrators** | ✅ | Even admins follow the rules |
| **Restrict who can push to matching branches** | Optional | Limit direct push access |
| **Allow force pushes** | ❌ | Never force push to `main` |
| **Allow deletions** | ❌ | Never delete `main` |

## CODEOWNERS

The `.github/CODEOWNERS` file automatically requests reviews from the right people when a PR touches specific files. This is already configured — see [CODEOWNERS](../.github/CODEOWNERS).

## Required Status Checks

The CI workflow (`.github/workflows/ci.yml`) runs these checks on every PR:

1. **npm audit** — dependency vulnerability scan (non-blocking)
2. **npm run lint** — ESLint code quality
3. **npm run typecheck** — TypeScript type checking
4. **npm run build** — Next.js production build

The job name `lint-and-build` must be added as a required status check in branch protection settings.

## Branch Naming Convention

Use descriptive branch names:

```
feature/add-agent-search    — new features
fix/rate-limit-bypass       — bug fixes
docs/update-api-reference   — documentation
chore/update-dependencies   — maintenance
refactor/simplify-auth      — code improvements
```

## Dependabot

Dependabot is configured (`.github/dependabot.yml`) to:
- Check npm dependencies weekly
- Check GitHub Actions versions weekly
- Auto-label PRs with `dependencies`
- Limit to 5 open PRs at a time

## Stale Management

The stale bot (`.github/workflows/stale.yml`) automatically:
- Marks issues as stale after 60 days of inactivity
- Closes stale issues after 14 more days
- Marks PRs as stale after 30 days of inactivity
- Closes stale PRs after 7 more days
- Exempts issues labeled `pinned`, `security`, or `good-first-issue`

## Releases

To create a new release:
1. Go to **Actions → Release → Run workflow**
2. Enter the version (e.g. `v0.2.0`) following [semver](https://semver.org/)
3. The workflow creates a git tag and GitHub Release with auto-generated changelog

## Recommended GitHub Settings

Under **Settings → General**:
- **Features**: Enable Issues and Discussions
- **Pull Requests**: Allow squash merging (default), disable merge commits for a clean history
- **Danger Zone**: Keep the repo public once you're ready

Under **Settings → Actions → General**:
- **Fork pull request workflows**: Require approval for first-time contributors
