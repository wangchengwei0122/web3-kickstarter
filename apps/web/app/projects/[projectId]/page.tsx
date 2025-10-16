import { notFound } from "next/navigation";

import { ProjectDetails } from "../../../components/projects/project-details";
import { fetchProjectDetail } from "@/src/lib/project-detail";

export type ProjectDetailPageProps = {
  params: {
    projectId: string;
  };
};

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const project = await fetchProjectDetail(params.projectId);

  if (!project) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-6 py-12">
      <ProjectDetails project={project} />
    </main>
  );
}
