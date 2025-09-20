// apps/web/lib/abi.ts
import type { Abi } from 'viem';
import counterJson from '../../../packages/contracts/out/Counter.sol/Counter.json' assert { type: 'json' };


export const counterAbi = counterJson.abi as Abi;
