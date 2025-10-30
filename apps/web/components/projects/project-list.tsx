import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { ProjectCard } from './project-card';
import type { ProjectSummary } from './types';

export type ProjectListProps = {
  projects: ProjectSummary[];
};

export function ProjectList({ projects }: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <Card className="border-dashed bg-white/60">
        <CardHeader>
          <CardTitle className="text-center text-lg">No projects found</CardTitle>
          <CardDescription className="text-center">
            Be the first to launch a project and start your Web3 crowdfunding journey.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-6 text-center text-sm text-slate-500">
          Future projects will be displayed here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <Link
          key={project.id}
          href={`/projects/${project.id}`}
          className="block rounded-[32px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2"
        >
          <ProjectCard project={project} />
        </Link>
      ))}
    </div>
  );
}
