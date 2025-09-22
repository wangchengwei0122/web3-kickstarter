import { cookieStorage, createConfig, createStorage, http, webSocket } from 'wagmi';
import { hardhat, mainnet, sepolia } from 'wagmi/chains';
import { coinbaseWallet, injected } from 'wagmi/connectors';

export function getConfig() {
  return createConfig({
    chains: [mainnet, sepolia, hardhat],
    connectors: [
      injected(),
      coinbaseWallet(),
      // walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID }),
    ],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      [mainnet.id]: http(),
      [sepolia.id]: http(),
      [hardhat.id]: webSocket('ws://127.0.0.1:8545'),
    },
  });
}

declare module 'wagmi' {
  interface Register {
    config: ReturnType<typeof getConfig>;
  }
}
