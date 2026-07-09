import { useEffect, useState } from "react";
import {
  Action,
  ActionPanel,
  Clipboard,
  Detail,
  getPreferenceValues,
  Icon,
  List,
  showToast,
  Toast,
  useNavigation,
  Keyboard,
} from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { frontmatterToYAML, type SoftwareFrontmatter } from "./frontmatter";
import { getRegistry, REGISTRIES, type SearchResult } from "./registries";
import { createSoftwareNote } from "./vault";

interface Preferences {
  vaultPath?: string;
  softwareFolder?: string;
  githubToken?: string;
}

export default function Command() {
  const prefs = getPreferenceValues<Preferences>();
  const ctx = { githubToken: prefs.githubToken };

  const [registryId, setRegistryId] = useState<string>(REGISTRIES[0].id);
  const [searchText, setSearchText] = useState<string>("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const query = searchText.trim();
    if (query.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const registry = getRegistry(registryId);
        const found = await registry.search(query, ctx);
        if (!cancelled) setResults(found);
      } catch (error) {
        if (!cancelled) {
          setResults([]);
          await showFailureToast(error, { title: "Search failed" });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchText, registryId]);

  const registry = getRegistry(registryId);

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder={registry.placeholder}
      throttle
      searchBarAccessory={
        <List.Dropdown tooltip="Registry" value={registryId} onChange={setRegistryId}>
          {REGISTRIES.map((r) => (
            <List.Dropdown.Item key={r.id} title={r.title} value={r.id} />
          ))}
        </List.Dropdown>
      }
    >
      {results.length === 0 ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title={searchText.trim().length < 2 ? "Type to search" : "No results"}
          description={`Searching ${registry.title}`}
        />
      ) : (
        results.map((result) => (
          <List.Item
            key={result.id}
            title={result.name}
            subtitle={result.description}
            accessories={[
              ...(result.version ? [{ tag: result.version }] : []),
              ...(result.author ? [{ text: result.author }] : []),
            ]}
            actions={
              <ActionPanel>
                <Action.Push
                  icon={Icon.Document}
                  title="View Frontmatter"
                  target={<FrontmatterView registryId={registryId} result={result} ctx={ctx} prefs={prefs} />}
                />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}

function FrontmatterView({
  registryId,
  result,
  ctx,
  prefs,
}: {
  registryId: string;
  result: SearchResult;
  ctx: { githubToken?: string };
  prefs: Preferences;
}) {
  const { pop } = useNavigation();
  const [fm, setFm] = useState<SoftwareFrontmatter | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const detail = await getRegistry(registryId).detail(result.id, ctx);
        if (!cancelled) setFm(detail);
        if (!detail && !cancelled) {
          await showFailureToast(new Error(`Could not resolve "${result.name}"`), {
            title: "Not found",
          });
        }
      } catch (error) {
        if (!cancelled) await showFailureToast(error, { title: "Lookup failed" });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const yaml = fm ? frontmatterToYAML(fm) : "";
  const markdown = fm ? `# ${fm.id}\n\n\`\`\`yaml\n${yaml}\n\`\`\`` : isLoading ? "Loading…" : "No data found.";

  async function copyFrontmatter() {
    await Clipboard.copy(yaml);
    await showToast({ style: Toast.Style.Success, title: "Copied frontmatter" });
  }

  async function createNote() {
    if (!fm) return;
    if (!prefs.vaultPath) {
      await showFailureToast(new Error("Set the vault path in extension preferences."), {
        title: "No vault configured",
      });
      return;
    }
    const toast = await showToast({ style: Toast.Style.Animated, title: "Creating note…" });
    try {
      const res = await createSoftwareNote(fm, prefs.vaultPath, prefs.softwareFolder ?? "software");
      toast.style = res.created ? Toast.Style.Success : Toast.Style.Failure;
      toast.title = res.message;
      if (res.created) pop();
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to create note";
      toast.message = error instanceof Error ? error.message : String(error);
    }
  }

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      navigationTitle={result.name}
      actions={
        fm ? (
          <ActionPanel>
            <Action
              icon={Icon.Clipboard}
              title="Copy Frontmatter"
              onAction={copyFrontmatter}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
            <Action
              icon={Icon.NewDocument}
              title="Create Note in Vault"
              onAction={createNote}
              shortcut={Keyboard.Shortcut.Common.New}
            />
            {fm.source_url ? (
              <Action.OpenInBrowser url={fm.source_url} shortcut={Keyboard.Shortcut.Common.Open} />
            ) : null}
            {fm.github_url ? (
              <Action.OpenInBrowser
                title="Open GitHub Repository"
                url={fm.github_url}
                shortcut={Keyboard.Shortcut.Common.OpenWith}
              />
            ) : null}
          </ActionPanel>
        ) : null
      }
    />
  );
}
