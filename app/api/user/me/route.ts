import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

const USER_ID_COOKIE = "user_id";

export async function GET(req: NextRequest) {
  const existing = req.cookies.get(USER_ID_COOKIE)?.value;
  if (existing) {
    return NextResponse.json({ user_id: existing }, { status: 200 });
  }

  const userId = randomUUID();
  const res = NextResponse.json({ user_id: userId }, { status: 200 });
  res.cookies.set(USER_ID_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return res;
}
