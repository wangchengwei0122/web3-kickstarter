'use client';
import { useState, useEffect } from 'react';
import {
  useAccount,
  useBalance,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
} from 'wagmi';
import { counterAbi } from '@/lib/abi';
import { counterAddress } from '@/lib/abi/Counter-address';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/button';

export default function DemoPage() {
  const { address } = useAccount();
  const { data: balance } = useBalance({ address });
  const { writeContractAsync, isPending } = useWriteContract();

  const { data: number, refetch: refetchNumber } = useReadContract({
    address: counterAddress,
    abi: counterAbi,
    functionName: 'getNumber',
  });

  const [hash, setHash] = useState<`0x${string}` | undefined>();

  // 方式一：主动等待特定交易完成 (非常可靠)
  const { isSuccess } = useWaitForTransactionReceipt({ hash });
  useEffect(() => {
    if (isSuccess) {
      console.log('Transaction confirmed, refetching number...');
      refetchNumber();
      setHash(undefined); // 清理hash，防止重复触发
    }
  }, [isSuccess, refetchNumber]);

  const increment = async () => {
    try {
      const txHash = await writeContractAsync({
        address: counterAddress,
        abi: counterAbi,
        functionName: 'increment',
      });
      setHash(txHash);
    } catch (error) {
      console.error('Failed to send transaction:', error);
    }
  };

  // 方式二：被动监听所有相关事件 (保持应用实时同步)
  useWatchContractEvent({
    address: counterAddress,
    abi: counterAbi,
    eventName: 'NumberSet',
    onLogs: (logs) => {
      console.log('✅ Event "NumberSet" detected!', logs);

      refetchNumber();
    },
    onError: (error) => {
      console.error('Error watching contract event:', error);
    },
  });

  return (
    <div>
      <ConnectButton />
      <div>Address: {address}</div>
      <div>Balance: {balance?.formatted}</div>
      <div>Number: {number?.toString()}</div>
      <Button onClick={increment} disabled={isPending}>
        {isPending ? 'Confirming...' : 'Increment'}
      </Button>
    </div>
  );
}
