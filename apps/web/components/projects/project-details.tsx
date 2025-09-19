import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { ProjectDetail } from "./types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export type ProjectDetailsProps = {
  project: ProjectDetail;
};

export function ProjectDetails({ project }: ProjectDetailsProps) {
  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>项目编号：{project.id}</span>
          <Badge variant="outline">{project.category ?? "未分类"}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {project.title}
          </h1>
          <Badge>{project.status}</Badge>
        </div>
        <p className="max-w-3xl text-base text-muted-foreground">{project.summary}</p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>项目介绍</CardTitle>
            <CardDescription>了解项目背景、目标和规划</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line leading-relaxed text-foreground/80">
              {project.description}
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>筹资进度</CardTitle>
              <CardDescription>资金流向与目标完成情况</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/40 p-4">
                <dl className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <dt>目标金额</dt>
                    <dd className="font-medium text-foreground">
                      {formatCurrency(project.goalAmount)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>已筹金额</dt>
                    <dd className="font-medium text-foreground">
                      {formatCurrency(project.pledgedAmount)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>支持者</dt>
                    <dd className="font-medium text-foreground">
                      {project.backerCount} 位
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>截止日期</dt>
                    <dd className="font-medium text-foreground">
                      {new Date(project.deadline).toLocaleString("zh-CN")}
                    </dd>
                  </div>
                </dl>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>发起人信息</CardTitle>
              <CardDescription>了解项目的发起者</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4 text-sm text-muted-foreground">
                <div className="space-y-1">
                  <dt>发起人地址</dt>
                  <dd className="font-medium text-foreground">{project.owner}</dd>
                </div>
                {project.category ? (
                  <div className="space-y-1">
                    <dt>项目类别</dt>
                    <dd className="font-medium text-foreground">{project.category}</dd>
                  </div>
                ) : null}
              </dl>
            </CardContent>
          </Card>
        </div>
      </section>
    </article>
  );
}
