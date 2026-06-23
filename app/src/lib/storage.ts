// 0G Storage integration — server-only. The trained-state doc is the asset being
// sold; it must live on decentralized, verifiable storage, not a private DB.
//
// Strategy: ALWAYS keep a local cache keyed by root hash (reliable demo reads),
// AND push the real bytes to 0G Storage to obtain the canonical root hash that
// gets anchored on-chain. The root is what makes the write *visible* (storage
// explorer) and what travels with the INFT on sale.

import { promises as fs } from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { TrainedState } from "./state";

const CACHE_DIR = path.join(process.cwd(), ".data", "states");
const INDEXER = process.env.ZG_INDEXER_RPC!;
const RPC = process.env.NEXT_PUBLIC_ZG_RPC!;
const PK = process.env.STORAGE_PRIVATE_KEY!;

export type PutResult = {
  root: string;
  source: "0g" | "local-fallback";
  txRoot?: string;
};

async function ensureCache() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function localHash(buf: Buffer): string {
  return "0x" + crypto.createHash("sha256").update(buf).digest("hex");
}

// Upload a trained-state doc. Returns the root hash to anchor on-chain.
export async function putState(state: TrainedState): Promise<PutResult> {
  await ensureCache();
  const json = Buffer.from(JSON.stringify(state, null, 2));

  let root = localHash(json);
  let source: PutResult["source"] = "local-fallback";

  try {
    const { ZgFile, Indexer } = await import(
      "@0gfoundation/0g-storage-ts-sdk"
    );
    const { ethers } = await import("ethers");

    const tmp = path.join(
      os.tmpdir(),
      `savant-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
    );
    await fs.writeFile(tmp, json);

    const file = await ZgFile.fromFilePath(tmp);
    const [tree, treeErr] = await file.merkleTree();
    if (treeErr) throw new Error(`merkleTree: ${treeErr}`);
    const zgRoot = tree?.rootHash?.();
    if (zgRoot) root = zgRoot;

    const provider = new ethers.JsonRpcProvider(RPC);
    const signer = new ethers.Wallet(PK, provider);
    const indexer = new Indexer(INDEXER);
    const [, uploadErr] = await indexer.upload(file, RPC, signer);
    await file.close();
    await fs.unlink(tmp).catch(() => {});

    if (uploadErr) throw new Error(`upload: ${uploadErr}`);
    source = "0g";
  } catch (e) {
    // Testnet storage can be flaky / wallet may be unfunded. We still anchor a
    // content hash so the mechanic is intact; the source flag is honest.
    console.warn("[0g-storage] falling back to local:", (e as Error).message);
  }

  // cache by root for reliable reads regardless of path taken
  await fs.writeFile(path.join(CACHE_DIR, `${root}.json`), json);
  return { root, source };
}

export type GetResult = {
  state: TrainedState | null;
  source: "0g" | "local-cache" | "none";
};

async function readLocal(root: string): Promise<TrainedState | null> {
  try {
    const buf = await fs.readFile(
      path.join(CACHE_DIR, `${root}.json`),
      "utf8"
    );
    return JSON.parse(buf);
  } catch {
    return null;
  }
}

async function readRemote(root: string): Promise<TrainedState | null> {
  try {
    const { Indexer } = await import("@0gfoundation/0g-storage-ts-sdk");
    const indexer = new Indexer(INDEXER);
    const out = path.join(os.tmpdir(), `savant-dl-${Date.now()}.json`);
    const err = await indexer.download(root, out, true);
    if (err) throw new Error(String(err));
    const buf = await fs.readFile(out, "utf8");
    await fs.unlink(out).catch(() => {});
    const parsed = JSON.parse(buf);
    await fs.writeFile(path.join(CACHE_DIR, `${root}.json`), buf); // re-cache
    return parsed;
  } catch (e) {
    console.warn("[0g-storage] download failed:", (e as Error).message);
    return null;
  }
}

// Read a trained-state doc by root hash. `preferRemote` forces a genuine 0G
// pull first (used by the buyer's INHERIT step, so the demo proves the state
// really comes off 0G rather than a same-server cache); it falls back to the
// local cache only if 0G is unreachable. Default reads are cache-first for speed.
export async function getState(
  root: string,
  preferRemote = false
): Promise<GetResult> {
  await ensureCache();
  if (preferRemote) {
    const remote = await readRemote(root);
    if (remote) return { state: remote, source: "0g" };
    const local = await readLocal(root);
    return { state: local, source: local ? "local-cache" : "none" };
  }
  const local = await readLocal(root);
  if (local) return { state: local, source: "local-cache" };
  const remote = await readRemote(root);
  return { state: remote, source: remote ? "0g" : "none" };
}
