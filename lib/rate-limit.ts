import { NextRequest } from "next/server";

const requests = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(req: NextRequest, limit = 60, windowMs = 60_000): boolean {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const now = Date.now();
  const entry = requests.get(ip);
  if (!entry || now > entry.resetAt) {
    requests.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}
