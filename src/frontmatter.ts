/**
 * Software-note frontmatter shape and formatting helpers.
 *
 * Ported from `util/scripts/searchRegistry.js` in the digital-brain vault and
 * kept in sync with `pages/CROSSWALK.md`. The object maps to the `software`
 * type in `_meta/schema.json`, plus `aliases` to preserve each registry's
 * canonical identifier.
 */

export interface SoftwareFrontmatter {
  type: "software";
  software_type: "app" | "CLI" | "extension" | "gem" | "npm";
  id: string;
  aliases: string[];
  description: string;
  author: string[];
  source_url: string;
  github_url: string;
  image_url: string;
  platform: string[];
  dependencies: string[];
  tags: string[];
}

/** Normalize various GitHub URL formats to a consistent `https://github.com/owner/repo`. */
export function normalizeGitHubUrl(url: string | undefined | null): string {
  if (!url) return "";

  const gitMatch = url.match(/github\.com[:/]([^/]+\/[^/.]+)/);
  if (gitMatch) {
    return `https://github.com/${gitMatch[1].replace(/\.git$/, "")}`;
  }

  return url.replace(/\.git$/, "").replace(/^git\+/, "");
}

/** Format a value as an Obsidian wikilink. */
export function formatWikilink(value: string | undefined | null): string {
  if (!value) return "";
  return `[[${value}]]`;
}

/** Ensure an array contains only truthy string values. */
export function formatArray(arr: unknown): string[] {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return [];
  return arr.map((item) => (item ? String(item) : "")).filter(Boolean);
}

/** Replace characters invalid in filenames with `-`. */
export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "-");
}

/** Convert a frontmatter object to a YAML string (matches the vault script output). */
export function frontmatterToYAML(fm: SoftwareFrontmatter): string {
  const lines: string[] = ["---"];

  for (const [key, value] of Object.entries(fm)) {
    if (value === "" || value === null || value === undefined) {
      lines.push(`${key}:`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        value.forEach((item) => lines.push(`  - ${item}`));
      }
    } else {
      const escaped = String(value).replace(/"/g, '\\"');
      lines.push(`${key}: "${escaped}"`);
    }
  }

  lines.push("---");
  return lines.join("\n");
}
