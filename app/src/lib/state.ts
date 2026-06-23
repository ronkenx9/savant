// Trained-state schema (v0) — the asset that lives on 0G Storage and is sold
// with the INFT. NOT raw chat logs: distilled, versioned, weighted preferences.

export type TrainedState = {
  agentId: string;
  name: string;
  version: number;
  sessions: number;
  preferences: string[]; // explicit + LLM-inferred, most-weighted first
  strategySummary: string; // distilled persona / how-to-answer doctrine
  traits: {
    tone: string;
    verbosity: string;
    riskPosture: string;
    domains: string[];
  };
  benchmarkPrompt: string;
  baselineAnswer: string; // generic answer, captured at mint — the "before"
  trainedAnswerCache: string; // last trained answer — the "after"
  updatedAt: number;
};

export const BENCHMARK_PROMPT =
  "I just got a $20k bonus. What should I do with it?";

export function blankState(agentId: string, name: string): TrainedState {
  return {
    agentId,
    name,
    version: 0,
    sessions: 0,
    preferences: [],
    strategySummary: "",
    traits: { tone: "", verbosity: "", riskPosture: "", domains: [] },
    benchmarkPrompt: BENCHMARK_PROMPT,
    baselineAnswer: "",
    trainedAnswerCache: "",
    updatedAt: Date.now(),
  };
}

// Intelligence meter (0..100) derived purely from how rich the learned state is.
// Deterministic so the on-chain number is reproducible from the stored doc.
export function intelligenceOf(s: TrainedState): number {
  const prefScore = Math.min(s.preferences.length, 8) * 7; // up to 56
  const stratScore = Math.min(s.strategySummary.length, 400) / 400 * 18; // up to 18
  const traitScore =
    (s.traits.tone ? 4 : 0) +
    (s.traits.verbosity ? 4 : 0) +
    (s.traits.riskPosture ? 4 : 0) +
    Math.min(s.traits.domains.length, 3) * 2; // up to 18
  const sessionScore = Math.min(s.sessions, 4) * 2; // up to 8
  return Math.min(
    100,
    Math.round(prefScore + stratScore + traitScore + sessionScore)
  );
}

// Build the system prompt the agent answers with.
// `trained=false` => the generic baseline agent (the "before").
export function systemPrompt(s: TrainedState, trained: boolean): string {
  if (!trained || s.version === 0) {
    return "You are a generic, untrained AI assistant. You know nothing about the user. Answer helpfully but generically. Keep it to ~4 sentences.";
  }
  return [
    `You are "${s.name}", an AI agent trained through use by your owner.`,
    `Your learned operating doctrine: ${s.strategySummary}`,
    s.preferences.length
      ? `Honor these learned preferences, in priority order:\n- ${s.preferences.join(
          "\n- "
        )}`
      : "",
    `Tone: ${s.traits.tone || "neutral"}. Verbosity: ${
      s.traits.verbosity || "balanced"
    }. Risk posture: ${s.traits.riskPosture || "neutral"}.`,
    s.traits.domains.length
      ? `You are especially sharp on: ${s.traits.domains.join(", ")}.`
      : "",
    "Answer as this specific trained agent would — visibly different from a generic assistant. Keep it to ~5 sentences.",
  ]
    .filter(Boolean)
    .join("\n");
}
