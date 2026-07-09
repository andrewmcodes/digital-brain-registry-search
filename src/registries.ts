/**
 * Registry search + detail lookups.
 *
 * Each registry exposes a `search(query)` used to populate the Raycast list and
 * a `detail(id)` that returns fully-mapped software frontmatter for the chosen
 * result. The field mappings mirror `pages/CROSSWALK.md` and the original
 * `util/scripts/searchRegistry.js`.
 */

import {
  formatArray,
  formatWikilink,
  normalizeGitHubUrl,
  type SoftwareFrontmatter,
} from "./frontmatter";

export interface SearchResult {
  /** Registry-native identifier passed back to `detail()`. */
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
}

export interface RegistryContext {
  githubToken?: string;
}

export interface Registry {
  id: string;
  title: string;
  /** Placeholder shown in the search bar for this registry. */
  placeholder: string;
  search(query: string, ctx: RegistryContext): Promise<SearchResult[]>;
  detail(id: string, ctx: RegistryContext): Promise<SoftwareFrontmatter | null>;
}

const USER_AGENT = "digital-brain-registry-search (Raycast)";

function githubHeaders(ctx: RegistryContext): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": USER_AGENT,
  };
  if (ctx.githubToken) headers.Authorization = `Bearer ${ctx.githubToken}`;
  return headers;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const response = await fetch(url, init);
  if (!response.ok) return null;
  return (await response.json()) as T;
}

/* ------------------------------------------------------------------ NPM */

const npm: Registry = {
  id: "npm",
  title: "npm",
  placeholder: "Search npm packages…",
  async search(query) {
    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=20`;
    const data = await getJson<{
      objects?: Array<{
        package: {
          name: string;
          description?: string;
          version?: string;
          publisher?: { username?: string };
        };
      }>;
    }>(url);
    if (!data?.objects) return [];
    return data.objects.map((o) => ({
      id: o.package.name,
      name: o.package.name,
      description: o.package.description ?? "",
      author: o.package.publisher?.username ?? "",
      version: o.package.version ?? "",
    }));
  },
  async detail(packageName) {
    const data = await getJson<{
      name?: string;
      description?: string;
      homepage?: string;
      author?: { name?: string };
      repository?: { url?: string } | string;
      keywords?: string[];
      "dist-tags"?: { latest?: string };
      versions?: Record<
        string,
        {
          description?: string;
          homepage?: string;
          author?: { name?: string };
          repository?: { url?: string } | string;
          keywords?: string[];
          dependencies?: Record<string, string>;
        }
      >;
    }>(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`);
    if (!data) return null;

    const latestVersion = data["dist-tags"]?.latest ?? Object.keys(data.versions ?? {}).pop();
    const versionData = latestVersion ? (data.versions?.[latestVersion] ?? {}) : {};

    const authorName = data.author?.name || versionData.author?.name || "";
    const repoField = data.repository ?? versionData.repository ?? "";
    const repository = typeof repoField === "string" ? repoField : (repoField?.url ?? "");

    return {
      type: "software",
      software_type: "npm",
      id: data.name || packageName,
      aliases: [],
      description: data.description || versionData.description || "",
      author: authorName ? [formatWikilink(authorName)] : [],
      source_url:
        data.homepage ||
        versionData.homepage ||
        `https://www.npmjs.com/package/${data.name || packageName}`,
      github_url: normalizeGitHubUrl(repository),
      image_url: "",
      platform: [],
      dependencies: formatArray(Object.keys(versionData.dependencies ?? {})).map(formatWikilink),
      tags: formatArray(data.keywords ?? versionData.keywords ?? []),
    };
  },
};

/* ------------------------------------------------------------- RubyGems */

const gem: Registry = {
  id: "gem",
  title: "RubyGems",
  placeholder: "Search Ruby gems…",
  async search(query) {
    const data = await getJson<
      Array<{ name: string; info?: string; authors?: string; version?: string }>
    >(`https://rubygems.org/api/v1/search.json?query=${encodeURIComponent(query)}`);
    if (!Array.isArray(data)) return [];
    return data.map((g) => ({
      id: g.name,
      name: g.name,
      description: g.info ?? "",
      author: g.authors ?? "",
      version: g.version ?? "",
    }));
  },
  async detail(gemName) {
    const [data, versionsData] = await Promise.all([
      getJson<{
        name?: string;
        info?: string;
        authors?: string | string[];
        homepage_uri?: string;
        project_uri?: string;
        source_code_uri?: string;
      }>(`https://rubygems.org/api/v1/gems/${encodeURIComponent(gemName)}.json`),
      getJson<{ dependencies?: { runtime?: Array<{ name: string }> } }>(
        `https://rubygems.org/api/v1/versions/${encodeURIComponent(gemName)}/latest.json`,
      ).catch(() => null),
    ]);
    if (!data) return null;

    let authors: string[] = [];
    if (data.authors) {
      if (typeof data.authors === "string") {
        authors = data.authors.split(",").map((a) => a.trim());
      } else if (Array.isArray(data.authors)) {
        authors = data.authors;
      }
    }

    const dependencies = versionsData?.dependencies?.runtime ?? [];

    return {
      type: "software",
      software_type: "gem",
      id: data.name || gemName,
      aliases: [],
      description: data.info || "",
      author: authors.map(formatWikilink),
      source_url:
        data.homepage_uri ||
        data.project_uri ||
        `https://rubygems.org/gems/${data.name || gemName}`,
      github_url: normalizeGitHubUrl(data.source_code_uri ?? ""),
      image_url: "",
      platform: [formatWikilink("Ruby")],
      dependencies: formatArray(dependencies.map((d) => d.name)).map(formatWikilink),
      tags: [],
    };
  },
};

/* --------------------------------------------------------------- GitHub */

const github: Registry = {
  id: "github",
  title: "GitHub",
  placeholder: "Search GitHub repositories…",
  async search(query, ctx) {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=20`;
    const data = await getJson<{
      items?: Array<{
        full_name: string;
        description?: string;
        owner?: { login?: string };
      }>;
    }>(url, { headers: githubHeaders(ctx) });
    if (!data?.items) return [];
    return data.items.map((r) => ({
      id: r.full_name,
      name: r.full_name,
      description: r.description ?? "",
      author: r.owner?.login ?? "",
      version: "",
    }));
  },
  async detail(repoName, ctx) {
    const data = await getJson<{
      name?: string;
      description?: string;
      homepage?: string;
      html_url?: string;
      owner?: { login?: string; avatar_url?: string };
      topics?: string[];
    }>(`https://api.github.com/repos/${repoName}`, { headers: githubHeaders(ctx) });
    if (!data) return null;

    return {
      type: "software",
      software_type: "CLI",
      id: data.name || repoName.split("/").pop() || repoName,
      aliases: [],
      description: data.description || "",
      author: data.owner?.login ? [formatWikilink(data.owner.login)] : [],
      source_url: data.homepage || data.html_url || "",
      github_url: normalizeGitHubUrl(data.html_url ?? ""),
      image_url: data.owner?.avatar_url || "",
      platform: [],
      dependencies: [],
      tags: formatArray(data.topics ?? []),
    };
  },
};

/* ------------------------------------------------------------- Homebrew */

interface BrewFormula {
  name: string;
  desc?: string;
  homepage?: string;
  aliases?: string[];
  dependencies?: string[];
  versions?: { stable?: string };
}

let brewCache: BrewFormula[] | null = null;

async function loadBrewFormulae(): Promise<BrewFormula[]> {
  if (brewCache) return brewCache;
  const data = await getJson<BrewFormula[]>("https://formulae.brew.sh/api/formula.json");
  brewCache = Array.isArray(data) ? data : [];
  return brewCache;
}

const homebrew: Registry = {
  id: "homebrew",
  title: "Homebrew",
  placeholder: "Search Homebrew formulae…",
  async search(query) {
    const formulae = await loadBrewFormulae();
    const q = query.toLowerCase();
    return formulae
      .filter((f) => f.name.toLowerCase().includes(q) || (f.desc ?? "").toLowerCase().includes(q))
      .slice(0, 20)
      .map((f) => ({
        id: f.name,
        name: f.name,
        description: f.desc ?? "",
        author: "",
        version: f.versions?.stable ?? "",
      }));
  },
  async detail(formulaName) {
    const data = await getJson<BrewFormula>(
      `https://formulae.brew.sh/api/formula/${encodeURIComponent(formulaName)}.json`,
    );
    if (!data) return null;

    return {
      type: "software",
      software_type: "CLI",
      id: data.name || formulaName,
      aliases: formatArray(data.aliases ?? []),
      description: data.desc || "",
      author: [],
      source_url: data.homepage || "",
      github_url: "",
      image_url: "",
      platform: [formatWikilink("macOS")],
      dependencies: formatArray(data.dependencies ?? []).map(formatWikilink),
      tags: [],
    };
  },
};

/* ---------------------------------------------------- VS Code Extensions */

const VSCODE_QUERY_URL = "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery";

interface VSCodeExtension {
  extensionName?: string;
  displayName?: string;
  shortDescription?: string;
  tags?: string[];
  publisher?: { publisherName?: string; displayName?: string; domain?: string };
  versions?: Array<{ version?: string }>;
}

async function vscodeQuery(filterType: number, value: string): Promise<VSCodeExtension[]> {
  const body = {
    filters: [
      {
        criteria: [
          { filterType: 8, value: "Microsoft.VisualStudio.Code" },
          { filterType, value },
        ],
        pageSize: 20,
      },
    ],
    flags: 914,
  };

  const response = await fetch(VSCODE_QUERY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json;api-version=3.0-preview.1",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) return [];

  const data = (await response.json()) as {
    results?: Array<{ extensions?: VSCodeExtension[] }>;
  };
  return data.results?.[0]?.extensions ?? [];
}

const vscode: Registry = {
  id: "vscode",
  title: "VS Code",
  placeholder: "Search VS Code extensions…",
  async search(query) {
    const extensions = await vscodeQuery(10, query);
    return extensions.map((ext) => {
      const id = `${ext.publisher?.publisherName ?? ""}.${ext.extensionName ?? ""}`;
      return {
        id,
        name: ext.displayName || ext.extensionName || id,
        description: ext.shortDescription ?? "",
        author: ext.publisher?.displayName ?? "",
        version: ext.versions?.[0]?.version ?? "",
      };
    });
  },
  async detail(extensionId) {
    const extension = (await vscodeQuery(7, extensionId))[0];
    if (!extension) return null;

    const displayName = extension.displayName || extension.extensionName || "";
    const publisherName = extension.publisher?.displayName || "";
    const publisherDomain = extension.publisher?.domain || "";

    return {
      type: "software",
      software_type: "extension",
      id: displayName || extensionId.split(".").pop() || extensionId,
      aliases: [extensionId],
      description: extension.shortDescription || "",
      author: publisherName ? [formatWikilink(publisherName)] : [],
      source_url: `https://marketplace.visualstudio.com/items?itemName=${extensionId}`,
      github_url: "",
      image_url: publisherDomain ? `https://${publisherDomain}/icon` : "",
      platform: [formatWikilink("VS Code")],
      dependencies: [],
      tags: formatArray(extension.tags ?? []),
    };
  },
};

/* ------------------------------------------------------ Obsidian Plugins */

interface ObsidianPlugin {
  id: string;
  name: string;
  author?: string;
  description?: string;
  repo: string;
}

const OBSIDIAN_PLUGINS_URL =
  "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json";

let obsidianCache: ObsidianPlugin[] | null = null;

async function loadObsidianPlugins(): Promise<ObsidianPlugin[]> {
  if (obsidianCache) return obsidianCache;
  const data = await getJson<ObsidianPlugin[]>(OBSIDIAN_PLUGINS_URL);
  obsidianCache = Array.isArray(data) ? data : [];
  return obsidianCache;
}

const obsidian: Registry = {
  id: "obsidian",
  title: "Obsidian",
  placeholder: "Search Obsidian community plugins…",
  async search(query) {
    const plugins = await loadObsidianPlugins();
    const q = query.toLowerCase();
    return plugins
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q),
      )
      .slice(0, 20)
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? "",
        author: p.author ?? "",
        version: "",
      }));
  },
  async detail(pluginId, ctx) {
    const plugins = await loadObsidianPlugins();
    const plugin = plugins.find((p) => p.id === pluginId);
    if (!plugin) return null;

    const [manifest, repo] = await Promise.all([
      getJson<{ description?: string }>(
        `https://raw.githubusercontent.com/${plugin.repo}/master/manifest.json`,
      ).catch(() => null),
      getJson<{ description?: string; topics?: string[]; owner?: { avatar_url?: string } }>(
        `https://api.github.com/repos/${plugin.repo}`,
        { headers: githubHeaders(ctx) },
      ).catch(() => null),
    ]);

    return {
      type: "software",
      software_type: "extension",
      id: plugin.name || pluginId,
      aliases: plugin.name !== pluginId ? [pluginId] : [],
      description: manifest?.description || plugin.description || repo?.description || "",
      author: plugin.author ? [formatWikilink(plugin.author)] : [],
      source_url: `obsidian://show-plugin?id=${pluginId}`,
      github_url: normalizeGitHubUrl(`https://github.com/${plugin.repo}`),
      image_url: repo?.owner?.avatar_url || "",
      platform: [formatWikilink("Obsidian")],
      dependencies: [],
      tags: formatArray(repo?.topics ?? []),
    };
  },
};

export const REGISTRIES: Registry[] = [npm, gem, github, homebrew, vscode, obsidian];

export function getRegistry(id: string): Registry {
  return REGISTRIES.find((r) => r.id === id) ?? npm;
}
