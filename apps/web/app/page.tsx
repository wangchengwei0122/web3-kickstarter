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
  title: 'Eco-Friendly Urban Agriculture Plan',
  summary:
    'Support the construction of smart vertical farms in urban communities, promote green diet and community sharing.',
  creator: 'GreenThumb DAO',
  goalAmount: 100000,
  pledgedAmount: 75000,
  deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 12).toISOString(),
  status: 'active',
  category: 'Sustainability',
  imageUrl:
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80',
};

const sortTabs = [
  { key: 'latest', label: 'Newest' },
  { key: 'deadline', label: 'Deadline' },
  { key: 'progress', label: 'Progress' },
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
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Discover</h2>
            <p className="text-sm text-slate-500">
              Discover high-quality projects initiated by the selected communities and find a
              mission that resonates with you.
            </p>
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
              <Link href="/projects">View All</Link>
            </Button>
          </div>
        </div>

        {isError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">
            Worker is temporarily unavailable, trying to fallback directly to chain. Please refresh
            later.
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
              Data source: {source === 'edge' ? 'Edge Cache' : 'Chain Fallback'}
            </p>
            <div className="flex items-center justify-center">
              <Button
                onClick={loadMore}
                disabled={!hasMore || isLoading}
                variant="outline"
                className="rounded-full px-6"
              >
                {hasMore ? (isLoading ? 'Loading...' : 'Load More') : 'No more projects'}
              </Button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
