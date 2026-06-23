import { NextRequest, NextResponse } from "next/server";
import { trainedAnswer } from "@/lib/inference";
import { TrainedState, intelligenceOf } from "@/lib/state";

export const runtime = "nodejs";
export const maxDuration = 60;

// "Prove it learned": same prompt, two answers. baseline = the permanent generic
// answer captured at mint; trained = the agent's current answer through its state.
export async function POST(req: NextRequest) {
  try {
    const { state } = (await req.json()) as { state: TrainedState };
    const prompt = state.benchmarkPrompt;
    const trained =
      state.version > 0
        ? state.trainedAnswerCache || (await trainedAnswer(state, prompt))
        : "(agent is still untrained — train it first to see divergence)";
    return NextResponse.json({
      prompt,
      baseline: state.baselineAnswer,
      trained,
      version: state.version,
      intelligence: intelligenceOf(state),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
