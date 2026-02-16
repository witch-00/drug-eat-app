import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

interface MedicationRecord {
  id: number;
  elderly_id: number;
  record_date: string;
  status: "done" | "undone";
  created_at: string;
  created_time?: string;
  record_time?: string;
}

// GET 请求：查询记录
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const elderlyIdStr = searchParams.get("elderly_id");
    if (!elderlyIdStr) {
      return NextResponse.json({ error: "elderly_id is required" }, { status: 400 });
    }

    const elderlyId = Number(elderlyIdStr);
    if (Number.isNaN(elderlyId) || elderlyId <= 0) {
      return NextResponse.json({ error: "elderly_id is invalid" }, { status: 400 });
    }

    const records = (await sql`
      SELECT
        id,
        elderly_id,
        record_date,
        status,
        created_at,
        to_char(created_at, 'MM/DD HH24:MI') AS created_time,
        record_time
      FROM medication_record
      WHERE elderly_id = ${elderlyId}
      ORDER BY created_at DESC
    `) as MedicationRecord[];

    return NextResponse.json(records, { status: 200 });
  } catch (error) {
    console.error("GET /api/medication error:", error);
    return NextResponse.json({ error: "获取记录失败" }, { status: 500 });
  }
}

// POST 请求：新增/确认服药记录（适配confirm页面）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { elderly_id, record_date, status } = body ?? {};

    if (!elderly_id || !record_date || (status !== "done" && status !== "undone")) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }

    const rows = (await sql`
      INSERT INTO medication_record (elderly_id, record_date, status, record_time)
      VALUES (
        ${elderly_id},
        ${record_date},
        ${status},
        to_char((now() AT TIME ZONE 'Asia/Shanghai'), 'HH24:MI')
      )
      RETURNING id, elderly_id, record_date, status, created_at, record_time
    `) as MedicationRecord[];

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("POST /api/medication error:", error);
    return NextResponse.json({ error: "创建记录失败" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body ?? {};

    if (!id || (status !== "done" && status !== "undone")) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }

    const rows = (await sql`
      UPDATE medication_record
      SET status = ${status}
      WHERE id = ${id}
      RETURNING id, elderly_id, record_date, status, created_at
    `) as MedicationRecord[];

    if (!rows[0]) {
      return NextResponse.json({ error: "record not found" }, { status: 404 });
    }

    return NextResponse.json(rows[0], { status: 200 });
  } catch (error) {
    console.error("PATCH /api/medication error:", error);
    return NextResponse.json({ error: "更新记录失败" }, { status: 500 });
  }
}