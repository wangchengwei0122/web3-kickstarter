'use client';

import { useAccount, useBalance, useContractRead } from 'wagmi';
import { counterAbi } from '@/lib/abi';
import { counterAddress } from '@/lib/abi/Counter-address';

export default function DemoPage() {
  const { address } = useAccount();
  const { data: balance } = useBalance({
    address: address,
  });

  const { data: number } = useContractRead({
    address: counterAddress,
    abi: counterAbi,
    functionName: 'getNumber',
  });

  console.log('number');
  console.log(number);

  return (
    <div>
      <div>Address: {address}</div>
      <div>Balance: {balance?.formatted}</div>
      {/* <div>Number: {number}</div> */}
    </div>
  );
}
