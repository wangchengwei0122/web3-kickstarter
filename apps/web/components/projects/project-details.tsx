import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import type { ProjectDetail } from "./types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getProgressValue(goal: number, pledged: number) {
  if (goal === 0) {
    return 0;
  }

  return Math.min(1, pledged / goal);
}

function getDaysLeft(deadline: string) {
  const millisLeft = new Date(deadline).getTime() - Date.now();
  return Math.max(0, Math.ceil(millisLeft / (1000 * 60 * 60 * 24)));
}

const statusClassName: Record<ProjectDetail["status"], string> = {
  active: "bg-blue-100 text-blue-600",
  successful: "bg-emerald-100 text-emerald-600",
  failed: "bg-rose-100 text-rose-600",
  cancelled: "bg-slate-100 text-slate-500",
};

const statusLabel: Record<ProjectDetail["status"], string> = {
  active: "进行中",
  successful: "已成功",
  failed: "未达成",
  cancelled: "已取消",
};

export type ProjectDetailsProps = {
  project: ProjectDetail;
};

export function ProjectDetails({ project }: ProjectDetailsProps) {
  const progress = getProgressValue(project.goalAmount, project.pledgedAmount);
  const daysLeft = getDaysLeft(project.deadline);

  return (
    <article className="space-y-10">
      <div className="overflow-hidden rounded-[32px] bg-white shadow-xl shadow-blue-950/5 ring-1 ring-slate-900/5">
        <img
          src={project.imageUrl}
          alt={project.title}
          className="h-full w-full object-cover"
        />
      </div>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="rounded-[28px] bg-white p-8 shadow-lg shadow-blue-950/5 ring-1 ring-slate-900/5">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span>项目编号：{project.id}</span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {project.category}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                {project.title}
              </h1>
              <Badge className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClassName[project.status]}`}>
                {statusLabel[project.status]}
              </Badge>
            </div>

            <p className="mt-4 text-base leading-relaxed text-slate-600">{project.summary}</p>

            <div className="mt-8 grid gap-6 rounded-[24px] bg-slate-50 p-6">
              <div className="grid gap-6 text-sm text-slate-500 md:grid-cols-2">
                <div>
                  <p className="text-slate-400">已筹金额</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {formatCurrency(project.pledgedAmount)}
                  </p>
                  <p className="text-xs">已完成 {Math.round(progress * 100)}%</p>
                </div>
                <div>
                  <p className="text-slate-400">目标金额</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {formatCurrency(project.goalAmount)}
                  </p>
                  <p className="text-xs">{daysLeft} 天剩余 · {project.backerCount} 位支持者</p>
                </div>
              </div>

              <div className="h-3 w-full overflow-hidden rounded-full bg-white/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-500"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-[28px] bg-white p-8 shadow-lg shadow-blue-950/5 ring-1 ring-slate-900/5">
            <nav className="flex flex-wrap gap-6 text-sm font-medium text-slate-500">
              <span className="text-slate-900">项目介绍</span>
              <span className="text-slate-300">进度更新</span>
              <span className="text-slate-300">支持者</span>
            </nav>
            <div className="mt-6 whitespace-pre-line text-base leading-relaxed text-slate-600">
              {project.description}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-[28px] bg-white p-6 shadow-lg shadow-blue-950/5 ring-1 ring-slate-900/5">
            <h2 className="text-lg font-semibold text-slate-900">支持项目</h2>
            <p className="mt-2 text-sm text-slate-500">你的每一笔支持都将直接用于项目建设。</p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {[50, 100, 250, 500].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-sky-400 hover:text-sky-500"
                >
                  ${amount}
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-3">
              <label className="text-xs font-medium text-slate-500" htmlFor="support-amount">
                自定义支持金额 (USD)
              </label>
              <Input id="support-amount" type="number" placeholder="50" className="h-11 rounded-full border-slate-200" />
            </div>

            <Button className="mt-6 w-full rounded-full text-sm">现在支持</Button>

            <p className="mt-3 text-center text-xs text-slate-400">
              你的支持将用于项目执行，不可退回。
            </p>
          </div>

          <Card className="rounded-[28px] border-0 bg-white p-6 shadow-lg shadow-blue-950/5 ring-1 ring-slate-900/5">
            <CardHeader className="px-0">
              <CardTitle className="text-lg font-semibold text-slate-900">发起人信息</CardTitle>
            </CardHeader>
            <CardContent className="px-0 text-sm text-slate-500">
              <dl className="space-y-4">
                <div className="space-y-1">
                  <dt className="text-xs uppercase tracking-wide text-slate-400">项目方</dt>
                  <dd className="font-medium text-slate-900">{project.creator}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs uppercase tracking-wide text-slate-400">发起人地址</dt>
                  <dd className="font-medium text-slate-900">{project.owner}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs uppercase tracking-wide text-slate-400">项目类别</dt>
                  <dd className="font-medium text-slate-900">{project.category}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </aside>
      </section>
    </article>
  );
}
