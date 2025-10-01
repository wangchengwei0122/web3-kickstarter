'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';
import type { Address, Hash } from 'viem';
import { parseEther } from 'viem';
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { campaignFactoryAbi } from '@packages/contracts/abi';
import deployment from '../../../../packages/contracts/deployments/31337.json';

const categories = ['科技', '艺术', '教育', '环境', '社会影响', '生活方式'];

const formHint = '填写项目信息后提交，上链即可创建新的众筹合约。';

const controlClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100';

type DeploymentManifest = {
  chainId: number;
  factory: `0x${string}`;
  deployBlock: number;
};

const manifest = deployment as DeploymentManifest;

function resolveFactory(): Address {
  const envAddress = process.env.NEXT_PUBLIC_FACTORY;
  if (envAddress && /^0x[a-fA-F0-9]{40}$/.test(envAddress)) {
    return envAddress as Address;
  }
  return manifest.factory as Address;
}

export default function CreatePage() {
  const factoryAddress = useMemo(resolveFactory, []);
  const { isConnected } = useAccount();

  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    writeContractAsync,
    isPending: isWriting,
    error: writeError,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash: txHash ?? undefined });

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFormError(null);

      const form = new FormData(event.currentTarget);
      const title = (form.get('title') as string)?.trim();
      const tagline = (form.get('tagline') as string)?.trim();
      const description = (form.get('description') as string)?.trim();
      const goalInput = (form.get('goal') as string)?.trim();
      const deadlineInput = (form.get('deadline') as string)?.trim();
      const metadataURI = (form.get('metadata') as string)?.trim();

      if (!title || !tagline || !description) {
        setFormError('请完整填写项目标题、宣传语与详情。');
        return;
      }
      if (!goalInput || Number(goalInput) <= 0) {
        setFormError('请填写有效的目标金额 (ETH)。');
        return;
      }
      if (!deadlineInput) {
        setFormError('请选择截止日期。');
        return;
      }
      const deadline = Math.floor(new Date(`${deadlineInput}T00:00:00Z`).getTime() / 1000);
      if (!Number.isFinite(deadline) || deadline <= Math.floor(Date.now() / 1000)) {
        setFormError('截止日期必须晚于当前时间。');
        return;
      }
      if (!metadataURI) {
        setFormError('请提供项目元数据 URI (例如 IPFS 链接)。');
        return;
      }

      try {
        const goal = parseEther(goalInput);
        const hash = await writeContractAsync({
          address: factoryAddress,
          abi: campaignFactoryAbi,
          functionName: 'createCampaign',
          args: [goal, BigInt(deadline), metadataURI],
        });
        setTxHash(hash);
      } catch (error) {
        if (error instanceof Error) {
          setFormError(error.message);
        } else {
          setFormError('交易提交失败，请稍后重试。');
        }
      }
    },
    [factoryAddress, writeContractAsync]
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-sky-500">Create</p>
        <h1 className="text-3xl font-semibold text-slate-900">发起全新的众筹项目</h1>
        <p className="text-sm text-slate-500">{formHint}</p>
      </header>

      <form className="grid gap-8" aria-labelledby="create-project-form" onSubmit={handleSubmit}>
        <Card className="rounded-[28px] border-0 bg-white shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5">
          <CardHeader className="px-8">
            <CardTitle className="text-xl text-slate-900">项目概览</CardTitle>
            <CardDescription className="text-sm text-slate-500">
              提供标题、简介与详细描述，帮助支持者了解你的核心理念。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-8 pb-8">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="title">
                项目标题
              </label>
              <Input id="title" name="title" placeholder="例如：下一代可持续能源电池" className="h-11 rounded-xl px-4" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="tagline">
                宣传语 / 简短介绍
              </label>
              <Input id="tagline" name="tagline" placeholder="一句话告诉大家你的项目亮点" className="h-11 rounded-xl px-4" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="description">
                项目详情
              </label>
              <textarea
                id="description"
                name="description"
                rows={5}
                placeholder="展开介绍项目背景、愿景与核心计划..."
                className={`${controlClass} resize-none`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-0 bg-white shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5">
          <CardHeader className="px-8">
            <CardTitle className="text-xl text-slate-900">融资目标</CardTitle>
            <CardDescription className="text-sm text-slate-500">
              设置众筹目标金额与关键节点，确保时间线清晰可信。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-8 pb-8">
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="goal">
                  目标金额 (ETH)
                </label>
                <Input id="goal" name="goal" placeholder="10" className="h-11 rounded-xl px-4" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="deadline">
                  截止日期
                </label>
                <Input id="deadline" name="deadline" type="date" className="h-11 rounded-xl px-4" />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="milestone">
                关键里程碑
              </label>
              <textarea
                id="milestone"
                name="milestone"
                rows={3}
                placeholder="列出达成目标所需的阶段性任务或成果..."
                className={`${controlClass} resize-none`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-0 bg-white shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5">
          <CardHeader className="px-8">
            <CardTitle className="text-xl text-slate-900">展示与分类</CardTitle>
            <CardDescription className="text-sm text-slate-500">
              上传封面、选择分类并提供对外展示的媒体链接。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-8 pb-8">
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="category">
                  项目分类
                </label>
                <select id="category" name="category" className={controlClass} defaultValue="科技">
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="cover">
                  封面图片 URL
                </label>
                <Input id="cover" name="cover" placeholder="https://..." className="h-11 rounded-xl px-4" />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="metadata">
                元数据 URI
              </label>
              <Input id="metadata" name="metadata" placeholder="ipfs://your-metadata.json" className="h-11 rounded-xl px-4" />
            </div>
            <p className="text-xs text-slate-400">
              提示：正式发布前，请确保元数据可被公开访问并符合平台规范。
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 rounded-[28px] border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          <span className="text-base font-medium text-slate-800">项目发布</span>
          <p>提交后将发起链上交易，由工厂合约创建新的 Campaign 并纳入索引。</p>
          {formError && <p className="text-sm text-rose-500">{formError}</p>}
          {writeError && !formError && <p className="text-sm text-rose-500">{writeError.message}</p>}
          {txHash && (
            <div className="rounded-2xl bg-slate-100 p-4 text-xs text-slate-600">
              <p className="font-medium text-slate-700">交易哈希</p>
              <p className="break-all">{txHash}</p>
              {receipt && (
                <p className="mt-2 text-slate-500">
                  区块：{Number(receipt.blockNumber)} · Gas：{receipt.gasUsed?.toString()}
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={!isConnected || isWriting || isConfirming} className="rounded-full px-6">
              {isWriting || isConfirming ? '提交中...' : isSuccess ? '已创建' : '提交创建'}
            </Button>
            <Button asChild variant="outline" className="rounded-full px-6">
              <Link href="/">返回首页</Link>
            </Button>
          </div>
          {!isConnected && <p className="text-xs text-slate-400">请先连接钱包以提交交易。</p>}
        </div>
      </form>
    </main>
  );
}
