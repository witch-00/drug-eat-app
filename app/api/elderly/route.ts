import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

interface PlanPayload {
  id?: string | number;
  medication: {
    name: string;
    quantity: number;
    unit?: string;
  };
  times: string[];
  note?: string;
}

interface ElderlyResponse {
  id: number;
  name: string;
  familyCode: string | null;
  plans: Array<{
    id: number;
    medication: { name: string; quantity: number; unit?: string };
    times: string[];
    note?: string | null;
  }>;
}

function generateFamilyCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `YAO-${s}`;
}

async function getElderlyById(elderlyId: number): Promise<ElderlyResponse | null> {
  const elderlyRows = (await sql`
    SELECT id, name
    FROM elderly
    WHERE id = ${elderlyId}
    LIMIT 1
  `) as Array<{ id: number; name: string }>;

  if (!elderlyRows[0]) return null;

  const codeRows = (await sql`
    SELECT code
    FROM family_code
    WHERE elderly_id = ${elderlyId}
    LIMIT 1
  `) as Array<{ code: string }>;

  const planRows = (await sql`
    SELECT id, med_name, quantity, unit, note
    FROM medication_plan
    WHERE elderly_id = ${elderlyId}
    ORDER BY id ASC
  `) as Array<{ id: number; med_name: string; quantity: number; unit?: string | null; note?: string | null }>;

  const planIds = planRows.map((p) => p.id);
  let timeRows: Array<{ plan_id: number; time_hhmm: string }> = [];
  if (planIds.length > 0) {
    timeRows = (await sql`
      SELECT plan_id, time_hhmm
      FROM medication_time
      WHERE plan_id = ANY(${planIds})
      ORDER BY id ASC
    `) as Array<{ plan_id: number; time_hhmm: string }>;
  }

  const timeMap = new Map<number, string[]>();
  for (const row of timeRows) {
    if (!timeMap.has(row.plan_id)) timeMap.set(row.plan_id, []);
    timeMap.get(row.plan_id)!.push(row.time_hhmm);
  }

  return {
    id: elderlyRows[0].id,
    name: elderlyRows[0].name,
    familyCode: codeRows[0]?.code ?? null,
    plans: planRows.map((p) => ({
      id: p.id,
      medication: { name: p.med_name, quantity: p.quantity, unit: p.unit ?? undefined },
      times: timeMap.get(p.id) ?? [],
      note: p.note ?? null,
    })),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idStr = searchParams.get("id");
    if (!idStr) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const id = Number(idStr);
    if (Number.isNaN(id) || id <= 0) {
      return NextResponse.json({ error: "id is invalid" }, { status: 400 });
    }

    const data = await getElderlyById(id);
    if (!data) {
      return NextResponse.json({ error: "elderly not found" }, { status: 404 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("GET /api/elderly error:", error);
    return NextResponse.json({ error: "获取老人信息失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, plans, familyCode } = body ?? {};

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const planPayload = Array.isArray(plans) ? (plans as PlanPayload[]) : [];

    let elderlyId = Number(id);
    if (!elderlyId || Number.isNaN(elderlyId)) {
      const rows = (await sql`
        INSERT INTO elderly (name)
        VALUES (${name})
        RETURNING id
      `) as Array<{ id: number }>;
      elderlyId = rows[0].id;
    } else {
      await sql`
        UPDATE elderly
        SET name = ${name}
        WHERE id = ${elderlyId}
      `;
    }

    const existingCodeRows = (await sql`
      SELECT code
      FROM family_code
      WHERE elderly_id = ${elderlyId}
      LIMIT 1
    `) as Array<{ code: string }>;

    const finalCode = familyCode || existingCodeRows[0]?.code || generateFamilyCode();

    await sql`
      DELETE FROM family_code
      WHERE elderly_id = ${elderlyId}
    `;

    await sql`
      INSERT INTO family_code (elderly_id, code)
      VALUES (${elderlyId}, ${finalCode})
    `;

    await sql`
      DELETE FROM medication_plan
      WHERE elderly_id = ${elderlyId}
    `;

    for (const plan of planPayload) {
      const med = plan.medication ?? { name: "", quantity: 0 };
      if (!med.name || !med.quantity) continue;

      const inserted = (await sql`
        INSERT INTO medication_plan (elderly_id, med_name, quantity, unit, note)
        VALUES (${elderlyId}, ${med.name}, ${med.quantity}, ${med.unit ?? null}, ${plan.note ?? null})
        RETURNING id
      `) as Array<{ id: number }>;

      const planId = inserted[0].id;
      const times = Array.isArray(plan.times) ? plan.times : [];
      for (const time of times) {
        if (!time) continue;
        await sql`
          INSERT INTO medication_time (plan_id, time_hhmm)
          VALUES (${planId}, ${time})
        `;
      }
    }

    const data = await getElderlyById(elderlyId);
    if (!data) {
      return NextResponse.json({ error: "elderly not found" }, { status: 404 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("POST /api/elderly error:", error);
    return NextResponse.json({ error: "保存老人信息失败" }, { status: 500 });
  }
}
