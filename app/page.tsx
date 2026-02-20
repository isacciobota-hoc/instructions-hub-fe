'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Project = {
  id: string | number;
  name: string;
  owner: string;
  updatedAt: string;
};

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('http://localhost:4000/projects', {
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error(`Failed to load projects (${response.status})`);
        }

        const data = (await response.json()) as Project[];
        setProjects(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  return (
    <main className="container-page space-y-6">
      <header className="space-y-2">
        <p className="panel-title">Instructions Hub</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Projects</h1>
        <p className="text-sm text-slate-600">Select a project to edit instructions.</p>
      </header>

      {loading && <div className="card text-sm text-slate-600">Loading projects...</div>}

      {error && (
        <div className="card border-red-300 bg-red-50 text-sm text-red-700">Error: {error}</div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className="card text-sm text-slate-600">No projects found.</div>
      )}

      {!loading && !error && projects.length > 0 && (
        <ul className="space-y-3">
          {projects.map((project, index) => (
            <li key={String(project.id)} className={index === 1 ? 'ml-12' : ''}>
              <Link
                href={`/projects/${encodeURIComponent(String(project.id))}`}
                className="card block transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{project.name}</h2>
                    <p className="mt-0.5 text-sm text-slate-600">Owner: {project.owner}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
                    Updated {new Date(project.updatedAt).toLocaleString()}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
