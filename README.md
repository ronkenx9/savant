# SAVANT

**Everyone uses AI agents differently. That difference is value. SAVANT lets you own it, prove it, and sell it.**

You talk to an AI agent your way — your risk tolerance, your decision style, your domains. Over time it learns: preferences distilled, strategy sharpened, personality calibrated. The result is a unique intelligence that didn't exist before you shaped it.

SAVANT makes that intelligence a tradeable asset. Your agent's trained state lives as an **INFT (Intelligent NFT) on 0G** — pinned to decentralized storage, anchored on-chain, transferable. List it for sale, and the buyer doesn't get a blank agent. They get *yours* — the one that already knows what it's doing.

Training agents to sell becomes a real economy. A 5% royalty flows back to the original trainer on every resale. The better you train, the more it's worth — and you keep earning as it changes hands.

## How it works

```
Mint → Train → Prove → Sell → Inherit
```

1. **Mint** a blank agent. It's an INFT on 0G — generic, knows nothing yet.
2. **Train** it through conversation. Each session distills into a versioned state doc (preferences, strategy, traits) and re-pins to 0G Storage. The intelligence meter climbs.
3. **Prove** it learned. Same benchmark prompt, before and after — side by side. The difference is visible.
4. **List** it for sale at your price.
5. **Buy** from another wallet. The INFT transfers — trained state and all.
6. **Inherit** the intelligence. The buyer pulls the trained state from 0G and gets the smart agent immediately.

## Why 0G

Remove 0G and there is no ownable, portable, sellable agent state — the product collapses to "a chatbot with a database."

| What | 0G component | Where |
|---|---|---|
| Persistent trained state | **0G Storage** | `app/src/lib/storage.ts` |
| Ownership + transfer | **INFT (ERC-7857)** | `contracts/src/AgentINFT.sol` |
| Inference | **Compute** (MVP: isolated LLM, 0G Compute swap-in) | `app/src/lib/inference.ts` |

## What "trained" means

Not gradient fine-tuning. A versioned **preference/strategy document** the agent accumulates through use: explicit preferences, LLM-inferred patterns, a strategy summary, and behavioral traits (tone, verbosity, risk posture, domain expertise). Behavior provably changes before vs. after — and the state is portable across owners.

## Project structure

```
contracts/       Foundry — AgentINFT.sol + tests + deploy script
app/             Next.js 15 + wagmi/viem
  src/lib/       chain · state · inference · storage
  src/app/api/   agent/init · chat · train · benchmark · state
  src/app/       page.tsx (six-beat UI + 0G Ledger)
```

## Run locally

```bash
# contracts
cd contracts && forge install && forge test

# app
cd app && pnpm install && pnpm dev
```

## Deploy

```bash
cd contracts
DEPLOYER_PRIVATE_KEY=0x... forge script script/Deploy.s.sol --rpc-url https://evmrpc-testnet.0g.ai --broadcast
# set NEXT_PUBLIC_CONTRACT_ADDRESS in app/.env.local
```

## Network

0G Galileo Testnet — Chain `16602` · [Explorer](https://chainscan-galileo.0g.ai) · [Storage Explorer](https://storagescan-galileo.0g.ai) · [Faucet](https://faucet.0g.ai)

---

Built for **The Zero Cup (0G)**.
