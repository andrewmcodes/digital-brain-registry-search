/**
 * Write software notes into the Obsidian vault on disk.
 *
 * Mirrors `createSoftwareNote` from the vault's `searchRegistry.js`, but writes
 * through the Node filesystem since Raycast runs outside Obsidian.
 */

import { mkdir, writeFile, access } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { frontmatterToYAML, sanitizeFilename, type SoftwareFrontmatter } from "./frontmatter";

function expandPath(path: string): string {
  const expanded = path.startsWith("~") ? join(homedir(), path.slice(1)) : path;
  return resolve(expanded);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export interface CreateNoteResult {
  created: boolean;
  filePath: string;
  message: string;
}

export async function createSoftwareNote(
  fm: SoftwareFrontmatter,
  vaultPath: string,
  softwareFolder: string,
): Promise<CreateNoteResult> {
  const folder = join(expandPath(vaultPath), softwareFolder || "software");
  const fileName = `${sanitizeFilename(fm.id)}.md`;
  const filePath = join(folder, fileName);

  if (await exists(filePath)) {
    return { created: false, filePath, message: `Note already exists: ${filePath}` };
  }

  await mkdir(folder, { recursive: true });
  await writeFile(filePath, `${frontmatterToYAML(fm)}\n\n`, "utf8");

  return { created: true, filePath, message: `Created ${fileName}` };
}
