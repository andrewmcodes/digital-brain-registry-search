# Digital Brain Registry Search

A Raycast extension that searches package registries and generates Obsidian `software`-note frontmatter for the [digital-brain](https://github.com/andrewmcodes/digital-brain) vault. It's a port of the vault's `util/scripts/searchRegistry.js` Templater script — same field mappings, same YAML output — reworked into an interactive, search-as-you-type Raycast command.

## Supported registries

| Registry  | Source                        | `software_type` |
| --------- | ----------------------------- | --------------- |
| npm       | registry.npmjs.org            | `npm`           |
| RubyGems  | rubygems.org                  | `gem`           |
| GitHub    | api.github.com                | `CLI`           |
| Homebrew  | formulae.brew.sh              | `CLI`           |
| VS Code   | marketplace.visualstudio.com  | `extension`     |
| Obsidian  | obsidian-releases + GitHub    | `extension`     |

Field mappings follow `pages/CROSSWALK.md` in the vault.

## Command

**Search Registry** — pick a registry from the dropdown, type a query, and browse live results. Selecting a result resolves its full details and shows the generated YAML frontmatter, with actions to:

- **Copy Frontmatter** (`⌘C`) — copy the YAML to the clipboard.
- **Create Note in Vault** (`⌘N`) — write `{softwareFolder}/{id}.md` into your vault (skips if it already exists).
- **Open Homepage / GitHub** (`⌘O` / `⌘⇧O`).

## Preferences

| Preference        | Description                                                         |
| ----------------- | ------------------------------------------------------------------- |
| Vault Path        | Absolute path to your Obsidian vault root (required to create notes). |
| Software Folder   | Folder within the vault for software notes (default `software`).    |
| GitHub Token      | Optional PAT to raise GitHub's unauthenticated rate limit (60/hr).  |

## Development

```bash
npm install
npm run dev      # ray develop — loads the extension into Raycast
npm run build    # ray build
npm run lint     # ray lint
```

The extension icon is generated from `assets/generate-icon.js` (`node assets/generate-icon.js`).
