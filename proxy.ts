import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optional access gate (HTTP Basic auth, password in DASHBOARD_PASSWORD).
 *
 * OFF by default: when DASHBOARD_PASSWORD is unset the app is open and visitors go straight
 * to the digest — right for a demo or a submission. Set the variable to require a password;
 * the browser then shows its native sign-in prompt once (any username, matching password).
 *
 * The dashboard's own API routes (repos, sync, feedback, seed) have no login of their own, so
 * leave the gate OFF only when you are happy for anyone with the link to use them.
 *
 * Two endpoints are always exempt because they authenticate themselves, which lets GitHub and
 * Vercel Cron reach them even when the gate is on:
 *   POST /api/webhook/github   HMAC signature (GITHUB_WEBHOOK_SECRET)
 *   GET  /api/ingest           Bearer CRON_SECRET
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

export function proxy(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next(); // gate is off

  const { pathname } = request.nextUrl;
  if (pathname === "/api/webhook/github") return NextResponse.next();
  if (pathname === "/api/ingest" && request.method === "GET") return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const given = decoded.slice(decoded.indexOf(":") + 1);
    if (safeEqual(given, password)) return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Release Radar", charset="UTF-8"' },
  });
}
