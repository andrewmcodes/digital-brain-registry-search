# Contributing

Thanks for your interest in improving Digital Brain Registry Search! This is a personal Raycast extension for the [digital-brain](https://github.com/andrewmcodes/digital-brain) vault, but issues and pull requests are welcome.

## Getting started

```bash
git clone https://github.com/andrewmcodes/digital-brain-registry-search.git
cd digital-brain-registry-search
npm install
npm run dev      # loads the extension into Raycast with hot reload
```

You'll need [Raycast](https://raycast.com) installed and Node 22+.

## Project layout

| Path                       | Purpose                                                        |
| -------------------------- | -------------------------------------------------------------- |
| `src/search-registry.tsx`  | The Raycast command UI (list, dropdown, detail, actions).      |
| `src/registries.ts`        | Per-registry `search()` + `detail()` logic and field mappings. |
| `src/frontmatter.ts`       | Frontmatter shape and YAML/wikilink formatting helpers.        |
| `src/vault.ts`             | Writes software notes to disk.                                 |
| `assets/generate-icon.js`  | Regenerates the extension icon.                                |

Field mappings mirror `pages/CROSSWALK.md` in the vault — keep the two in sync when changing a registry.

## Before opening a PR

Run all three and make sure they pass:

```bash
npm run build    # ray build
npm run lint     # ray lint
npm run fix-lint # ray lint --fix (to auto-fix formatting)
```

To add a new registry, implement the `Registry` interface in `src/registries.ts`, add it to the `REGISTRIES` array, and document its crosswalk.

## Commit style

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`). Add a line to `CHANGELOG.md` for user-facing changes.
