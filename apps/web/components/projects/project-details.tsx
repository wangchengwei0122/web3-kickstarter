'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Address, Hash } from 'viem';
import { formatEther, parseEther } from 'viem';
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { campaignAbi } from '@/lib/abi';
import { useBackers } from '@/src/hooks/useBackers';

import type { ProjectDetail } from './types';

function formatEth(value: number) {
  const formatted = value.toLocaleString('zh-CN', {
    minimumFractionDigits: value >= 1 ? 0 : 2,
    maximumFractionDigits: 4,
  });
  return `${formatted} ETH`;
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
  active: 'In Progress',
  successful: 'Successful',
  failed: 'Not Achieved',
  cancelled: 'Cancelled',
};

export type ProjectDetailsProps = {
  project: ProjectDetail;
};

const presetSupportAmounts = [0.05, 0.1, 0.5, 1];

type TabType = 'intro' | 'updates' | 'backers';

export function ProjectDetails({ project }: ProjectDetailsProps) {
  const progress = getProgressValue(project.goalAmount, project.pledgedAmount);
  const daysLeft = getDaysLeft(project.deadline);
  const { isConnected, address } = useAccount();
  const [activeTab, setActiveTab] = useState<TabType>('intro');
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

  const hasReachedGoal = project.goalAmount > 0 && project.pledgedAmount >= project.goalAmount;
  const derivedStatus: ProjectDetail['status'] =
    project.status === 'active' && hasReachedGoal ? 'successful' : project.status;

  const isProcessing = isWriting || isConfirming;
  const isProjectOpen = project.status === 'active' && daysLeft > 0 && !hasReachedGoal;

  const campaignAddress = useMemo(() => project.id as Address, [project.id]);

  // 读取当前用户的出资额
  const {
    data: userPledgeData,
    refetch: refetchUserPledge,
    isPending: isReadingPledge,
  } = useReadContract({
    address: campaignAddress,
    abi: campaignAbi,
    functionName: 'pledges',
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address),
    },
  });

  const userPledgeWei = (userPledgeData as bigint | undefined) ?? 0n;
  const userPledgeEthNum = Number(formatEther(userPledgeWei));

  const canUnpledge = userPledgeWei > 0n && project.status === 'active' && daysLeft > 0;
  const canRefund =
    userPledgeWei > 0n && (derivedStatus === 'failed' || (daysLeft === 0 && !hasReachedGoal));

  // 获取 backers 列表
  const {
    data: backers = [],
    isLoading: isLoadingBackers,
    refetch: refetchBackers,
  } = useBackers(campaignAddress);

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
        setFormError('Please select or enter the support amount.');
        return;
      }

      if (!isConnected) {
        setFormError('Please connect your wallet before supporting the project.');
        return;
      }

      let weiAmount: bigint;
      try {
        weiAmount = parseEther(trimmed);
      } catch {
        setFormError('Please enter a valid amount (support up to 18 decimal places).');
        return;
      }

      if (weiAmount <= 0n) {
        setFormError('Support amount must be greater than 0.');
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
        // 出资成功后刷新个人出资
        void refetchUserPledge();
      } catch (error) {
        if (error instanceof Error) {
          setFormError(error.message);
        } else {
          setFormError('Transaction submission failed, please try again later.');
        }
      }
    },
    [amountInput, campaignAddress, isConnected, writeContractAsync, refetchUserPledge]
  );

  const handleRefund = useCallback(async () => {
    setFormError(null);
    setFeedback(null);
    setLastTxHash(null);

    if (!isConnected) {
      setFormError('Please connect your wallet before operating.');
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: campaignAddress,
        abi: campaignAbi,
        functionName: 'refund',
        args: [],
      });
      setTxHash(hash);
      void refetchUserPledge();
    } catch (error) {
      if (error instanceof Error) {
        setFormError(error.message);
      } else {
        setFormError('Transaction submission failed, please try again later.');
      }
    }
  }, [campaignAddress, isConnected, refetchUserPledge, writeContractAsync]);

  const handleUnpledgeAll = useCallback(async () => {
    setFormError(null);
    setFeedback(null);
    setLastTxHash(null);

    if (!isConnected) {
      setFormError('Please connect your wallet before operating.');
      return;
    }

    if (userPledgeWei <= 0n) {
      setFormError('No pledge to unpledge.');
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: campaignAddress,
        abi: campaignAbi,
        functionName: 'unpledge',
        args: [userPledgeWei],
      });
      setTxHash(hash);
      void refetchUserPledge();
    } catch (error) {
      if (error instanceof Error) {
        setFormError(error.message);
      } else {
        setFormError('Transaction submission failed, please try again later.');
      }
    }
  }, [campaignAddress, isConnected, userPledgeWei, refetchUserPledge, writeContractAsync]);

  useEffect(() => {
    if (isSuccess && txHash) {
      setFeedback('Transaction confirmed.');
      setAmountInput('');
      setActivePreset(null);
      setLastTxHash(txHash);
      setTxHash(null);
      void refetchUserPledge();
      void refetchBackers();
    }
  }, [isSuccess, txHash, refetchUserPledge, refetchBackers]);

  return (
    <article className="space-y-10">
      <div className="overflow-hidden rounded-[32px] bg-white shadow-xl shadow-blue-950/5 ring-1 ring-slate-900/5">
        <img src={project.imageUrl} alt={project.title} className="h-full w-full object-cover" />
      </div>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="rounded-[28px] bg-white p-8 shadow-lg shadow-blue-950/5 ring-1 ring-slate-900/5">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span>Campaign ID：{project.id}</span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {project.category}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                {project.title}
              </h1>
              <Badge
                className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClassName[derivedStatus]}`}
              >
                {statusLabel[derivedStatus]}
              </Badge>
            </div>

            <p className="mt-4 text-base leading-relaxed text-slate-600">{project.summary}</p>

            <div className="mt-8 grid gap-6 rounded-[24px] bg-slate-50 p-6">
              <div className="grid gap-6 text-sm text-slate-500 md:grid-cols-2">
                <div>
                  <p className="text-slate-400">Pledged Amount</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {formatEth(project.pledgedAmount)}
                  </p>
                  <p className="text-xs">Completed {Math.round(progress * 100)}%</p>
                </div>
                <div>
                  <p className="text-slate-400">Goal Amount</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {formatEth(project.goalAmount)}
                  </p>
                  <p className="text-xs">
                    {daysLeft} days left · {project.backerCount} backers
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
            <nav className="flex flex-wrap gap-6 text-sm font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('intro')}
                className={cn(
                  'transition hover:text-slate-900',
                  activeTab === 'intro' ? 'text-slate-900' : 'text-slate-500'
                )}
              >
                Project Introduction
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('updates')}
                className={cn(
                  'transition hover:text-slate-900',
                  activeTab === 'updates' ? 'text-slate-900' : 'text-slate-500'
                )}
              >
                Progress Updates
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('backers')}
                className={cn(
                  'transition hover:text-slate-900',
                  activeTab === 'backers' ? 'text-slate-900' : 'text-slate-500'
                )}
              >
                Backers
              </button>
            </nav>

            <div className="mt-6">
              {activeTab === 'intro' && (
                <div className="whitespace-pre-line text-base leading-relaxed text-slate-600">
                  {project.description}
                </div>
              )}

              {activeTab === 'updates' && (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-slate-50 p-6">
                    <h3 className="text-lg font-semibold text-slate-900">Funding Progress</h3>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Current Progress</span>
                        <span className="font-semibold text-slate-900">
                          {Math.round(progress * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Pledged Amount</span>
                        <span className="font-semibold text-slate-900">
                          {formatEth(project.pledgedAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Goal Amount</span>
                        <span className="font-semibold text-slate-900">
                          {formatEth(project.goalAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Remaining Amount</span>
                        <span className="font-semibold text-slate-900">
                          {formatEth(Math.max(0, project.goalAmount - project.pledgedAmount))}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-6">
                    <h3 className="text-lg font-semibold text-slate-900">Timeline</h3>
                    <div className="mt-4 space-y-3">
                      <div className="text-sm text-slate-600">
                        <p className="font-medium text-slate-900">Campaign Status</p>
                        <p className="mt-1">
                          {derivedStatus === 'active' && daysLeft > 0
                            ? `Active - ${daysLeft} days remaining`
                            : derivedStatus === 'active' && daysLeft === 0
                              ? 'Deadline reached, awaiting finalization'
                              : derivedStatus === 'successful'
                                ? 'Campaign successfully reached its goal!'
                                : derivedStatus === 'failed'
                                  ? 'Campaign did not reach its goal'
                                  : 'Campaign has been cancelled'}
                        </p>
                      </div>
                      {backers.length > 0 && (
                        <div className="text-sm text-slate-600">
                          <p className="font-medium text-slate-900">Latest Activity</p>
                          <p className="mt-1">
                            {backers.length} backer{backers.length !== 1 ? 's' : ''} have supported
                            this project
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {backers.length === 0 && !isLoadingBackers && (
                    <p className="text-center text-sm text-slate-400">
                      No activity yet. Be the first to support this project!
                    </p>
                  )}
                </div>
              )}

              {activeTab === 'backers' && (
                <div className="space-y-4">
                  {isLoadingBackers ? (
                    <div className="py-8 text-center text-sm text-slate-500">
                      Loading backers...
                    </div>
                  ) : backers.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-400">
                      No backers yet. Be the first to support this project!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600">
                        Total Backers:{' '}
                        <span className="font-semibold text-slate-900">{backers.length}</span>
                      </p>
                      <div className="space-y-2 divide-y divide-slate-200">
                        {backers.map((backer, index) => (
                          <div key={`${backer.txHash}-${index}`} className="py-3 first:pt-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-slate-900">
                                  {backer.address.slice(0, 6)}...{backer.address.slice(-4)}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {new Date(backer.timestamp * 1000).toLocaleString('zh-CN', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-slate-900">
                                  {formatEth(Number(backer.amount))}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <form
            className="rounded-[28px] bg-white p-6 shadow-lg shadow-blue-950/5 ring-1 ring-slate-900/5"
            onSubmit={handleSupport}
          >
            <h2 className="text-lg font-semibold text-slate-900">Support the Project</h2>
            <p className="mt-2 text-sm text-slate-500">
              Your every support will be directly used for the project.
            </p>

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
                    {amount}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 space-y-3">
              <label className="text-xs font-medium text-slate-500" htmlFor="support-amount">
                Custom Support Amount (ETH)
              </label>
              <Input
                id="support-amount"
                type="number"
                min="0"
                step="any"
                placeholder="0.1"
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
              <p className="mt-3 text-xs text-slate-400">
                This project has ended or is not supported.
              </p>
            ) : null}

            <Button
              className="mt-6 w-full rounded-full text-sm"
              type="submit"
              disabled={!isProjectOpen || isProcessing}
            >
              {isProcessing ? 'Transaction Confirming...' : 'Support Now'}
            </Button>

            <p className="mt-3 text-center text-xs text-slate-400">
              Your support will be used for project execution, and cannot be refunded.
            </p>
          </form>

          {/* 当前账户出资与操作 */}
          <Card className="rounded-[28px] border-0 bg-white p-6 shadow-lg shadow-blue-950/5 ring-1 ring-slate-900/5">
            <CardHeader className="px-0">
              <CardTitle className="text-lg font-semibold text-slate-900">My Pledge</CardTitle>
            </CardHeader>
            <CardContent className="px-0 text-sm text-slate-500">
              {isConnected ? (
                <div className="space-y-3">
                  <p className="text-slate-600">
                    {isReadingPledge
                      ? 'Loading...'
                      : `You have pledged: ${formatEth(userPledgeEthNum)}`}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      className="rounded-full text-sm"
                      variant="secondary"
                      onClick={handleUnpledgeAll}
                      disabled={!canUnpledge || isProcessing}
                    >
                      {isProcessing ? 'Processing...' : 'Unpledge All'}
                    </Button>
                    <Button
                      className="rounded-full text-sm"
                      onClick={handleRefund}
                      disabled={!canRefund || isProcessing}
                    >
                      {isProcessing ? 'Processing...' : 'Refund'}
                    </Button>
                  </div>
                  {!canUnpledge &&
                  project.status === 'active' &&
                  daysLeft > 0 &&
                  userPledgeWei === 0n ? (
                    <p className="text-xs text-slate-400">No pledge yet.</p>
                  ) : null}
                  {!canRefund && daysLeft === 0 && !hasReachedGoal && userPledgeWei === 0n ? (
                    <p className="text-xs text-slate-400">No pledge to refund.</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-slate-400">Connect wallet to view your pledge.</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-0 bg-white p-6 shadow-lg shadow-blue-950/5 ring-1 ring-slate-900/5">
            <CardHeader className="px-0">
              <CardTitle className="text-lg font-semibold text-slate-900">
                Project Creator Information
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 text-sm text-slate-500">
              <dl className="space-y-4">
                <div className="space-y-1">
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Project Owner</dt>
                  <dd className="font-medium text-slate-900">{project.creator}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs uppercase tracking-wide text-slate-400">
                    Project Creator Address
                  </dt>
                  <dd className="whitespace-pre break-all font-medium text-slate-900">
                    {project.owner}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs uppercase tracking-wide text-slate-400">
                    Project Category
                  </dt>
                  <dd className="whitespace-pre break-all font-medium text-slate-900">
                    {project.category}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </aside>
      </section>
    </article>
  );
}
