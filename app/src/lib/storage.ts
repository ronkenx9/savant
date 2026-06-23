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

// Read a trained-state doc by root hash (local cache first; 0G as fallback).
export async function getState(root: string): Promise<TrainedState | null> {
  await ensureCache();
  const cached = path.join(CACHE_DIR, `${root}.json`);
  try {
    const buf = await fs.readFile(cached, "utf8");
    return JSON.parse(buf);
  } catch {
    // not in local cache — try pulling from 0G
  }
  try {
    const { Indexer } = await import("@0gfoundation/0g-storage-ts-sdk");
    const indexer = new Indexer(INDEXER);
    const out = path.join(os.tmpdir(), `savant-dl-${Date.now()}.json`);
    const err = await indexer.download(root, out, true);
    if (err) throw new Error(String(err));
    const buf = await fs.readFile(out, "utf8");
    await fs.unlink(out).catch(() => {});
    const parsed = JSON.parse(buf);
    await fs.writeFile(cached, buf); // re-cache
    return parsed;
  } catch (e) {
    console.warn("[0g-storage] download failed:", (e as Error).message);
    return null;
  }
}
