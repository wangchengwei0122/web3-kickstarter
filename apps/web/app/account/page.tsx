'use client';
import Link from 'next/link';
import { useAccount, useBalance } from 'wagmi';
import { formatUnits } from 'viem';

import { Button } from '@/components/ui/button';

const profile = {
  address: '0x1234...abcd',
  balance: '100 ETH',
  avatar:
    'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=240&q=80',
  bio: '探索 Web3 众筹新可能，关注可持续与创意科技。',
};

const supportedProjects = [
  {
    title: 'Innovative Tech Gadget',
    category: 'Technology',
    description: 'A revolutionary gadget that simplifies daily tasks.',
    image:
      'https://images.unsplash.com/photo-1527430253228-e93688616381?auto=format&fit=crop&w=640&q=80',
  },
  {
    title: 'Digital Art Collection',
    category: 'Art',
    description: 'A curated collection of digital art pieces.',
    image:
      'https://images.unsplash.com/photo-1600267185393-e158a98703de?auto=format&fit=crop&w=640&q=80',
  },
];

const initiatedProjects = [
  {
    title: 'Eco-Friendly Initiative',
    category: 'Environment',
    description: 'A project focused on sustainable living and conservation.',
    image:
      'https://images.unsplash.com/photo-1427806208781-b36531cb09ef?auto=format&fit=crop&w=640&q=80',
  },
  {
    title: 'Educational Platform',
    category: 'Education',
    description: 'An online platform offering free educational resources.',
    image:
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=640&q=80',
  },
];

type ProjectCardProps = {
  title: string;
  category: string;
  description: string;
  image: string;
};

function ProjectCard({ title, category, description, image }: ProjectCardProps) {
  return (
    <article className="group flex flex-col gap-5 rounded-3xl bg-white p-6 shadow-lg shadow-slate-900/5 ring-1 ring-slate-900/5 transition hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-start gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
          <img src={image} alt={title} className="h-full w-full object-cover" />
        </div>
        <div className="flex-1 space-y-2">
          <span className="text-xs font-medium uppercase tracking-wide text-sky-500">
            {category}
          </span>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <div>
        <Button asChild variant="outline" className="rounded-full px-4 py-2 text-sm">
          <Link href="#">View Project</Link>
        </Button>
      </div>
    </article>
  );
}

function ProjectSection({ title, projects }: { title: string; projects: ProjectCardProps[] }) {
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <Button variant="ghost" className="text-sm text-slate-500 hover:text-slate-900">
          查看全部
        </Button>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {projects.map((project) => (
          <ProjectCard key={project.title} {...project} />
        ))}
      </div>
    </section>
  );
}

export default function AccountPage() {
  const { address } = useAccount();
  const { data: balance } = useBalance({ address });

  console.log(balance);
  console.log(balance?.value);
  console.log(balance?.decimals);
  console.log(balance?.formatted);
  if (balance) {
    console.log(formatUnits(balance.value, balance.decimals));
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-12">
      <section className="rounded-[32px] bg-white p-8 shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 overflow-hidden rounded-full bg-slate-100">
              <img src={profile.avatar} alt="Profile" className="h-full w-full object-cover" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-slate-900">{address}</h1>
              <p className="text-sm text-slate-500">
                Balance: {balance ? formatUnits(balance.value, balance.decimals) : '—'}
              </p>
              <p className="text-sm text-slate-500">{balance?.symbol}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="rounded-full px-5">
              编辑资料
            </Button>
            <Button className="rounded-full px-5">Create</Button>
          </div>
        </div>
      </section>

      <ProjectSection title="我支持的项目" projects={supportedProjects} />
      <ProjectSection title="我发起的项目" projects={initiatedProjects} />
    </main>
  );
}
