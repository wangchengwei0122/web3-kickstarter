import { notFound } from "next/navigation";
import { ProjectDetails } from "../../../components/projects/project-details";
import type { ProjectDetail } from "../../../components/projects/types";

const mockProjects: Record<string, ProjectDetail> = {
  alpha: {
    id: "alpha",
    title: "去中心化储能网络",
    summary: "构建一个由社区驱动的绿色能源储存与共享平台。",
    description:
      "这是一个示例项目，用于展示项目详情页的基础布局。\n\n实际数据将来自链上合约或后端服务，包含项目进度、支持者名单等。",
    goalAmount: 150000,
    pledgedAmount: 78000,
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
    status: "active",
    owner: "0x1234...ABCD",
    backerCount: 128,
    category: "新能源",
    creator: "GreenGrid",
    imageUrl:
      "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1600&q=80",
  },
  beta: {
    id: "beta",
    title: "链上公益透明化工具",
    summary: "打造一个实时公开的慈善捐赠追踪系统，保证资金透明。",
    description:
      "示例文本：这里会呈现项目团队、资金使用计划以及风险说明等内容。",
    goalAmount: 80000,
    pledgedAmount: 82000,
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
    status: "successful",
    owner: "0x5678...EFGH",
    backerCount: 312,
    category: "公益",
    creator: "OpenAid",
    imageUrl:
      "https://images.unsplash.com/photo-1455849318743-b2233052fcff?auto=format&fit=crop&w=1600&q=80",
  },
  gamma: {
    id: "gamma",
    title: "Web3 创作者共治平台",
    summary: "帮助创作者发行社区代币并通过治理投票共创内容。",
    description:
      "在这里展示项目背景、奖励机制以及路线图，方便支持者了解项目全貌。",
    goalAmount: 120000,
    pledgedAmount: 23000,
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    status: "active",
    owner: "0x9ABC...1234",
    backerCount: 45,
    category: "创作者经济",
    creator: "CreatorVerse",
    imageUrl:
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80",
  },
};

export type ProjectDetailPageProps = {
  params: {
    projectId: string;
  };
};

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const project = mockProjects[params.projectId];

  if (!project) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-6 py-12">
      <ProjectDetails project={project} />
    </main>
  );
}
