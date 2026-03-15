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

### Merging Copilot-assisted PRs (Important for Solo Repos)

GitHub will **not** count your approval on a PR if you co-authored it with a coding agent (e.g. GitHub Copilot). This means you cannot merge your own Copilot-assisted PRs when "Require approvals" is enabled.

#### Fix: Use a Ruleset instead of legacy Branch Protection

GitHub **Rulesets** (the newer system) support bypass actors on all plans, including free personal repos. Legacy branch protection rules do **not** have this option for personal accounts.

**Step 1 — Delete the legacy branch protection rule:**

1. Go to **Settings → Branches**
2. Next to the `main` rule, click **Delete** (the trash icon)
3. Confirm deletion

**Step 2 — Create a Ruleset with bypass:**

1. Go to **Settings → Rules → Rulesets**
2. Click **New ruleset → New branch ruleset**
3. **Ruleset name**: `main-protection`
4. **Enforcement status**: Active
5. Under **Bypass list**, click **+ Add bypass** → select **Repository admin** → this allows you (`@mian-abd`) to bypass all rules
6. Under **Target branches**, click **Add target** → select **Default branch** (this targets `main`)
7. Enable these rules:
   - ✅ **Require a pull request before merging** → set required approvals to `1`
   - ✅ **Require status checks to pass** → add `lint-and-build` as a required check
   - ✅ **Block force pushes**
   - ✅ **Require conversation resolution before merging** (optional)
8. Click **Create**

> **Why Rulesets?** Rulesets are GitHub's replacement for legacy branch protection. They support bypass actors on free personal repos, which legacy rules do not. With the bypass, you can merge Copilot-assisted PRs without needing a second reviewer.

#### Alternative Quick Fix (if Rulesets feel complex)

If you just want to merge **right now**, you can temporarily relax the legacy rule:

1. Go to **Settings → Branches → edit the `main` protection rule**
2. **Uncheck** "Require approvals" (keep all other settings)
3. Save → merge your PR → re-enable "Require approvals" after

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
