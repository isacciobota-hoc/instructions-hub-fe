import Link from 'next/link';
import ProjectEditor from '@/components/project-editor';

export default function ProjectPage({ params }: { params: { id: string } }) {
  return (
    <main className="container-page space-y-6">
      <Link
        href="/"
        className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-sm text-slate-700 shadow-sm transition hover:border-cyan-300 hover:text-cyan-700"
      >
        Back to projects
      </Link>
      <ProjectEditor projectId={params.id} />
    </main>
  );
}
