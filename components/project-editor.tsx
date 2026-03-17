'use client';

import {
  createElement,
  isValidElement,
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode
} from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';

const API_BASE_URL = 'http://localhost:4000';

type Project = {
  id: string | number;
  name: string;
  owner: string;
  updatedAt: string;
  instructions?: string;
  version?: number;
};

type ProjectVersion = {
  version: number;
  instructions: string;
  createdAt: string;
};

type TocItem = {
  id: string;
  text: string;
  level: 1 | 2 | 3;
};

type HeadingRendererProps = ComponentPropsWithoutRef<'h1'> & {
  children?: ReactNode;
  node?: unknown;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function slugifyHeading(text: string) {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return slug || 'section';
}

function createUniqueHeadingId(text: string, headingCounts: Map<string, number>) {
  const baseId = slugifyHeading(text);
  const nextCount = (headingCounts.get(baseId) ?? 0) + 1;

  headingCounts.set(baseId, nextCount);

  return nextCount === 1 ? baseId : `${baseId}-${nextCount}`;
}

function extractTextContent(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(extractTextContent).join('');
  }

  if (isValidElement(children)) {
    return extractTextContent(children.props.children);
  }

  return '';
}

function parseMarkdownToc(markdown: string): TocItem[] {
  const tocItems: TocItem[] = [];
  const headingCounts = new Map<string, number>();
  let activeFence: '`' | '~' | null = null;

  for (const line of markdown.split('\n')) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);

    if (fenceMatch) {
      const fenceMarker = fenceMatch[1][0] as '`' | '~';

      if (!activeFence) {
        activeFence = fenceMarker;
      } else if (activeFence === fenceMarker) {
        activeFence = null;
      }

      continue;
    }

    if (activeFence) {
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+?)\s*$/);

    if (!headingMatch) {
      continue;
    }

    const level = headingMatch[1].length as TocItem['level'];
    const text = headingMatch[2].replace(/\s+#+\s*$/, '').trim();

    if (!text) {
      continue;
    }

    tocItems.push({
      id: createUniqueHeadingId(text, headingCounts),
      text,
      level
    });
  }

  return tocItems;
}

function createMarkdownComponents(): Components {
  const headingCounts = new Map<string, number>();

  const createHeadingRenderer = (tagName: 'h1' | 'h2' | 'h3') => {
    return function Heading({ children, node: _node, ...props }: HeadingRendererProps) {
      const headingText = extractTextContent(children).trim();
      const id = createUniqueHeadingId(headingText, headingCounts);

      return createElement(tagName, { ...props, id }, children);
    };
  };

  return {
    h1: createHeadingRenderer('h1'),
    h2: createHeadingRenderer('h2'),
    h3: createHeadingRenderer('h3')
  };
}

async function fetchProject(projectId: string) {
  const response = await fetch(`${API_BASE_URL}/projects/${encodeURIComponent(projectId)}`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Failed to load project (${response.status})`);
  }

  return (await response.json()) as Project;
}

async function fetchProjectVersions(projectId: string) {
  const response = await fetch(
    `${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/versions`,
    {
      cache: 'no-store'
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to load version history (${response.status})`);
  }

  return (await response.json()) as ProjectVersion[];
}

export default function ProjectEditor({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [instructions, setInstructions] = useState('');
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ProjectVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [versionsLoading, setVersionsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadProject = async () => {
      try {
        setLoading(true);
        setError(null);

        const nextProject = await fetchProject(projectId);

        if (!active) {
          return;
        }

        setProject(nextProject);
        setInstructions(nextProject.instructions ?? '');
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(getErrorMessage(loadError));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadProject();

    return () => {
      active = false;
    };
  }, [projectId]);

  useEffect(() => {
    let active = true;

    const loadVersions = async () => {
      try {
        setVersionsLoading(true);
        setVersionsError(null);

        const nextVersions = await fetchProjectVersions(projectId);

        if (!active) {
          return;
        }

        setVersions(nextVersions);
        setSelectedVersion((currentVersion) => {
          if (!currentVersion) {
            return nextVersions[0] ?? null;
          }

          return (
            nextVersions.find((item) => item.version === currentVersion.version) ??
            nextVersions[0] ??
            null
          );
        });
      } catch (loadError) {
        if (!active) {
          return;
        }

        setVersionsError(getErrorMessage(loadError));
        setVersions([]);
        setSelectedVersion(null);
      } finally {
        if (active) {
          setVersionsLoading(false);
        }
      }
    };

    loadVersions();

    return () => {
      active = false;
    };
  }, [projectId]);

  const markdown = useMemo(() => instructions.trim(), [instructions]);
  const selectedVersionMarkdown = useMemo(
    () => selectedVersion?.instructions.trim() ?? '',
    [selectedVersion]
  );
  const markdownToc = useMemo(() => parseMarkdownToc(markdown), [markdown]);
  const markdownComponents = useMemo(() => createMarkdownComponents(), [markdown]);
  const selectedVersionMarkdownComponents = useMemo(
    () => createMarkdownComponents(),
    [selectedVersionMarkdown]
  );

  const handleTocClick = (id: string) => {
    const heading = document.getElementById(id);

    if (!heading) {
      return;
    }

    heading.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setVersionsLoading(true);
      setSaveMessage(null);
      setError(null);
      setVersionsError(null);

      const response = await fetch(
        `${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/instructions`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ instructions })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to save instructions (${response.status})`);
      }

      const [nextProject, nextVersions] = await Promise.all([
        fetchProject(projectId),
        fetchProjectVersions(projectId)
      ]);

      setProject(nextProject);
      setInstructions(nextProject.instructions ?? instructions);
      setVersions(nextVersions);
      setSelectedVersion(nextVersions[0] ?? null);
      setVersionsError(null);
      setSaveMessage('Saved successfully.');
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
      setVersionsLoading(false);
    }
  };

  if (loading) {
    return <div className="card text-sm text-slate-600">Loading project...</div>;
  }

  if (error && !project) {
    return <div className="card border-red-300 bg-red-50 text-sm text-red-700">Error: {error}</div>;
  }

  if (!project) {
    return <div className="card text-sm text-slate-600">Project not found.</div>;
  }

  return (
    <section className="space-y-6">
      <div className="card space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="panel-title">Project</p>
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <p className="text-sm text-slate-600">Owner: {project.owner}</p>
            <p className="text-xs text-slate-500">Updated: {formatDateTime(project.updatedAt)}</p>
          </div>
          <span className="self-start rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            {typeof project.version === 'number'
              ? `Current version ${project.version}`
              : 'Version unavailable'}
          </span>
        </div>
      </div>

      {error && <div className="card border-red-300 bg-red-50 text-sm text-red-700">Error: {error}</div>}

      {saveMessage && (
        <div className="card border-emerald-300 bg-emerald-50 text-sm text-emerald-700">{saveMessage}</div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="card space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="panel-title">instructions.md</h2>
            <span className="text-xs text-slate-500">Latest editable draft</span>
          </div>
          <textarea
            className="input-textarea"
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div className="space-y-4">
          <div className="card space-y-3">
            <h2 className="panel-title">Preview</h2>
            {markdownToc.length > 0 && (
              <nav className="markdown-toc" aria-label="Table of contents">
                <p className="markdown-toc-title">Table of contents</p>
                <ul className="markdown-toc-list">
                  {markdownToc.map((item) => (
                    <li key={item.id} className="markdown-toc-item" data-level={item.level}>
                      <button
                        type="button"
                        className="markdown-toc-button"
                        onClick={() => handleTocClick(item.id)}
                      >
                        {item.text}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            <article className="markdown-preview text-sm">
              {markdown ? (
                <ReactMarkdown components={markdownComponents}>{markdown}</ReactMarkdown>
              ) : (
                <p>No content yet.</p>
              )}
            </article>
          </div>

          <div className="card space-y-4">
            <div className="space-y-1">
              <h2 className="panel-title">Version History</h2>
              <p className="text-sm text-slate-600">Select a saved version to inspect it read-only.</p>
            </div>

            {versionsLoading && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Loading version history...
              </div>
            )}

            {versionsError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                Error: {versionsError}
              </div>
            )}

            {!versionsLoading && !versionsError && versions.length === 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                No saved versions yet.
              </div>
            )}

            {!versionsLoading && !versionsError && versions.length > 0 && (
              <div className="space-y-4">
                <ul className="space-y-2">
                  {versions.map((version) => {
                    const isSelected = version.version === selectedVersion?.version;

                    return (
                      <li key={version.version}>
                        <button
                          type="button"
                          onClick={() => setSelectedVersion(version)}
                          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                            isSelected
                              ? 'border-cyan-300 bg-cyan-50 text-cyan-900'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <span className="font-medium">Version {version.version}</span>
                          <span className="text-xs text-slate-500">
                            {formatDateTime(version.createdAt)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedVersion
                        ? `Viewing version ${selectedVersion.version}`
                        : 'Select a version'}
                    </p>
                    {selectedVersion && (
                      <p className="text-xs text-slate-500">
                        Saved {formatDateTime(selectedVersion.createdAt)}
                      </p>
                    )}
                  </div>
                  <article className="markdown-preview mt-4 text-sm">
                    {selectedVersionMarkdown ? (
                      <ReactMarkdown components={selectedVersionMarkdownComponents}>
                        {selectedVersionMarkdown}
                      </ReactMarkdown>
                    ) : (
                      <p>Select a version to view it.</p>
                    )}
                  </article>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
