# SAVANT — Tradeable Trained Agents

> Own an AI that actually got smarter — and sell it.

An agent you train through use. Its learned state is an **INFT on 0G** you can
sell. The buyer inherits a smarter agent, not a blank one.

Built for **The Zero Cup (0G)**.

## Why it needs 0G (the only-on-0G test)

Remove 0G and there is no ownable, sellable, portable agent state — the product
collapses to "a chatbot with a database." 0G is load-bearing:

| Capability | 0G component | In this repo |
|---|---|---|
| Stores the evolving trained state | **0G Storage** | `app/src/lib/storage.ts` — pins the state doc, returns the root hash anchored on-chain |
| Ownership + transfer of the agent | **INFT (ERC-7857-inspired)** | `contracts/src/AgentINFT.sol` — per-token state pointer travels on sale |
| Inference against the owned state | **Compute** (MVP: isolated LLM, 0G Compute swap-in) | `app/src/lib/inference.ts` |

## The six-beat loop (= the demo)

1. **Mint** a blank agent → INFT, knows nothing.
2. **Train** through chat → each session distills into the state doc, re-pins to
   0G Storage, and `evolve()` anchors the new root on-chain. Intelligence meter climbs.
3. **Prove** → same benchmark prompt, untrained vs. trained answer side by side.
4. **List** for sale.
5. **Buy** from a second wallet → INFT transfers.
6. **Inherit** → buyer reads the on-chain pointer, pulls the trained state from 0G,
   runs the benchmark, gets the smart answer immediately.

**Resale royalty:** every *resale* routes 5% back to the original trainer
(`origin` on the token). Training agents to sell becomes a real economy — the
maker keeps earning as their agent changes hands. Enforced in `buy()`; surfaced
in the 0G Ledger as a `ROYALTY` event.

Every storage write and on-chain event streams into the live **0G Ledger** panel
with explorer links — the chain dependency is visible, not implied.

## What "trained" means (scoped honestly)

Not gradient fine-tuning. A versioned, weighted **preference/strategy doc** the
agent accumulates: explicit preferences + LLM-inferred patterns distilled into a
strategy summary + traits. Behavior provably differs before vs. after, and the
state is portable. Round 3 upgrades this to real LoRA adapters stored on 0G.

## Layout

```
contracts/   Foundry — AgentINFT.sol (+ 7 passing tests), Deploy.s.sol
app/         Next.js (App Router) + wagmi/viem
  src/lib/   chain.ts · state.ts · inference.ts · storage.ts
  src/app/api/  agent/init · chat · train · benchmark · state
  src/app/page.tsx  the six-beat UI + 0G Ledger
```

## Run

```bash
# contracts
cd contracts && forge test

# app
cd app && pnpm install && pnpm dev   # http://localhost:3000
```

## 0G Galileo Testnet

- Chain ID `16602` · RPC `https://evmrpc-testnet.0g.ai`
- Explorer `https://chainscan-galileo.0g.ai` · Storage `https://storagescan-galileo.0g.ai`
- Faucet `https://faucet.0g.ai`

## Deploy

```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url zg --broadcast
# put the printed address into app/.env.local NEXT_PUBLIC_CONTRACT_ADDRESS
```
