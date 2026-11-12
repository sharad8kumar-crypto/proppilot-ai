import { NextResponse } from "next/server";
import { z } from "zod";
import { POST as chatPost } from "@/app/api/chat/route";
import { checkAdmin } from "@/lib/admin-auth";
import {
  DEMO_SCENARIOS,
  DEMO_SCENARIO_ORDER,
  SOURCE_OPENERS,
  randomDemoName,
} from "@/lib/demo-scenarios";
import { rateLimit } from "@/lib/rate-limit";
import type { LeadSource } from "@/types";

const SOURCES: LeadSource[] = ["99acres", "magicbricks", "housing", "facebook", "whatsapp", "website"];

const bodySchema = z.object({
  source: z.enum(["99acres", "magicbricks", "housing", "facebook", "whatsapp", "website"]).optional(),
  scenario: z.enum(["serious", "investor", "budget", "urgent", "negotiator"]).optional(),
});

// POST /api/demo/simulate-lead   (header: x-admin-key)
// Body: { source?, scenario? }. Creates a fictional lead and runs the real AI pipeline.
export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const limit = rateLimit(`simulate:${ip}`, 10, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many simulated leads. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const denied = checkAdmin(request);
    if (denied) return denied;

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid source or scenario." }, { status: 400 });
    }

    const source =
      parsed.data.source ?? SOURCES[Math.floor(Math.random() * SOURCES.length)];
    const scenario =
      parsed.data.scenario ??
      DEMO_SCENARIO_ORDER[Math.floor(Math.random() * DEMO_SCENARIO_ORDER.length)];

    const name = randomDemoName();
    const message = `${SOURCE_OPENERS[source]}${DEMO_SCENARIOS[scenario].message}`.slice(0, 500);

    // Runs the very same code path as a real buyer message (no network call needed).
    // A separate rate-limit bucket keeps simulated leads from using up typing limits.
    const res = await chatPost(
      new Request(new URL("/api/chat", request.url), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "demo-simulate" },
        body: JSON.stringify({ message, source, name }),
      })
    );

    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !data) {
      return NextResponse.json(
        { error: typeof data?.error === "string" ? data.error : "Could not simulate the lead." },
        { status: res.status || 500 }
      );
    }

    return NextResponse.json({
      lead_id: data.lead_id,
      name,
      source,
      scenario,
      temperature: data.temperature,
      score: data.score,
      reply: data.reply,
      ai_ok: data.ai_ok,
    });
  } catch (err) {
    console.error("[api/demo/simulate-lead] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Something went wrong on our side. Please try again." },
      { status: 500 }
    );
  }
}