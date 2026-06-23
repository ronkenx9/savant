import { NextRequest, NextResponse } from "next/server";
import { blankState, intelligenceOf, BENCHMARK_PROMPT } from "@/lib/state";
import { baselineAnswer } from "@/lib/inference";
import { putState } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

// Create a blank agent's initial state: captures the generic baseline answer to
// the benchmark prompt (the permanent "before"), then pins it to 0G Storage.
export async function POST(req: NextRequest) {
  try {
    const { agentId, name } = await req.json();
    const state = blankState(String(agentId), String(name || "Agent"));
    state.baselineAnswer = await baselineAnswer(BENCHMARK_PROMPT);
    const put = await putState(state);
    return NextResponse.json({
      root: put.root,
      source: put.source,
      intelligence: intelligenceOf(state),
      state,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
