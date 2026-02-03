# FORK_NOTE

## 2026-02-03 Rebase prep (upstream/master)

Upstream range: `master..upstream/master` (11 commits, tip `8584a78`).

Upstream highlights:
- Switch to pnpm, update dependencies; CI uses pnpm; add `flake.nix`/`flake.lock`.
- Format codebase to two-space indentation (broad formatting changes).
- Fix dev/prod build to use vault path; fix missing `requestSort` error.
- Fix strict filters not persisting after rename.
- Add front matter filters for pinning/hiding, plus activation modal filter.
- Version bumps for v1.3.0/v1.3.1; update release workflow, manifest, versions.

Fork range: `upstream/master..master` (11 commits, includes merges).

Fork highlights (StrayDragon):
- Add focus mode feature (Focus Files/Dirs) + toolbar control; fix focus mode middle dir bug.
- Add visible toggle button for hidden files in file explorer.
- Fix menu grouping.
- Migrate to pnpm & cleanup (overlaps with upstream migration).
- Version bumps.

Expected conflict areas (touched by both):
- `src/main.ts`, `src/settings.ts`, `src/handlers.ts`, `src/utils.ts`
- `src/ui/toolbar.ts`, `src/ui/modals.ts`, `src/ui/suggest.ts`, `src/main.scss`
- `manifest.json`, `versions.json`, `package.json`, `pnpm-lock.yaml`,
  `esbuild.config.mjs`, `tsconfig.json`, `.github/workflows/release.yml`,
  `.prettierrc`, `.gitignore`, `.envrc`, `README.md`, `flake.nix`, `flake.lock`

## 2026-02-03 Rebase result summary

- Rebasing onto `upstream/master` completed; upstream formatting and pnpm tooling kept.
- Preserved fork features: hidden-files toolbar toggle, focus mode (including middle-dir fix), and grouped menu items.
- Merged upstream front matter filters with focus mode logic in `src/main.ts`/`src/utils.ts`.
- Release workflow keeps upstream artifact list; build scripts remain upstream (no output dir packaging).
- Fork versioning kept as date-based, current version `2025.2.14` with history in `versions.json`.
