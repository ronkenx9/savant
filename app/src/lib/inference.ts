// Inference layer — server-only. Isolated behind these functions so the backing
// compute can be swapped for 0G Compute (verifiable inference) in a later round
// without touching the routes or UI. MVP backs it with an OpenAI-compatible LLM.

import { TrainedState, systemPrompt, intelligenceOf } from "./state";

const BASE = process.env.LLM_BASE_URL!;
const MODEL = process.env.LLM_MODEL!;
const KEY = process.env.LLM_API_KEY!;

type Msg = { role: "system" | "user" | "assistant"; content: string };

async function complete(messages: Msg[], maxTokens = 700): Promise<string> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.5,
      max_completion_tokens: maxTokens,
    }),
  });
  if (!res.ok) {
    throw new Error(`inference ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "";
  // gpt-oss can occasionally emit degenerate whitespace runs; normalize so they
  // never bloat the stored state doc or break downstream JSON.
  return raw
    .replace(/[ \t]{3,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// One chat turn, answered through the agent's current trained state.
export async function chat(
  state: TrainedState,
  history: Msg[],
  userMsg: string
): Promise<string> {
  return complete([
    { role: "system", content: systemPrompt(state, true) },
    ...history.slice(-8),
    { role: "user", content: userMsg },
  ]);
}

// Generic, no-state answer to any prompt — the "before" the demo contrasts.
export async function baselineAnswer(prompt: string): Promise<string> {
  return complete(
    [
      {
        role: "system",
        content:
          "You are a generic, untrained AI assistant. Answer helpfully but generically. ~4 sentences.",
      },
      { role: "user", content: prompt },
    ],
    400
  );
}

// Trained answer to any prompt, through current state.
export async function trainedAnswer(
  state: TrainedState,
  prompt: string
): Promise<string> {
  return complete(
    [
      { role: "system", content: systemPrompt(state, true) },
      { role: "user", content: prompt },
    ],
    400
  );
}

// THE TRAINING STEP. Distills a chat session + the existing state into an
// updated, versioned state doc. This is what "trained" means in the MVP:
// learned parameters merged in, not chat logs appended.
export async function distill(
  state: TrainedState,
  transcript: Msg[]
): Promise<TrainedState> {
  const convo = transcript
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  const sys =
    "You are a training distiller for a personal AI agent. Given the agent's CURRENT learned state (JSON) and a NEW interaction transcript, output the UPDATED learned state. Merge — never lose prior learning. Infer durable preferences, a strategy doctrine, and traits from how the user talks and what they ask for. Respond with STRICT JSON only, no markdown, matching this shape: {\"preferences\": string[], \"strategySummary\": string, \"traits\": {\"tone\": string, \"verbosity\": string, \"riskPosture\": string, \"domains\": string[]}}. preferences: max 8, most important first, each a short imperative the agent should follow.";

  const user = `CURRENT STATE:\n${JSON.stringify({
    preferences: state.preferences,
    strategySummary: state.strategySummary,
    traits: state.traits,
  })}\n\nNEW TRANSCRIPT:\n${convo}\n\nReturn updated state JSON.`;

  const raw = await complete(
    [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    900
  );

  const parsed = safeParse(raw);
  const next: TrainedState = {
    ...state,
    version: state.version + 1,
    sessions: state.sessions + 1,
    preferences: Array.isArray(parsed?.preferences)
      ? parsed.preferences.slice(0, 8)
      : state.preferences,
    strategySummary:
      typeof parsed?.strategySummary === "string" && parsed.strategySummary
        ? parsed.strategySummary
        : state.strategySummary,
    traits: {
      tone: parsed?.traits?.tone ?? state.traits.tone,
      verbosity: parsed?.traits?.verbosity ?? state.traits.verbosity,
      riskPosture: parsed?.traits?.riskPosture ?? state.traits.riskPosture,
      domains: Array.isArray(parsed?.traits?.domains)
        ? parsed.traits.domains.slice(0, 5)
        : state.traits.domains,
    },
    updatedAt: Date.now(),
  };
  // refresh the cached trained answer to the benchmark
  next.trainedAnswerCache = await trainedAnswer(next, next.benchmarkPrompt);
  return next;
}

function safeParse(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export { intelligenceOf };
