import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectCard } from "./project-card";
import type { ProjectSummary } from "./types";

export type ProjectListProps = {
  projects: ProjectSummary[];
};

export function ProjectList({ projects }: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <Card className="bg-muted/30 border-dashed">
        <CardHeader>
          <CardTitle className="text-center text-lg">暂未发现众筹项目</CardTitle>
          <CardDescription className="text-center">
            尝试成为首位发起人，开启你的 Web3 众筹之旅。
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-6 text-center text-sm text-muted-foreground">
          未来这里将展示来自社区的精彩创意。
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
          className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ProjectCard project={project} />
        </Link>
      ))}
    </div>
  );
}
