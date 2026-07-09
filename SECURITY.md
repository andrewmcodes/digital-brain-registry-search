# Security Policy

## Reporting a Vulnerability

If you discover a security issue, please report it privately using GitHub's [security advisories](https://github.com/andrewmcodes/digital-brain-registry-search/security/advisories/new) rather than opening a public issue. You can expect an initial response within a few days.

## Scope

This extension talks to public package-registry APIs and writes Markdown files to a local Obsidian vault path you configure. It stores no credentials beyond an optional GitHub token, which is kept in Raycast's encrypted preferences and never written to disk by this extension. Note creation only writes within the vault folder you specify in preferences.
