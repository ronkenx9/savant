import { NextRequest, NextResponse } from "next/server";
import { distill, intelligenceOf } from "@/lib/inference";
import { putState } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 120;

// THE training step: distill the session into the state, re-pin to 0G Storage,
// return the new root + intelligence for the client to anchor on-chain (evolve).
export async function POST(req: NextRequest) {
  try {
    const { state, transcript } = await req.json();
    if (!transcript?.length) {
      return NextResponse.json(
        { error: "no transcript to train on" },
        { status: 400 }
      );
    }
    const next = await distill(state, transcript);
    const put = await putState(next);
    return NextResponse.json({
      root: put.root,
      source: put.source,
      intelligence: intelligenceOf(next),
      state: next,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
