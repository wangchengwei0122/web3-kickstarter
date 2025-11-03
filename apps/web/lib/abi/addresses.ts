import type { Address } from 'viem';

// Environment-driven accessors for contract addresses.
// 更新合约部署时，只需调整 NEXT_PUBLIC_* 环境变量，无需改代码。

function requireAddress(value: string | undefined, label: string): Address {
  if (!value || value.trim().length === 0) {
    throw new Error(`${label} is not configured`);
  }
  const trimmed = value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    throw new Error(`${label} must be a valid address`);
  }
  return trimmed as Address;
}

function optionalAddress(value: string | undefined): Address | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return trimmed as Address;
  }
  return null;
}

export function getCampaignFactoryAddress(): Address {
  return requireAddress(process.env.NEXT_PUBLIC_FACTORY, 'NEXT_PUBLIC_FACTORY');
}

export function getSampleCampaignAddress(): Address | null {
  return optionalAddress(process.env.NEXT_PUBLIC_SAMPLE_CAMPAIGN);
}
