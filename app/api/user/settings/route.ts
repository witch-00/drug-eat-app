import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

const USER_ID_COOKIE = "user_id";

type UserSettingsRow = {
  user_id: string;
  default_elderly_id: number | null;
  updated_at: string;
};

export async function GET(req: NextRequest) {
  try {
    const userId = req.cookies.get(USER_ID_COOKIE)?.value;
    if (!userId) {
      return NextResponse.json({ error: "user_id is missing" }, { status: 401 });
    }

    const rows = (await sql`
      SELECT user_id, default_elderly_id, updated_at
      FROM user_settings
      WHERE user_id = ${userId}
      LIMIT 1
    `) as UserSettingsRow[];

    return NextResponse.json(
      {
        user_id: userId,
        default_elderly_id: rows[0]?.default_elderly_id ?? null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/user/settings error:", error);
    return NextResponse.json({ error: "获取用户设置失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.cookies.get(USER_ID_COOKIE)?.value;
    if (!userId) {
      return NextResponse.json({ error: "user_id is missing" }, { status: 401 });
    }

    const body = await req.json();
    const { default_elderly_id } = body ?? {};
    if (!default_elderly_id || Number.isNaN(Number(default_elderly_id))) {
      return NextResponse.json({ error: "default_elderly_id is invalid" }, { status: 400 });
    }

    const rows = (await sql`
      INSERT INTO user_settings (user_id, default_elderly_id)
      VALUES (${userId}, ${Number(default_elderly_id)})
      ON CONFLICT (user_id)
      DO UPDATE SET
        default_elderly_id = EXCLUDED.default_elderly_id,
        updated_at = CURRENT_TIMESTAMP
      RETURNING user_id, default_elderly_id, updated_at
    `) as UserSettingsRow[];

    return NextResponse.json(rows[0], { status: 200 });
  } catch (error) {
    console.error("POST /api/user/settings error:", error);
    return NextResponse.json({ error: "保存用户设置失败" }, { status: 500 });
  }
}
