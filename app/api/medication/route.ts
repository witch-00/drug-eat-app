import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

// 创建 Neon 数据库连接
const sql = neon(process.env.DATABASE_URL!);

// 定义用药记录类型
interface MedicationRecord {
  id: number;
  elderly_id: number;
  record_date: string;
  status: string;
  scheduled_time?: string;
  actual_time?: string;
  meds?: string;
  created_at: string;
}

// GET 请求：查询记录
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const elderlyIdStr = searchParams.get('elderlyId');

    let records: MedicationRecord[];

    if (elderlyIdStr) {
      const elderlyId = Number(elderlyIdStr);
      if (isNaN(elderlyId) || elderlyId <= 0) {
        return NextResponse.json({ error: '无效的 elderlyId 参数' }, { status: 400 });
      }

      records = await sql`
        SELECT id, elderly_id, record_date, status, scheduled_time, actual_time, meds, created_at
        FROM medication_records
        WHERE elderly_id = ${elderlyId}
        ORDER BY created_at DESC
      ` as MedicationRecord[];
    } else {
      records = await sql`
        SELECT id, elderly_id, record_date, status, scheduled_time, actual_time, meds, created_at
        FROM medication_records
        ORDER BY created_at DESC
      ` as MedicationRecord[];
    }

    return NextResponse.json(records, { status: 200 });
  } catch (error) {
    console.error('GET /api/medication error:', error);
    return NextResponse.json({ error: '获取记录失败' }, { status: 500 });
  }
}

// POST 请求：新增/确认服药记录（适配confirm页面）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { elderlyName, scheduledTime, status, meds } = body;

    // 1. 先查老人ID
    const elderlyResult = await sql`
      SELECT id FROM elderly_profiles WHERE name = ${elderlyName}
    `;
    if (elderlyResult.length === 0) {
      return NextResponse.json({ error: '老人不存在' }, { status: 404 });
    }
    const elderlyId = elderlyResult[0].id;

    // 2. 写入服药记录
    await sql`
      INSERT INTO medication_records (
        elderly_id, record_date, status, scheduled_time, actual_time, meds
      ) VALUES (
        ${elderlyId}, CURRENT_DATE, ${status}, ${scheduledTime}, 
        ${status === 'completed' ? new Date().toISOString() : null}, 
        ${JSON.stringify(meds)}::jsonb
      )
    `;

    // 3. 更新老人状态
    await sql`
      UPDATE elderly_profiles 
      SET status = ${status === 'completed' ? '已按时服药' : '有待服药提醒'},
          update_time = CURRENT_TIMESTAMP,
          last_record = ${`${scheduledTime} ${status}`}
      WHERE id = ${elderlyId}
    `;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('POST /api/medication error:', error);
    return NextResponse.json({ error: '保存记录失败' }, { status: 500 });
  }
}