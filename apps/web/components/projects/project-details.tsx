'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Address, Hash } from 'viem';
import { parseEther } from 'viem';
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { campaignAbi } from '@packages/contracts/abi';

import type { ProjectDetail } from './types';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'USD',
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

const statusClassName: Record<ProjectDetail['status'], string> = {
  active: 'bg-blue-100 text-blue-600',
  successful: 'bg-emerald-100 text-emerald-600',
  failed: 'bg-rose-100 text-rose-600',
  cancelled: 'bg-slate-100 text-slate-500',
};

const statusLabel: Record<ProjectDetail['status'], string> = {
  active: '进行中',
  successful: '已成功',
  failed: '未达成',
  cancelled: '已取消',
};

export type ProjectDetailsProps = {
  project: ProjectDetail;
};

const presetSupportAmounts = [50, 100, 250, 500];

export function ProjectDetails({ project }: ProjectDetailsProps) {
  const progress = getProgressValue(project.goalAmount, project.pledgedAmount);
  const daysLeft = getDaysLeft(project.deadline);
  const { isConnected } = useAccount();
  const [amountInput, setAmountInput] = useState<string>('');
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [lastTxHash, setLastTxHash] = useState<Hash | null>(null);

  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
  });

  const isProcessing = isWriting || isConfirming;
  const isProjectOpen = project.status === 'active' && daysLeft > 0;

  const campaignAddress = useMemo(() => project.id as Address, [project.id]);

  const handlePresetSelect = useCallback((value: number) => {
    setAmountInput(value.toString());
    setActivePreset(value);
    setFormError(null);
    setFeedback(null);
  }, []);

  const handleAmountChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setAmountInput(event.target.value);
    setActivePreset(null);
    setFormError(null);
    setFeedback(null);
  }, []);

  const handleSupport = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFormError(null);
      setFeedback(null);
      setLastTxHash(null);

      const trimmed = amountInput.trim();

      if (!trimmed) {
        setFormError('请选择或输入支持金额。');
        return;
      }

      if (!isConnected) {
        setFormError('请先连接钱包后再支持项目。');
        return;
      }

      let weiAmount: bigint;
      try {
        weiAmount = parseEther(trimmed);
      } catch {
        setFormError('请输入有效的金额（支持最多 18 位小数）。');
        return;
      }

      if (weiAmount <= 0n) {
        setFormError('支持金额必须大于 0。');
        return;
      }

      try {
        const hash = await writeContractAsync({
          address: campaignAddress,
          abi: campaignAbi,
          functionName: 'pledge',
          value: weiAmount,
          args: [], //
        });
        setTxHash(hash);
      } catch (error) {
        if (error instanceof Error) {
          setFormError(error.message);
        } else {
          setFormError('交易提交失败，请稍后再试。');
        }
      }
    },
    [amountInput, campaignAddress, isConnected, writeContractAsync]
  );

  useEffect(() => {
    if (isSuccess && txHash) {
      setFeedback('支持成功，交易已确认。');
      setAmountInput('');
      setActivePreset(null);
      setLastTxHash(txHash);
      setTxHash(null);
    }
  }, [isSuccess, txHash]);

  return (
    <article className="space-y-10">
      <div className="overflow-hidden rounded-[32px] bg-white shadow-xl shadow-blue-950/5 ring-1 ring-slate-900/5">
        <img src={project.imageUrl} alt={project.title} className="h-full w-full object-cover" />
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
              <Badge
                className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClassName[project.status]}`}
              >
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
                  <p className="text-xs">
                    {daysLeft} 天剩余 · {project.backerCount} 位支持者
                  </p>
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
          <form
            className="rounded-[28px] bg-white p-6 shadow-lg shadow-blue-950/5 ring-1 ring-slate-900/5"
            onSubmit={handleSupport}
          >
            <h2 className="text-lg font-semibold text-slate-900">支持项目</h2>
            <p className="mt-2 text-sm text-slate-500">你的每一笔支持都将直接用于项目建设。</p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {presetSupportAmounts.map((amount) => {
                const isActive = activePreset === amount;
                return (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => handlePresetSelect(amount)}
                    className={cn(
                      'rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition',
                      'hover:border-sky-400 hover:text-sky-500',
                      isActive && 'border-sky-500 bg-sky-50 text-sky-600'
                    )}
                    disabled={!isProjectOpen || isProcessing}
                  >
                    ${amount}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 space-y-3">
              <label className="text-xs font-medium text-slate-500" htmlFor="support-amount">
                自定义支持金额 (USD)
              </label>
              <Input
                id="support-amount"
                type="number"
                min="0"
                step="any"
                placeholder="50"
                className="h-11 rounded-full border-slate-200"
                value={amountInput}
                onChange={handleAmountChange}
                disabled={!isProjectOpen || isProcessing}
              />
            </div>

            {formError ? (
              <p className="mt-3 text-xs text-rose-500">{formError}</p>
            ) : feedback ? (
              <p className="mt-3 text-xs text-emerald-600">
                {feedback}
                {lastTxHash ? (
                  <>
                    {' '}
                    <span className="break-all text-[11px] text-emerald-500">{lastTxHash}</span>
                  </>
                ) : null}
              </p>
            ) : null}

            {!isProjectOpen ? (
              <p className="mt-3 text-xs text-slate-400">该项目已结束或不可支持。</p>
            ) : null}

            <Button
              className="mt-6 w-full rounded-full text-sm"
              type="submit"
              disabled={!isProjectOpen || isProcessing}
            >
              {isProcessing ? '交易确认中...' : '现在支持'}
            </Button>

            <p className="mt-3 text-center text-xs text-slate-400">
              你的支持将用于项目执行，不可退回。
            </p>
          </form>

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
