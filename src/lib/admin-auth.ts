import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

// Protects destructive / quota-using demo endpoints with DEMO_ADMIN_KEY.
// Returns null when the request is allowed, otherwise the error response to send back.
// In development with no key set, requests are allowed so local testing stays easy.
export function checkAdmin(request: Request): NextResponse | null {
  const expected = process.env.DEMO_ADMIN_KEY;

  if (!expected) {
    if (process.env.NODE_ENV !== "production") return null;
    return NextResponse.json(
      { error: "The demo admin key is not configured on the server." },
      { status: 503 }
    );
  }

  const given = Buffer.from(request.headers.get("x-admin-key") ?? "");
  const wanted = Buffer.from(expected);

  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
    return NextResponse.json({ error: "Wrong admin key." }, { status: 401 });
  }
  return null;
}