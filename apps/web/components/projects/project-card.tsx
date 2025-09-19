import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { ProjectSummary } from "./types";

export type ProjectCardProps = {
  project: ProjectSummary;
};

const statusLabel: Record<ProjectSummary["status"], string> = {
  active: "进行中",
  successful: "已成功",
  failed: "未达成",
  cancelled: "已取消",
};

const statusVariant: Record<ProjectSummary["status"], "default" | "secondary" | "destructive" | "outline"> = {
  active: "secondary",
  successful: "default",
  failed: "destructive",
  cancelled: "outline",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getProgressValue(project: ProjectSummary) {
  if (project.goalAmount === 0) {
    return 0;
  }

  return Math.min(project.pledgedAmount / project.goalAmount, 1);
}

function formatDeadline(deadline: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(deadline));
}

export function ProjectCard({ project }: ProjectCardProps) {
  const progress = getProgressValue(project);

  return (
    <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
      <CardHeader>
        <Badge variant={statusVariant[project.status]}>{statusLabel[project.status]}</Badge>
        <CardTitle className="text-xl">{project.title}</CardTitle>
        <CardDescription>{project.summary}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-end justify-between text-sm text-muted-foreground">
            <span>筹集 {formatCurrency(project.pledgedAmount)}</span>
            <span className="text-xs">目标 {formatCurrency(project.goalAmount)}</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>进度 {Math.round(progress * 100)}%</span>
            <span>截止 {formatDeadline(project.deadline)}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="justify-between text-sm text-primary">
        <span>查看详情</span>
        <span aria-hidden>→</span>
      </CardFooter>
    </Card>
  );
}
