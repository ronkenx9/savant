import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/inference";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { state, history, message } = await req.json();
    const reply = await chat(state, history ?? [], String(message));
    return NextResponse.json({ reply });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
