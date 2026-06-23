import { NextRequest, NextResponse } from "next/server";
import { getState } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

// Fetch a trained-state doc by its 0G Storage root. Used by the buyer to INHERIT
// the agent after the INFT transfers — they pull the smart state straight from 0G.
export async function GET(req: NextRequest) {
  const root = req.nextUrl.searchParams.get("root");
  if (!root) {
    return NextResponse.json({ error: "missing root" }, { status: 400 });
  }
  // INHERIT pulls from 0G first — this read is the proof the trained state
  // travels off decentralized storage, not a same-server cache.
  const { state, source } = await getState(root, true);
  if (!state) {
    return NextResponse.json({ error: "state not found" }, { status: 404 });
  }
  return NextResponse.json({ state, source });
}
