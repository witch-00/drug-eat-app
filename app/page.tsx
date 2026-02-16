"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// TypeScript 类型定义
type Medication = {
  name: string;
  quantity: number; // 片数
  unit?: string; // 可选单位，默认 '片'
};

type ScheduleItem = {
  time: string; // 24h 格式，例如 "08:00"
  label: string; // 展示用标签，例如 "上午 8:00"
  medications: Medication[];
};
type MedicationPlan = {
  id: string;
  medication: Medication;
  times: string[];
  note?: string;
};

type ElderlyProfile = {
  id: number;
  name: string;
  plans: MedicationPlan[];
};

type MedicationRecord = {
  id: number;
  elderly_id: number;
  record_date: string;
  status: "done" | "undone";
  created_at: string;
  created_time?: string;
  record_time?: string;
};

function parseHM(time: string) {
  const [hh, mm] = time.split(":").map((s) => parseInt(s, 10));
  return { hh, mm };
}

function isNowInWindow(now: Date, targetHM: string, beforeMinutes = 30, afterMinutes = 90) {
  const { hh, mm } = parseHM(targetHM);
  const target = new Date(now);
  target.setHours(hh, mm, 0, 0);

  const start = new Date(target);
  start.setMinutes(start.getMinutes() - beforeMinutes);
  const end = new Date(target);
  end.setMinutes(end.getMinutes() + afterMinutes);

  return now >= start && now <= end;
}

function formatLabel(time: string) {
  const [hh, mm] = time.split(":").map((s) => parseInt(s, 10));
  const hhText = hh.toString().padStart(2, "0");
  const mmText = mm.toString().padStart(2, "0");
  if (hh < 12) return `上午 ${hhText}:${mmText}`;
  if (hh < 18) return `下午 ${hhText}:${mmText}`;
  return `晚上 ${hhText}:${mmText}`;
}

function buildSchedule(plans: MedicationPlan[]): ScheduleItem[] {
  const timeMap = new Map<string, Medication[]>();
  for (const plan of plans) {
    for (const time of plan.times ?? []) {
      if (!timeMap.has(time)) timeMap.set(time, []);
      timeMap.get(time)!.push(plan.medication);
    }
  }

  return Array.from(timeMap.entries())
    .map(([time, medications]) => ({ time, label: formatLabel(time), medications }))
    .sort((a, b) => (a.time < b.time ? -1 : 1));
}

function formatRecordDate(value: string) {
  if (!value) return "-";
  // If backend returns ISO with time, normalize to local date
  if (value.includes("T")) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
    }
  }
  return value;
}

function formatRecordTime(value: string, createdTime?: string, recordTime?: string) {
  if (recordTime) return recordTime;
  if (createdTime) return createdTime;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Shanghai",
  });
}

export default function Home(): React.ReactElement {
  const [now, setNow] = useState<Date>(new Date());
  const [taken, setTaken] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [elderly, setElderly] = useState<ElderlyProfile | null>(null);
  const [records, setRecords] = useState<MedicationRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    document.title = "老人用药提醒";
    const id = setInterval(() => setNow(new Date()), 1000);
    const load = async () => {
      setLoading(true);
      try {
        await fetch("/api/user/me");
        const settingsRes = await fetch("/api/user/settings");
        if (!settingsRes.ok) throw new Error("获取用户设置失败");
        const settings = await settingsRes.json();
        const defaultId = settings?.default_elderly_id as number | null;
        if (!defaultId) {
          router.push("/elderly/settings");
          return;
        }

        const elderlyRes = await fetch(`/api/elderly?id=${defaultId}`);
        if (!elderlyRes.ok) throw new Error("获取老人信息失败");
        const elderlyData = await elderlyRes.json();
        setElderly(elderlyData);

        const recordRes = await fetch(`/api/medication?elderly_id=${defaultId}`);
        if (recordRes.ok) {
          const recordData = await recordRes.json();
          setRecords(Array.isArray(recordData) ? recordData : []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    load();

    return () => clearInterval(id);
  }, [router]);

  // 问候语（按小时判断）
  const hour = now.getHours();
  const greeting =
    hour >= 6 && hour < 12
      ? "早上好"
      : hour >= 12 && hour < 18
      ? "下午好"
      : hour >= 18 && hour < 24
      ? "晚上好"
      : "凌晨好";

  const timeLabel = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const schedule = buildSchedule(elderly?.plans ?? []);
  let activeSchedule: ScheduleItem | null = null;
  for (const item of schedule) {
    if (isNowInWindow(now, item.time)) {
      activeSchedule = item;
      break;
    }
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const hasDoneToday = records.some((r) => r.record_date === todayStr && r.status === "done");
  const isDone = taken || hasDoneToday;

  async function resolveElderlyId(): Promise<number | null> {
    try {
      await fetch("/api/user/me");
      const settingsRes = await fetch("/api/user/settings");
      if (!settingsRes.ok) return null;
      const settings = await settingsRes.json();
      const defaultId = settings?.default_elderly_id as number | null;
      return defaultId ?? null;
    } catch {
      return null;
    }
  }

  async function handleTaken() {
    if (!activeSchedule || saving) return;
    setSaving(true);
    setError(null);
    try {
      const elderlyId = await resolveElderlyId();
      if (!elderlyId) {
        setError("未找到老人信息，请先在设置页完成配置");
        return;
      }

      const res = await fetch("/api/medication", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elderly_id: elderlyId, record_date: todayStr, status: "done" }),
      });
      if (!res.ok) throw new Error("保存失败");

      const recordRes = await fetch(`/api/medication?elderly_id=${elderlyId}`);
      if (recordRes.ok) {
        const recordData = await recordRes.json();
        setRecords(Array.isArray(recordData) ? recordData : []);
      }

      setTaken(true);
    } catch {
      setError("保存记录失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  // removed legacy navigation-based handler

  return loading ? (
    <div className="p-6">加载中…</div>
  ) : (
    <div className="min-h-screen bg-rose-50 flex items-start justify-center p-6">
      <main className="w-full max-w-lg">
        <header className="mb-6">
          <div className="text-right text-lg text-zinc-700">{timeLabel}</div>
          <h1 className="mt-2 text-4xl sm:text-5xl font-bold text-emerald-800">
            {elderly?.name ?? "老人"}，{greeting}！
          </h1>
          <p className="mt-2 text-lg sm:text-xl text-zinc-800">祝您今天身体安康</p>
        </header>

        {error ? (
          <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-3">{error}</div>
        ) : null}

        <section
          className="mb-8 rounded-2xl bg-white p-6 shadow-md ring-1 ring-zinc-200"
          aria-labelledby="reminder-title"
        >
          {activeSchedule ? (
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <div id="reminder-title" className="text-2xl font-semibold text-zinc-900">
                    {isDone ? `${activeSchedule.label} 已完成` : `${activeSchedule.label} 该吃药了`}
                  </div>
                  <div className="mt-2 text-lg text-zinc-800">
                    {isDone ? "已完成今日用药" : "请按时服药，按医嘱执行"}
                  </div>
                </div>
                <div className="text-sm text-zinc-700">提醒</div>
              </div>

              <ul className="mt-4 space-y-3 text-xl">
                {activeSchedule.medications.map((m) => (
                  <li
                    key={m.name}
                    className="flex items-center justify-between rounded-lg bg-emerald-50/80 p-3 text-emerald-900"
                  >
                    <span>{m.name}</span>
                    <span className="font-semibold">× {m.quantity}{m.unit ?? "片"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-2xl font-semibold text-zinc-900">暂无待服用药品</div>
            </div>
          )}
        </section>

        <div className="flex justify-center">
          {activeSchedule && !isDone ? (
            <button
              aria-label="确认已服药"
              className="w-4/5 rounded-xl bg-emerald-600 text-white text-2xl sm:text-3xl py-4 shadow-lg hover:bg-emerald-700 active:scale-95 focus:outline-none focus:ring-4 focus:ring-emerald-200"
              onClick={handleTaken}
              disabled={saving}
            >
              {saving ? "保存中..." : "我吃药了"}
            </button>
          ) : null}
        </div>

        <footer className="mt-6 text-center text-sm text-zinc-500">
          如需修改用药时间或剂量，请咨询医生或家属帮助设置。
        </footer>

        {/* 近7天用药记录模块 */}
        <section className="mt-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">近7天用药记录</h2>
            <div className="text-sm text-zinc-700">共 {records.length} 条</div>
          </div>

          <div className="mt-3 space-y-2">
            {(records.slice(0, 7)).length === 0 ? (
              <div className="text-zinc-700 py-4 text-center">暂无记录</div>
            ) : (
              records.slice(0, 7).map((r, idx) => (
                <div
                  key={r.id + "-" + idx}
                  className="flex items-start justify-between rounded-lg border p-3"
                >
                  <div>
                    <div className="text-sm text-zinc-900">
                      {formatRecordTime(r.created_at, r.created_time, r.record_time)} - {r.status === "done" ? "已服药" : "未服药"}
                    </div>
                    <div className="mt-1 text-sm text-zinc-800">
                      记录时间：{formatRecordDate(r.record_date)} {r.record_time ?? ""}
                    </div>
                  </div>
                  <div className="ml-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        r.status === "done" ? "bg-emerald-100 text-emerald-800" : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {r.status === "done" ? "已完成" : "未完成"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
