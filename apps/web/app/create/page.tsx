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
import { campaignFactoryAbi } from '@lib/abi';

const categories = ['Technology', 'Art', 'Education', 'Environment', 'Social Impact', 'Lifestyle'];

const formHint =
  'Fill in the project information and submit to create a new crowdfunding contract on-chain.';

const controlClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100';

function resolveFactory(): Address {
  const envAddress = process.env.NEXT_PUBLIC_FACTORY;
  if (!envAddress || !/^0x[a-fA-F0-9]{40}$/.test(envAddress)) {
    throw new Error('NEXT_PUBLIC_FACTORY is not configured or invalid.');
  }
  return envAddress as Address;
}

export default function CreatePage() {
  const factoryAddress = useMemo(resolveFactory, []);
  const { isConnected } = useAccount();

  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isUploadingMetadata, setIsUploadingMetadata] = useState(false);

  const { writeContractAsync, isPending: isWriting, error: writeError } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash: txHash ?? undefined });

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFormError(null);
      setTxHash(null);

      const form = new FormData(event.currentTarget);
      const title = (form.get('title') as string)?.trim();
      const tagline = (form.get('tagline') as string)?.trim();
      const description = (form.get('description') as string)?.trim();
      const goalInput = (form.get('goal') as string)?.trim();
      const deadlineInput = (form.get('deadline') as string)?.trim();
      const categoryInput = (form.get('category') as string)?.trim();
      const cover = (form.get('cover') as string)?.trim();
      const milestoneInput = (form.get('milestone') as string)?.trim();
      const resolvedCategory =
        categoryInput && categoryInput.length > 0 ? categoryInput : categories[0];

      if (!title || !tagline || !description) {
        setFormError('Please fill in the project title, tagline, and description.');
        return;
      }
      if (!goalInput || Number(goalInput) <= 0) {
        setFormError('Please fill in a valid funding goal (ETH).');
        return;
      }
      if (!deadlineInput) {
        setFormError('Please select a deadline.');
        return;
      }
      const deadline = Math.floor(new Date(`${deadlineInput}T00:00:00Z`).getTime() / 1000);
      if (!Number.isFinite(deadline) || deadline <= Math.floor(Date.now() / 1000)) {
        setFormError('The deadline must be later than the current time.');
        return;
      }

      let goal: bigint;
      try {
        goal = parseEther(goalInput);
      } catch {
        setFormError('Please enter a valid goal amount (ETH).');
        return;
      }

      const milestones =
        milestoneInput
          ?.split('\n')
          .map((item) => item.trim())
          .filter((item): item is string => item.length > 0) ?? [];

      try {
        const metadataPayload = {
          version: '1.0.0',
          title,
          summary: tagline,
          tagline,
          description,
          category: resolvedCategory,
          ...(cover ? { image: cover, cover } : {}),
          ...(milestones.length > 0 ? { milestones } : {}),
          funding: {
            goalAmountEth: goalInput,
            goalAmountWei: goal.toString(),
            currency: 'ETH',
          },
          timeline: {
            deadline,
            deadlineISO: new Date(deadline * 1000).toISOString(),
          },
          createdAt: new Date().toISOString(),
        };

        const metadataFile = new File([JSON.stringify(metadataPayload, null, 2)], 'metadata.json', {
          type: 'application/json',
        });
        const uploadBody = new FormData();
        uploadBody.append('file', metadataFile);

        setIsUploadingMetadata(true);
        const response = await fetch('/api/metadata', {
          method: 'POST',
          body: uploadBody,
        });
        if (!response.ok) {
          throw new Error('Failed to upload project metadata. Please try again.');
        }
        const payload = (await response.json()) as { uri?: string; gatewayUrl?: string };
        const metadataURI = payload?.uri ?? payload?.gatewayUrl;
        if (!metadataURI) {
          throw new Error('Metadata upload did not return a valid URI.');
        }
        console.log('metadataURI', metadataURI);
        const hash = await writeContractAsync({
          address: factoryAddress,
          abi: campaignFactoryAbi,
          functionName: 'createCampaign',
          args: [goal, BigInt(deadline), metadataURI],
        });
        console.log('hash', hash);
        setTxHash(hash);
      } catch (error) {
        if (error instanceof Error) {
          setFormError(error.message);
        } else {
          setFormError('Transaction submission failed, please try again later.');
        }
      } finally {
        setIsUploadingMetadata(false);
      }
    },
    [factoryAddress, writeContractAsync]
  );

  const submitDisabled = !isConnected || isUploadingMetadata || isWriting || isConfirming;
  const submitLabel = isUploadingMetadata
    ? 'Uploading metadata...'
    : isWriting || isConfirming
      ? 'Submitting...'
      : isSuccess
        ? 'Created'
        : 'Submit Creation';

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-sky-500">Create</p>
        <h1 className="text-3xl font-semibold text-slate-900">Create</h1>
        <p className="text-sm text-slate-500">{formHint}</p>
      </header>

      <form className="grid gap-8" aria-labelledby="create-project-form" onSubmit={handleSubmit}>
        <Card className="rounded-[28px] border-0 bg-white shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5">
          <CardHeader className="px-8">
            <CardTitle className="text-xl text-slate-900">Project Overview</CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Provide title, tagline, and detailed description to help supporters understand your
              core vision.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-8 pb-8">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="title">
                Project Title
              </label>
              <Input
                id="title"
                name="title"
                placeholder="e.g., Next-generation Sustainable Energy Battery"
                className="h-11 rounded-xl px-4"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="tagline">
                Tagline / Brief Introduction
              </label>
              <Input
                id="tagline"
                name="tagline"
                placeholder="Tell everyone about your project highlights in one sentence"
                className="h-11 rounded-xl px-4"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="description">
                Project Details
              </label>
              <textarea
                id="description"
                name="description"
                rows={5}
                placeholder="Expand on project background, vision, and core plans..."
                className={`${controlClass} resize-none`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-0 bg-white shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5">
          <CardHeader className="px-8">
            <CardTitle className="text-xl text-slate-900">Funding Goal</CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Set crowdfunding goal amount and key milestones to ensure a clear and credible
              timeline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-8 pb-8">
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="goal">
                  Goal Amount (ETH)
                </label>
                <Input id="goal" name="goal" placeholder="10" className="h-11 rounded-xl px-4" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="deadline">
                  Deadline
                </label>
                <Input id="deadline" name="deadline" type="date" className="h-11 rounded-xl px-4" />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="milestone">
                Key Milestones
              </label>
              <textarea
                id="milestone"
                name="milestone"
                rows={3}
                placeholder="List the phased tasks or achievements needed to reach the goal..."
                className={`${controlClass} resize-none`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-0 bg-white shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5">
          <CardHeader className="px-8">
            <CardTitle className="text-xl text-slate-900">Display & Category</CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Upload cover image, select category, and provide media links for public display.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-8 pb-8">
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="category">
                  Project Category
                </label>
                <select
                  id="category"
                  name="category"
                  className={controlClass}
                  defaultValue="Technology"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="cover">
                  Cover Image URL
                </label>
                <Input
                  id="cover"
                  name="cover"
                  placeholder="https://..."
                  className="h-11 rounded-xl px-4"
                />
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Metadata will be generated and uploaded to IPFS automatically when you submit.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 rounded-[28px] border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          <span className="text-base font-medium text-slate-800">Project Launch</span>
          <p>
            After submission, an on-chain transaction will be initiated to create a new Campaign
            through the factory contract and include it in the index.
          </p>
          {formError && <p className="text-sm text-rose-500">{formError}</p>}
          {writeError && !formError && (
            <p className="text-sm text-rose-500">{writeError.message}</p>
          )}
          {txHash && (
            <div className="rounded-2xl bg-slate-100 p-4 text-xs text-slate-600">
              <p className="font-medium text-slate-700">Transaction Hash</p>
              <p className="break-all">{txHash}</p>
              {receipt && (
                <p className="mt-2 text-slate-500">
                  Block: {Number(receipt.blockNumber)} · Gas: {receipt.gasUsed?.toString()}
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={submitDisabled} className="rounded-full px-6">
              {submitLabel}
            </Button>
            <Button asChild variant="outline" className="rounded-full px-6">
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
          {isUploadingMetadata && (
            <p className="text-xs text-slate-400">Uploading metadata to IPFS...</p>
          )}
          {!isConnected && (
            <p className="text-xs text-slate-400">
              Please connect your wallet first to submit the transaction.
            </p>
          )}
        </div>
      </form>
    </main>
  );
}
