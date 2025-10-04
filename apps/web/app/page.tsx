'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { ProjectList } from '@/components/projects/project-list';
import type { ProjectSummary } from '@/components/projects/types';
import { FeaturedProjectHero } from '@/components/projects/featured-project-hero';
import { useExplore } from '@/src/hooks/useExplore';

const FALLBACK_FEATURED: ProjectSummary = {
  id: 'eco-farm',
  title: '生态友好城市农业计划',
  summary: '支持在城市社区建设智能立体农场，推广绿色饮食与社区共享。',
  creator: 'GreenThumb DAO',
  goalAmount: 100000,
  pledgedAmount: 75000,
  deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 12).toISOString(),
  status: 'active',
  category: '可持续发展',
  imageUrl:
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80',
};

const sortTabs = [
  { key: 'latest', label: '最新' },
  { key: 'deadline', label: '快到期' },
  { key: 'progress', label: '目标接近' },
] as const;

type SortKey = (typeof sortTabs)[number]['key'];

export default function HomePage() {
  const [sortKey, setSortKey] = useState<SortKey>('latest');
  const { projects, isLoading, isError, hasMore, loadMore, source } = useExplore();

  const sortedProjects = useMemo(() => {
    if (projects.length === 0) {
      return projects;
    }
    if (sortKey === 'deadline') {
      return [...projects].sort(
        (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      );
    }
    if (sortKey === 'progress') {
      return [...projects].sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));
    }
    return projects;
  }, [projects, sortKey]);

  const featured = sortedProjects[0] ?? FALLBACK_FEATURED;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-12">
      <FeaturedProjectHero project={featured} />

      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              DiscoverDiscover
            </h2>
            <p className="text-sm text-slate-500">精选社区发起的优质项目，发现与你同频的使命。</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full bg-slate-100 p-1">
              {sortTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSortKey(tab.key)}
                  className={`rounded-full px-4 py-1 text-sm font-medium transition ${sortKey === tab.key ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                  disabled={sortKey === tab.key}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <Button asChild variant="outline" className="rounded-full px-5">
              <Link href="/projects">查看全部</Link>
            </Button>
          </div>
        </div>

        {isError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">
            Worker 暂不可用，正在尝试直接链上回退。请稍后刷新。
          </div>
        )}

        {isLoading && projects.length === 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                className="h-64 animate-pulse rounded-[28px] bg-slate-200/60"
              />
            ))}
          </div>
        ) : (
          <ProjectList projects={sortedProjects} />
        )}

        {projects.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-400">
              数据来源：{source === 'edge' ? '边缘缓存' : '链上回退'}
            </p>
            <div className="flex items-center justify-center">
              <Button
                onClick={loadMore}
                disabled={!hasMore || isLoading}
                variant="outline"
                className="rounded-full px-6"
              >
                {hasMore ? (isLoading ? '加载中...' : '加载更多') : '没有更多项目'}
              </Button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
