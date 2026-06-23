"use client";

import { useEffect, useRef, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
  usePublicClient,
  useWriteContract,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { decodeEventLog, parseEther, formatEther } from "viem";
import {
  AGENT_ABI,
  CONTRACT_ADDRESS,
  ZG_CHAIN_ID,
  ZG_EXPLORER,
  ZG_STORAGE_EXPLORER,
  zgGalileo,
} from "@/lib/chain";
import type { TrainedState } from "@/lib/state";

type LedgerEntry = {
  ts: number;
  kind: "storage" | "chain" | "info";
  text: string;
  href?: string;
  badge?: string;
};

type Agent = {
  tokenId: bigint;
  name: string;
  root: string;
  source: "0g" | "local-fallback";
  intelligence: number;
  version: number;
};

const STEPS = ["Mint", "Train", "Prove", "List", "Buy", "Inherit"];

export default function Page() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState(0);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [stateDoc, setStateDoc] = useState<TrainedState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const log = (e: Omit<LedgerEntry, "ts">) =>
    setLedger((l) => [{ ...e, ts: Date.now() }, ...l]);

  const wrongChain = isConnected && chainId !== ZG_CHAIN_ID;
  const deployed = !!CONTRACT_ADDRESS;

  async function send(
    functionName: "mint" | "evolve" | "list" | "unlist" | "buy",
    args: readonly unknown[],
    value?: bigint
  ) {
    const hash = await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: AGENT_ABI,
      functionName,
      args: args as any,
      value,
    });
    log({
      kind: "chain",
      text: `${functionName}() submitted`,
      href: `${ZG_EXPLORER}/tx/${hash}`,
      badge: "0G CHAIN",
    });
    const receipt = await publicClient!.waitForTransactionReceipt({ hash });
    return receipt;
  }

  // ── 1. MINT ───────────────────────────────────────────────────────────────
  async function mint(name: string) {
    setErr(null);
    setBusy("Minting blank INFT…");
    try {
      const receipt = await send("mint", [name]);
      // Read the real tokenId from the AgentMinted event — never guess it from
      // totalMinted(), which races against any concurrent mint.
      let tokenId: bigint | null = null;
      for (const lg of receipt.logs) {
        try {
          const d = decodeEventLog({
            abi: AGENT_ABI,
            data: lg.data,
            topics: lg.topics,
          });
          if (d.eventName === "AgentMinted") {
            tokenId = (d.args as any).tokenId as bigint;
            break;
          }
        } catch {}
      }
      if (tokenId === null) throw new Error("mint receipt missing AgentMinted event");

      setBusy("Pinning baseline state to 0G Storage…");
      const r = await fetch("/api/agent/init", {
        method: "POST",
        body: JSON.stringify({ agentId: tokenId.toString(), name }),
      }).then((x) => x.json());
      if (r.error) throw new Error(r.error);

      setStateDoc(r.state);
      setAgent({
        tokenId,
        name,
        root: r.root,
        source: r.source,
        intelligence: r.intelligence,
        version: 0,
      });
      log({
        kind: "storage",
        text: `baseline state pinned · root ${short(r.root)}`,
        href: `${ZG_STORAGE_EXPLORER}/file/${r.root}`,
        badge: r.source === "0g" ? "0G STORAGE" : "0G STORAGE (cached)",
      });
      log({ kind: "info", text: `Agent #${tokenId} minted — blank, knows nothing.` });
      setStep(1);
    } catch (e: any) {
      setErr(e.shortMessage || e.message);
    } finally {
      setBusy(null);
    }
  }

  // ── 2. TRAIN ──────────────────────────────────────────────────────────────
  async function train(transcript: { role: string; content: string }[]) {
    if (!agent || !stateDoc) return;
    setErr(null);
    setBusy("Distilling session into trained state…");
    try {
      const r = await fetch("/api/train", {
        method: "POST",
        body: JSON.stringify({ state: stateDoc, transcript }),
      }).then((x) => x.json());
      if (r.error) throw new Error(r.error);

      log({
        kind: "storage",
        text: `state v${r.state.version} re-pinned · root ${short(r.root)}`,
        href: `${ZG_STORAGE_EXPLORER}/file/${r.root}`,
        badge: r.source === "0g" ? "0G STORAGE" : "0G STORAGE (cached)",
      });

      setBusy("Anchoring new state root on-chain (evolve)…");
      await send("evolve", [agent.tokenId, r.root, BigInt(r.intelligence)]);

      setStateDoc(r.state);
      setAgent({
        ...agent,
        root: r.root,
        source: r.source,
        intelligence: r.intelligence,
        version: r.state.version,
      });
      log({
        kind: "info",
        text: `Trained → intelligence ${r.intelligence}/100, v${r.state.version}.`,
      });
    } catch (e: any) {
      setErr(e.shortMessage || e.message);
    } finally {
      setBusy(null);
    }
  }

  // ── 4. LIST ───────────────────────────────────────────────────────────────
  async function list(price: string) {
    if (!agent) return;
    setErr(null);
    setBusy("Listing INFT for sale…");
    try {
      await send("list", [agent.tokenId, parseEther(price)]);
      log({ kind: "info", text: `Agent #${agent.tokenId} listed for ${price} 0G.` });
      setStep(4);
    } catch (e: any) {
      setErr(e.shortMessage || e.message);
    } finally {
      setBusy(null);
    }
  }

  // ── 5. BUY ────────────────────────────────────────────────────────────────
  async function buy(price: string) {
    if (!agent) return;
    setErr(null);
    setBusy("Buying agent — INFT + trained state transfer…");
    try {
      const receipt = await send("buy", [agent.tokenId], parseEther(price));
      for (const lg of receipt.logs) {
        try {
          const d = decodeEventLog({
            abi: AGENT_ABI,
            data: lg.data,
            topics: lg.topics,
          });
          if (d.eventName === "RoyaltyPaid") {
            const a = d.args as any;
            log({
              kind: "chain",
              text: `royalty ${formatEther(a.amount)} 0G → original trainer ${short(
                a.origin
              )}`,
              badge: "ROYALTY",
            });
          }
        } catch {}
      }
      log({
        kind: "info",
        text: `Agent #${agent.tokenId} purchased by ${short(address!)} — intelligence travels with it.`,
      });
      setStep(5);
    } catch (e: any) {
      setErr(e.shortMessage || e.message);
    } finally {
      setBusy(null);
    }
  }

  // ── 6. INHERIT ────────────────────────────────────────────────────────────
  async function inherit(tokenId: bigint) {
    setErr(null);
    setBusy("Reading on-chain state pointer + pulling from 0G…");
    try {
      const a = (await publicClient!.readContract({
        address: CONTRACT_ADDRESS,
        abi: AGENT_ABI,
        functionName: "getAgent",
        args: [tokenId],
      })) as any;
      log({
        kind: "chain",
        text: `on-chain pointer · root ${short(a.stateRoot)} · v${a.version} · IQ ${a.intelligence}`,
        badge: "0G CHAIN",
      });
      const r = await fetch(`/api/state?root=${a.stateRoot}`).then((x) =>
        x.json()
      );
      if (r.error) throw new Error(r.error);
      log({
        kind: "storage",
        text:
          r.source === "0g"
            ? `pulled trained state from 0G Storage · root ${short(a.stateRoot)}`
            : `0G unreachable — read state from cache · root ${short(a.stateRoot)}`,
        href: `${ZG_STORAGE_EXPLORER}/file/${a.stateRoot}`,
        badge: r.source === "0g" ? "0G STORAGE" : "0G STORAGE (cached)",
      });
      setStateDoc(r.state);
      setAgent({
        tokenId,
        name: a.name,
        root: a.stateRoot,
        source: "0g",
        intelligence: Number(a.intelligence),
        version: Number(a.version),
      });
    } catch (e: any) {
      setErr(e.shortMessage || e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <GlobalNav
        address={address}
        isConnected={isConnected}
        connect={() => connect({ connector: injected() })}
        disconnect={() => disconnect()}
      />
      <SubNav step={step} setStep={setStep} hasAgent={!!agent} />

      {/* HERO — parchment tile */}
      <section className="tile bg-parchment">
        <div className="max-w-content mx-auto px-5 pt-section pb-12 text-center">
          <h1 className="t-hero">Own an AI that actually got smarter.</h1>
          <p className="t-lead text-muted80 mt-4 max-w-2xl mx-auto">
            Train an agent through use. Its learned mind is an INFT on 0G — sell
            it, and the buyer inherits a smart agent, not a blank one.
          </p>
        </div>
      </section>

      {/* WORKSPACE — white tile */}
      <section className="tile bg-canvas">
        <div className="max-w-grid mx-auto px-5 py-12">
          {(!deployed || wrongChain || err) && (
            <div className="mb-6 space-y-2">
              {!deployed && (
                <Banner tone="warn">
                  Contract address not set — deploy <code>AgentINFT</code> and set{" "}
                  <code>NEXT_PUBLIC_CONTRACT_ADDRESS</code>.
                </Banner>
              )}
              {wrongChain && (
                <Banner tone="warn">
                  Wrong network.{" "}
                  <span
                    className="link"
                    onClick={() => switchChain({ chainId: zgGalileo.id })}
                  >
                    Switch to 0G Galileo Testnet →
                  </span>
                </Banner>
              )}
              {err && <Banner tone="error">{err}</Banner>}
            </div>
          )}

          {agent && <AgentCard agent={agent} />}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 mt-6">
            <div>
              {step === 0 && (
                <MintPanel onMint={mint} busy={busy} ready={isConnected && deployed} />
              )}
              {step === 1 && stateDoc && (
                <TrainPanel
                  agent={agent!}
                  stateDoc={stateDoc}
                  onTrain={train}
                  busy={busy}
                />
              )}
              {step === 2 && <ProvePanel stateDoc={stateDoc} />}
              {step === 3 && <ListPanel onList={list} busy={busy} />}
              {step === 4 && (
                <BuyPanel agent={agent} address={address} onBuy={buy} busy={busy} />
              )}
              {step === 5 && (
                <InheritPanel
                  agent={agent}
                  onInherit={inherit}
                  stateDoc={stateDoc}
                  busy={busy}
                />
              )}
            </div>
            <Ledger entries={ledger} />
          </div>
        </div>
      </section>

      {/* WHY 0G — dark editorial tile */}
      <WhyTile />

      {/* FOOTER — parchment */}
      <footer className="tile bg-parchment">
        <div className="max-w-grid mx-auto px-5 py-12 t-fine text-muted48">
          SAVANT — Tradeable Trained Agents · built on 0G Galileo Testnet · The
          Zero Cup. Inference shown is an MVP stand-in for 0G Compute (verifiable
          inference), isolated behind one interface.
        </div>
      </footer>

      {busy && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 frosted border border-hairline rounded-pill px-5 py-3 t-caption fade-in shadow-product z-50">
          <span className="inline-block w-2 h-2 rounded-full bg-action mr-2 align-middle animate-pulse" />
          {busy}
        </div>
      )}
    </div>
  );
}

// ── shell ─────────────────────────────────────────────────────────────────────

function GlobalNav({ address, isConnected, connect, disconnect }: any) {
  return (
    <nav className="sticky top-0 z-50 bg-black text-white h-11 flex items-center">
      <div className="max-w-grid w-full mx-auto px-5 flex items-center justify-between">
        <span className="t-fine tracking-wide">
          SAVANT <span className="text-action-dark">✦</span>
        </span>
        {isConnected ? (
          <span className="t-fine flex items-center gap-3">
            <span className="text-on-dark-muted">{short(address)}</span>
            <span className="link on-dark" onClick={disconnect}>
              disconnect
            </span>
          </span>
        ) : (
          <button className="btn btn-pill on-dark" style={{ padding: "6px 16px", fontSize: 14 }} onClick={connect}>
            Connect Wallet
          </button>
        )}
      </div>
    </nav>
  );
}

function SubNav({ step, setStep, hasAgent }: any) {
  return (
    <div className="sticky top-11 z-40 frosted border-b border-hairline">
      <div className="max-w-grid mx-auto px-5 h-16 flex items-center justify-between gap-4">
        <span className="t-tagline shrink-0">Tradeable Trained Agents</span>
        <div className="flex gap-1.5 overflow-x-auto">
          {STEPS.map((s, i) => (
            <button
              key={s}
              disabled={i > 0 && !hasAgent}
              data-active={i === step}
              onClick={() => setStep(i)}
              className="chip-pill shrink-0"
              style={{ padding: "6px 14px", fontSize: 13 }}
            >
              {i + 1}. {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function WhyTile() {
  const cols = [
    {
      h: "0G Storage",
      b: "The asset being sold IS the trained-state doc. It must live on decentralized, verifiable storage — not a private DB the seller controls.",
    },
    {
      h: "0G Compute",
      b: "Inference reads the owned state. Verifiable compute lets a buyer trust the agent behaves exactly as advertised.",
    },
    {
      h: "INFT",
      b: "Selling a trained agent is literally token transfer of intelligence — 0G's defining primitive. The state travels with the token.",
    },
  ];
  return (
    <section className="tile bg-tile1 text-white">
      <div className="max-w-grid mx-auto px-5 py-section">
        <h2 className="t-display max-w-2xl">
          Remove 0G and there is no ownable, sellable agent.
        </h2>
        <p className="t-lead text-on-dark-muted mt-3 max-w-xl">
          The whole product collapses to “a chatbot with a database.” 0G is
          load-bearing, not decorative.
        </p>
        <div className="grid md:grid-cols-3 gap-8 mt-12">
          {cols.map((c) => (
            <div key={c.h}>
              <div className="t-tagline">{c.h}</div>
              <p className="t-body text-on-dark-muted mt-2">{c.b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── product (agent) ────────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div className="util-card p-6 flex items-center gap-5 fade-in">
      <div className="w-16 h-16 rounded-lg bg-tile1 text-white flex items-center justify-center text-2xl font-semibold shadow-product shrink-0">
        {agent.name?.[0]?.toUpperCase() ?? "A"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="t-body-strong truncate">
          {agent.name}{" "}
          <span className="text-muted48 font-normal">
            #{agent.tokenId.toString()}
          </span>
        </div>
        <div className="t-caption text-muted48 mt-0.5">
          v{agent.version} · root {short(agent.root)} ·{" "}
          {agent.source === "0g" ? "on 0G Storage" : "0G cached"}
        </div>
      </div>
      <Meter value={agent.intelligence} />
    </div>
  );
}

function Meter({ value }: { value: number }) {
  return (
    <div className="w-44 shrink-0">
      <div className="flex justify-between t-caption mb-1.5">
        <span className="text-muted48">intelligence</span>
        <span className="font-mono text-action">{value}/100</span>
      </div>
      <div className="h-2 rounded-pill bg-divider overflow-hidden">
        <div
          className="h-full bg-action transition-all duration-700"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// ── panels ──────────────────────────────────────────────────────────────────────

function PanelShell({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="util-card p-8 fade-in">
      <h2 className="t-display" style={{ fontSize: 28 }}>
        {title}
      </h2>
      <p className="t-body text-muted80 mt-2 mb-6">{sub}</p>
      {children}
    </div>
  );
}

function MintPanel({ onMint, busy, ready }: any) {
  const [name, setName] = useState("Atlas");
  return (
    <PanelShell
      title="Mint a blank agent"
      sub="It’s an INFT on 0G. Generic, knows nothing about you — yet."
    >
      <div className="flex flex-wrap gap-3">
        <input
          className="px-5 py-3 flex-1 min-w-[200px]"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Agent name"
        />
        <button
          className="btn btn-pill"
          disabled={!ready || !!busy || !name}
          onClick={() => onMint(name)}
        >
          Mint INFT
        </button>
      </div>
      {!ready && (
        <p className="t-caption text-muted48 mt-3">Connect wallet to mint.</p>
      )}
    </PanelShell>
  );
}

function TrainPanel({ agent, stateDoc, onTrain, busy }: any) {
  const [history, setHistory] = useState<{ role: string; content: string }[]>(
    []
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo(0, scroller.current.scrollHeight);
  }, [history]);

  async function sendMsg() {
    if (!input.trim()) return;
    const msg = input.trim();
    setInput("");
    const next = [...history, { role: "user", content: msg }];
    setHistory(next);
    setSending(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ state: stateDoc, history, message: msg }),
      }).then((x) => x.json());
      setHistory([...next, { role: "assistant", content: r.reply ?? r.error }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <PanelShell
      title="Train it through use"
      sub="Chat, state preferences. Then distill the session → it re-pins to 0G and bumps the on-chain state."
    >
      <div
        ref={scroller}
        className="h-72 overflow-y-auto space-y-4 mb-4 pr-1 border-t border-divider pt-4"
      >
        {history.length === 0 && (
          <p className="t-body text-muted48">
            Try: “I’m a risk-averse founder. Keep answers to 3 bullet points and
            always flag the downside first.”
          </p>
        )}
        {history.map((m, i) => (
          <div key={i} className="t-body">
            <div className="t-caption text-muted48 mb-0.5">
              {m.role === "user" ? "You" : agent.name}
            </div>
            <div className={m.role === "user" ? "text-ink" : "text-muted80"}>
              {m.content}
            </div>
          </div>
        ))}
        {sending && <p className="t-body text-muted48">thinking…</p>}
      </div>

      <div className="flex gap-3 mb-4">
        <input
          className="px-5 py-3 flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMsg()}
          placeholder="Talk to your agent…"
        />
        <button className="btn btn-ghost-pill" onClick={sendMsg} disabled={sending}>
          Send
        </button>
      </div>

      <button
        className="btn btn-pill w-full"
        disabled={history.length < 2 || !!busy}
        onClick={() => onTrain(history)}
      >
        Distill session → train agent (writes to 0G + evolve)
      </button>
    </PanelShell>
  );
}

function ProvePanel({ stateDoc }: { stateDoc: TrainedState | null }) {
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!stateDoc) return;
    setLoading(true);
    try {
      const r = await fetch("/api/benchmark", {
        method: "POST",
        body: JSON.stringify({ state: stateDoc }),
      }).then((x) => x.json());
      setRes(r);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PanelShell
      title="Prove it learned"
      sub="Same prompt, two answers: the generic baseline vs. your trained agent."
    >
      <button
        className="btn btn-pill mb-6"
        onClick={run}
        disabled={loading || !stateDoc}
      >
        {loading ? "Running…" : "Run benchmark"}
      </button>
      {res && (
        <div className="space-y-4 fade-in">
          <p className="t-body text-muted80">
            Prompt: <span className="text-ink">“{res.prompt}”</span>
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <BenchCard label="Untrained — before" body={res.baseline} muted />
            <BenchCard label="Trained — after" body={res.trained} />
          </div>
        </div>
      )}
    </PanelShell>
  );
}

function BenchCard({
  label,
  body,
  muted,
}: {
  label: string;
  body: string;
  muted?: boolean;
}) {
  return (
    <div
      className="rounded-lg p-5 border"
      style={{
        borderColor: muted ? "#e0e0e0" : "#0071e3",
        borderWidth: muted ? 1 : 2,
        background: muted ? "#fafafc" : "#fff",
      }}
    >
      <div className="t-caption mb-2" style={{ color: muted ? "#7a7a7a" : "#0066cc" }}>
        {label}
      </div>
      <p className={`t-body ${muted ? "text-muted80" : "text-ink"}`}>{body}</p>
    </div>
  );
}

function ListPanel({ onList, busy }: any) {
  const [price, setPrice] = useState("0.01");
  return (
    <PanelShell
      title="List the trained agent"
      sub="Set a price. The INFT — and its trained state on 0G — goes to market. On every resale, 5% routes back to the original trainer."
    >
      <div className="flex flex-wrap gap-3">
        <input
          className="px-5 py-3 w-40"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Price in 0G"
        />
        <button
          className="btn btn-pill"
          disabled={!!busy || !price}
          onClick={() => onList(price)}
        >
          List for {price} 0G
        </button>
      </div>
    </PanelShell>
  );
}

function BuyPanel({ agent, address, onBuy, busy }: any) {
  const [price, setPrice] = useState("0.01");
  return (
    <PanelShell
      title="Buy the agent"
      sub="Switch to a second account in your wallet, then buy. You inherit a smart agent — not a blank one."
    >
      <p className="t-caption text-muted48 mb-4">Buying as {short(address)}</p>
      <div className="flex flex-wrap gap-3">
        <input
          className="px-5 py-3 w-40"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <button
          className="btn btn-pill"
          disabled={!!busy || !agent}
          onClick={() => onBuy(price)}
        >
          Buy for {price} 0G
        </button>
      </div>
    </PanelShell>
  );
}

function InheritPanel({ agent, onInherit, stateDoc, busy }: any) {
  const [tokenId, setTokenId] = useState(agent?.tokenId?.toString() ?? "1");
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function runBench() {
    if (!stateDoc) return;
    setLoading(true);
    try {
      const r = await fetch("/api/benchmark", {
        method: "POST",
        body: JSON.stringify({ state: stateDoc }),
      }).then((x) => x.json());
      setRes(r);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PanelShell
      title="Inherit a smarter agent"
      sub="Pull the trained state from the on-chain pointer → 0G. Run the same benchmark — you get the smart answer immediately."
    >
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          className="px-5 py-3 w-32"
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          placeholder="tokenId"
        />
        <button
          className="btn btn-ghost-pill"
          disabled={!!busy}
          onClick={() => onInherit(BigInt(tokenId))}
        >
          Load from 0G
        </button>
        <button
          className="btn btn-pill"
          disabled={!stateDoc || loading}
          onClick={runBench}
        >
          {loading ? "Running…" : "Run benchmark"}
        </button>
      </div>
      {res && (
        <div className="grid md:grid-cols-2 gap-4 fade-in">
          <BenchCard label="Generic" body={res.baseline} muted />
          <BenchCard label="Your inherited agent" body={res.trained} />
        </div>
      )}
    </PanelShell>
  );
}

// ── ledger ────────────────────────────────────────────────────────────────────

function Ledger({ entries }: { entries: LedgerEntry[] }) {
  return (
    <aside className="util-card p-5 h-fit lg:sticky lg:top-32">
      <div className="flex items-center justify-between mb-4">
        <h3 className="t-body-strong">0G Ledger</h3>
        <span className="chip-pill" style={{ padding: "2px 10px", fontSize: 11 }}>
          live
        </span>
      </div>
      <div className="space-y-3 max-h-[64vh] overflow-y-auto">
        {entries.length === 0 && (
          <p className="t-caption text-muted48">
            Storage writes & on-chain events appear here.
          </p>
        )}
        {entries.map((e, i) => (
          <div key={i} className="fade-in">
            {e.badge && (
              <span
                className="t-fine font-mono px-2 py-0.5 rounded-pill"
                style={{
                  color: e.kind === "storage" ? "#0066cc" : "#1d1d1f",
                  background: e.kind === "storage" ? "#eef4fd" : "#f5f5f7",
                }}
              >
                {e.badge}
              </span>
            )}
            <div className="t-caption text-muted80 mt-1">{e.text}</div>
            {e.href && (
              <a
                href={e.href}
                target="_blank"
                rel="noreferrer"
                className="link t-caption"
              >
                view ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}

function Banner({ tone, children }: any) {
  const style =
    tone === "error"
      ? { borderColor: "#e0b4b4", background: "#fdf3f3", color: "#9a2a2a" }
      : { borderColor: "#e6d8a8", background: "#fdfaef", color: "#7a5f12" };
  return (
    <div
      className="border rounded-md px-4 py-2.5 t-caption fade-in"
      style={style}
    >
      {children}
    </div>
  );
}

function short(s?: string) {
  if (!s) return "";
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}
