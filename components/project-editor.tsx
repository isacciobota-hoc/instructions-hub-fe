'use client';

import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';

type Project = {
  id: string | number;
  name: string;
  owner: string;
  updatedAt: string;
  instructions?: string;
};

export default function ProjectEditor({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadProject = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('http://localhost:4000/projects', {
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error(`Failed to load project (${response.status})`);
        }

        const data = (await response.json()) as Project[];
        const foundProject = data.find((item) => String(item.id) === projectId);

        if (!foundProject) {
          throw new Error('Project not found');
        }

        setProject(foundProject);
        setInstructions(foundProject.instructions ?? '');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId]);

  const markdown = useMemo(() => instructions.trim(), [instructions]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveMessage(null);
      setError(null);

      const response = await fetch(
        `http://localhost:4000/projects/${encodeURIComponent(projectId)}/instructions`,
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

      setSaveMessage('Saved successfully.');
      setProject((current) =>
        current
          ? {
              ...current,
              instructions,
              updatedAt: new Date().toISOString()
            }
          : current
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setSaving(false);
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
      <div className="card space-y-1">
        <p className="panel-title">Project</p>
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <p className="text-sm text-slate-600">Owner: {project.owner}</p>
        <p className="text-xs text-slate-500">
          Updated: {new Date(project.updatedAt).toLocaleString()}
        </p>
      </div>

      {error && <div className="card border-red-300 bg-red-50 text-sm text-red-700">Error: {error}</div>}

      {saveMessage && (
        <div className="card border-emerald-300 bg-emerald-50 text-sm text-emerald-700">{saveMessage}</div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-3">
          <h2 className="panel-title">instructions.md</h2>
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
    </section>
  );
}
