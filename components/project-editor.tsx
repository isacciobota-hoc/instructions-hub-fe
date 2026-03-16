'use client';

import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';

const API_BASE_URL = 'http://localhost:4000';

type Project = {
  id: string | number;
  name: string;
  owner: string;
  updatedAt: string;
  instructions?: string;
  version?: number;
  latestVersion?: number;
};

type VersionEntry = {
  version: number;
  instructions: string;
  createdAt: string;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

async function fetchProject(projectId: string): Promise<Project> {
  const response = await fetch(`${API_BASE_URL}/projects/${encodeURIComponent(projectId)}`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Failed to load project (${response.status})`);
  }

  return (await response.json()) as Project;
}

async function fetchVersions(projectId: string): Promise<VersionEntry[]> {
  const response = await fetch(
    `${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/versions`,
    {
      cache: 'no-store'
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to load version history (${response.status})`);
  }

  const data = (await response.json()) as VersionEntry[] | { versions?: VersionEntry[] };

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data.versions)) {
    return data.versions;
  }

  throw new Error('Invalid version history response');
}

export default function ProjectEditor({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [instructions, setInstructions] = useState('');
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [versionsLoading, setVersionsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProject = async () => {
      try {
        setLoading(true);
        setError(null);

        const projectData = await fetchProject(projectId);

        if (cancelled) {
          return;
        }

        setProject(projectData);
        setInstructions(projectData.instructions ?? '');
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProject();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;

    const loadVersions = async () => {
      try {
        setVersionsLoading(true);
        setVersionsError(null);

        const versionData = await fetchVersions(projectId);

        if (cancelled) {
          return;
        }

        setVersions(versionData);
      } catch (err) {
        if (!cancelled) {
          setVersionsError(getErrorMessage(err));
        }
      } finally {
        if (!cancelled) {
          setVersionsLoading(false);
        }
      }
    };

    loadVersions();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    setSelectedVersionNumber((currentSelection) => {
      if (versions.length === 0) {
        return null;
      }

      if (currentSelection && versions.some((entry) => entry.version === currentSelection)) {
        return currentSelection;
      }

      return versions[0].version;
    });
  }, [versions]);

  const markdown = useMemo(() => instructions.trim(), [instructions]);
  const selectedVersion = useMemo(
    () => versions.find((entry) => entry.version === selectedVersionNumber) ?? null,
    [selectedVersionNumber, versions]
  );
  const selectedVersionMarkdown = useMemo(
    () => selectedVersion?.instructions.trim() ?? '',
    [selectedVersion]
  );
  const currentVersion = project?.version ?? project?.latestVersion ?? null;

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveMessage(null);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/instructions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ instructions })
      });

      if (!response.ok) {
        throw new Error(`Failed to save instructions (${response.status})`);
      }

      setSaveMessage('Saved successfully.');
      setProject((current) => {
        const nextVersion = current ? (current.version ?? current.latestVersion ?? null) : null;

        return current
          ? {
              ...current,
              instructions,
              updatedAt: new Date().toISOString(),
              version: nextVersion === null ? current.version : nextVersion + 1,
              latestVersion: nextVersion === null ? current.latestVersion : nextVersion + 1
            }
          : current;
      });

      setVersionsLoading(true);

      const [projectResult, versionsResult] = await Promise.allSettled([
        fetchProject(projectId),
        fetchVersions(projectId)
      ]);

      if (projectResult.status === 'fulfilled') {
        setProject(projectResult.value);
        setInstructions(projectResult.value.instructions ?? '');
      } else {
        setError(`Saved, but failed to refresh project: ${getErrorMessage(projectResult.reason)}`);
      }

      if (versionsResult.status === 'fulfilled') {
        setVersions(versionsResult.value);
        setVersionsError(null);
      } else {
        setVersionsError(
          `Saved, but failed to refresh version history: ${getErrorMessage(versionsResult.reason)}`
        );
      }
    } catch (err) {
      setError(getErrorMessage(err));
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="panel-title">Project</p>
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <p className="text-sm text-slate-600">Owner: {project.owner}</p>
          </div>
          {currentVersion !== null && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              Version {currentVersion}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">Updated: {new Date(project.updatedAt).toLocaleString()}</p>
      </div>

      {error && <div className="card border-red-300 bg-red-50 text-sm text-red-700">Error: {error}</div>}

      {saveMessage && (
        <div className="card border-emerald-300 bg-emerald-50 text-sm text-emerald-700">{saveMessage}</div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="panel-title">instructions.md</h2>
            {currentVersion !== null && (
              <span className="text-xs font-medium text-slate-500">Editing latest version</span>
            )}
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

        <div className="card space-y-3">
          <h2 className="panel-title">Preview</h2>
          <article className="prose prose-slate max-w-none text-sm">
            {markdown ? <ReactMarkdown>{markdown}</ReactMarkdown> : <p>No content yet.</p>}
          </article>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="panel-title">Version History</h2>
            <p className="text-sm text-slate-600">
              Select a version to inspect it without changing the current draft.
            </p>
          </div>
          {versionsLoading && (
            <span className="text-xs font-medium text-slate-500">Loading history...</span>
          )}
        </div>

        {versionsError && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {versionsError}
          </div>
        )}

        {versionsLoading && versions.length === 0 && !versionsError && (
          <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
            Loading version history...
          </div>
        )}

        {!versionsLoading && !versionsError && versions.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
            No saved versions yet.
          </div>
        )}

        {versions.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <div className="space-y-2">
              {versions.map((entry) => {
                const isSelected = entry.version === selectedVersionNumber;

                return (
                  <button
                    key={entry.version}
                    type="button"
                    onClick={() => setSelectedVersionNumber(entry.version)}
                    aria-pressed={isSelected}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">Version {entry.version}</span>
                      {entry.version === currentVersion && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] ${
                            isSelected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          Latest
                        </span>
                      )}
                    </div>
                    <p
                      className={`mt-1 text-xs ${
                        isSelected ? 'text-slate-200' : 'text-slate-500'
                      }`}
                    >
                      {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              {selectedVersion ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Version {selectedVersion.version}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Saved {new Date(selectedVersion.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500">
                      Read-only
                    </span>
                  </div>
                  <article className="prose prose-slate max-w-none text-sm">
                    {selectedVersionMarkdown ? (
                      <ReactMarkdown>{selectedVersionMarkdown}</ReactMarkdown>
                    ) : (
                      <p>No content in this version.</p>
                    )}
                  </article>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Select a version to preview it.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
