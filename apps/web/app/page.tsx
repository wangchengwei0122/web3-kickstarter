import Link from "next/link";
import { Button } from "@/components/ui/button";

import { FeaturedProjectHero } from "../components/projects/featured-project-hero";
import { ProjectList } from "../components/projects/project-list";
import type { ProjectSummary } from "../components/projects/types";

const featuredProject: ProjectSummary = {
  id: "eco-farm",
  title: "生态友好城市农业计划",
  summary: "支持在城市社区建设智能立体农场，推广绿色饮食与社区共享。",
  creator: "GreenThumb DAO",
  goalAmount: 100000,
  pledgedAmount: 75000,
  deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 12).toISOString(),
  status: "active",
  category: "可持续发展",
  imageUrl:
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80",
};

const mockProjects: ProjectSummary[] = [
  {
    id: "alpha",
    title: "科技创业孵化器",
    summary: "扶持多元化的科技创业者，打造下一波创新力量。",
    goalAmount: 100000,
    pledgedAmount: 60000,
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 25).toISOString(),
    status: "active",
    creator: "InnovateX",
    category: "科技",
    imageUrl:
      "https://images.unsplash.com/photo-1503389152951-9f343605f61e?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "beta",
    title: "社区艺术中心",
    summary: "为社区艺术空间注入新活力，打造开放创意的交流场所。",
    goalAmount: 50000,
    pledgedAmount: 22500,
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 40).toISOString(),
    status: "active",
    creator: "ArtConnect",
    category: "艺术",
    imageUrl:
      "https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "gamma",
    title: "开放源码教育平台",
    summary: "打造积极的开源协作平台，推动社会创新。",
    goalAmount: 10000,
    pledgedAmount: 8500,
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 18).toISOString(),
    status: "active",
    creator: "CodeForGood",
    category: "教育",
    imageUrl:
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-12">
      <FeaturedProjectHero project={featuredProject} />

      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              探索项目
            </h2>
            <p className="text-sm text-slate-500">
              精选社区发起的优质项目，发现与你同频的使命。
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link href="/projects">查看全部</Link>
          </Button>
        </div>

        <ProjectList projects={mockProjects} />
      </section>
    </main>
  );
}
