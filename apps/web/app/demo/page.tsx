'use client';
import { useState, useEffect } from 'react';
import {
  useAccount,
  useBalance,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  usePublicClient,
} from 'wagmi';
import { counterAbi } from '@/lib/abi';
import { counterAddress } from '@/lib/abi/Counter-address';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/button';

export default function DemoPage() {
  const { address } = useAccount();
  const { writeContract, writeContractAsync, isPending } = useWriteContract();

  const { data: balance } = useBalance({
    address: address,
  });
  const { data: number, refetch: refetchNumber } = useReadContract({
    address: counterAddress,
    abi: counterAbi,
    functionName: 'getNumber',
  });

  const [hash, setHash] = useState<`0x${string}` | undefined>();

  const increment = async () => {
    const hash = await writeContractAsync({
      address: counterAddress,
      abi: counterAbi,
      functionName: 'increment',
    });
    // console.log(hash);
    setHash(hash);
  };
  const { data: receipt, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  useEffect(() => {
    if (isSuccess) {
      refetchNumber();
    }
  }, [isSuccess, refetchNumber]);

  const publicClient = usePublicClient();
  const [fromBlock, setFromBlock] = useState<bigint | undefined>();

  useEffect(() => {
    (async () => {
      const latest = await publicClient.getBlockNumber();
      setFromBlock(latest); // 或 latest - 200n：还能补最近历史
    })();
  }, [publicClient]);

  //   const pc = usePublicClient();
  //   console.log('[transport]', pc.transport?.type, pc.transport);

  useWatchContractEvent({
    address: counterAddress,
    abi: counterAbi,
    eventName: 'NumberSet',
    poll: true,
    fromBlock,
    enabled: fromBlock !== null,
    pollingInterval: 1000,
    onLogs: (logs) => {
      console.log('NumberSet');
      console.log(logs);

      //   if (!hash) return;
      //   // 找到这批里是否包含我这笔交易
      //   const hit = logs.some((l) => l.transactionHash === hash);
      //   if (hit) {
      //     refetchNumber();
      //     setHash(undefined); // 用完清空，避免重复匹配
      //   }
    },
    onError: (err) => {
      console.error('watch error:', err); // 关键：看是不是 eth_getLogs 不支持 / rate limit / filter 错误
    },
  });

  return (
    <div>
      <ConnectButton />
      <div>Address: {address}</div>
      <div>Balance: {balance?.formatted}</div>
      <div>Number: {number?.toString()}</div>.
      <Button onClick={() => increment()}>{isPending ? 'loading' : 'Increment'}</Button>
    </div>
  );
}
