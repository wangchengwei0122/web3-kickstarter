"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ProjectSummary } from "./types";

export type FeaturedProjectHeroProps = {
  project: ProjectSummary;
};

export function FeaturedProjectHero({ project }: FeaturedProjectHeroProps) {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    const millisLeft = new Date(project.deadline).getTime() - Date.now();
    const days = Math.max(0, Math.ceil(millisLeft / (1000 * 60 * 60 * 24)));
    setDaysLeft(days);
  }, [project.deadline]);

  const progress = (() => {
    if (typeof project.progress === "number") {
      return Math.max(0, Math.min(1, project.progress));
    }
    if (project.goalAmount === 0) {
      return 0;
    }
    return Math.min(project.pledgedAmount / project.goalAmount, 1);
  })();

  return (
    <section className="grid gap-8 rounded-[32px] bg-white p-6 shadow-xl shadow-blue-950/5 ring-1 ring-slate-900/5 lg:grid-cols-[1.1fr_1fr]">
      <div className="relative overflow-hidden rounded-[24px] bg-slate-100">
        <img
          src={project.imageUrl}
          alt={project.title}
          className="h-full w-full rounded-[24px] object-cover"
        />
        <span className="absolute left-6 top-6 inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
          {project.category}
        </span>
      </div>

      <div className="flex flex-col gap-8 self-center">
        <div className="space-y-4">
          <Badge variant="secondary" className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
            精选项目
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {project.title}
          </h1>
          <p className="text-base leading-relaxed text-slate-600">{project.summary}</p>
          <p className="text-sm text-slate-500">
            由 <span className="font-medium text-slate-900">{project.creator}</span> 发起
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm font-medium text-slate-600">
            <span>{Math.round(progress * 100)}% 已筹集</span>
            <span className="text-slate-500">剩余 {daysLeft ?? "--"} 天</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-500 transition-all duration-500"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild className="rounded-full px-6 text-sm">
            <Link href={`/projects/${project.id}`}>支持项目</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-full border-slate-200 bg-white px-6 text-sm text-slate-700 hover:bg-slate-100"
          >
            <Link href={`/projects/${project.id}`}>了解更多</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
