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

const statusClassName: Record<ProjectSummary["status"], string> = {
  active: "bg-blue-100 text-blue-600",
  successful: "bg-emerald-100 text-emerald-600",
  failed: "bg-rose-100 text-rose-600",
  cancelled: "bg-slate-100 text-slate-500",
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

function getDaysLeft(deadline: string) {
  const millisLeft = new Date(deadline).getTime() - Date.now();
  return Math.max(0, Math.ceil(millisLeft / (1000 * 60 * 60 * 24)));
}

export function ProjectCard({ project }: ProjectCardProps) {
  const progress = getProgressValue(project);
  const daysLeft = getDaysLeft(project.deadline);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[28px] bg-white shadow-lg shadow-blue-950/5 ring-1 ring-slate-900/5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-[16/11] w-full overflow-hidden">
        <img
          src={project.imageUrl}
          alt={project.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute left-5 top-5 inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
          {project.category}
        </span>
        <span
          className={`absolute right-5 top-5 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${statusClassName[project.status]}`}
        >
          {statusLabel[project.status]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            由 <span className="font-medium text-slate-900">{project.creator}</span> 发起
          </p>
          <h3 className="text-xl font-semibold text-slate-900">{project.title}</h3>
          <p className="text-sm leading-relaxed text-slate-600">{project.summary}</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm font-medium text-slate-600">
            <span>{formatCurrency(project.pledgedAmount)}</span>
            <span className="text-slate-400">目标 {formatCurrency(project.goalAmount)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-500 transition-all duration-500"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>进度 {Math.round(progress * 100)}%</span>
            <span>{daysLeft} 天剩余</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm font-medium text-blue-600">
          <span>查看项目</span>
          <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
            →
          </span>
        </div>
      </div>
    </article>
  );
}
