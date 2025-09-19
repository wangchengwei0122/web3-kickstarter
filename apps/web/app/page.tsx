import { ProjectList } from "../components/projects/project-list";
import type { ProjectSummary } from "../components/projects/types";

const mockProjects: ProjectSummary[] = [
  {
    id: "alpha",
    title: "去中心化储能网络",
    summary: "构建一个由社区驱动的绿色能源储存与共享平台。",
    goalAmount: 150000,
    pledgedAmount: 78000,
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
    status: "active",
  },
  {
    id: "beta",
    title: "链上公益透明化工具",
    summary: "打造一个实时公开的慈善捐赠追踪系统，保证资金透明。",
    goalAmount: 80000,
    pledgedAmount: 82000,
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
    status: "successful",
  },
  {
    id: "gamma",
    title: "Web3 创作者共治平台",
    summary: "帮助创作者发行社区代币并通过治理投票共创内容。",
    goalAmount: 120000,
    pledgedAmount: 23000,
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    status: "active",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl space-y-10 px-6 py-12">
      <section className="space-y-4 text-center">
        <h1 className="text-4xl font-bold text-gray-900">Web3 众筹平台</h1>
        <p className="text-base text-gray-600">
          探索最新的去中心化众筹项目，支持你喜欢的创意与使命。
        </p>
      </section>

      <ProjectList projects={mockProjects} />
    </main>
  );
}
