'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';

import { getConfig } from './wagmi';

import '@rainbow-me/rainbowkit/styles.css';

type Web3ProviderProps = {
  children: ReactNode;
};

export function Web3Provider({ children }: Web3ProviderProps) {
  const [config] = useState(() => getConfig());
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
