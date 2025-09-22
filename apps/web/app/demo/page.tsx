'use client';
import { useState } from 'react';
import {
  useAccount,
  useBalance,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
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
  const { data: number } = useReadContract({
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
    console.log(hash);
    setHash(hash);
  };
  useWaitForTransactionReceipt({
    hash,
    confirmations: 1,
    query: {
      enabled: !!hash,
      onSuccess: () => refetch(),
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
