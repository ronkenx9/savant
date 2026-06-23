"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { zgGalileo, ZG_RPC } from "@/lib/chain";

const config = createConfig({
  chains: [zgGalileo],
  connectors: [injected()],
  transports: { [zgGalileo.id]: http(ZG_RPC) },
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
