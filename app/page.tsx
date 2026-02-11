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

const SCHEDULE: ScheduleItem[] = [
  {
    time: "08:00",
    label: "上午 8:00",
    medications: [
      { name: "降压药一号", quantity: 1 },
      { name: "降压药二号", quantity: 1 },
    ],
  },
  {
    time: "20:00",
    label: "晚上 8:00",
    medications: [{ name: "降压药一号", quantity: 1 }],
  },
];

// 可修改的默认老人信息（可修改）
// 将写入 localStorage 的 key: 'elderlyInfo'
// 打卡记录的 key 格式: 'checkIn_YYYY-MM-DD_HH:MM'
type ElderlyInfo = {
  name: string;
  plan: ScheduleItem[]; // 用药计划
};

type CheckInRecord = {
  elderlyName: string;
  scheduledTime: string; // e.g. "08:00"
  scheduledLabel?: string; // e.g. "上午 8:00"
  actualTimeISO: string;
  status: "completed" | string;
};

const DEFAULT_ELDERLY_INFO: ElderlyInfo = {
  // 可修改：默认老人姓名与用药计划
  name: "王阿姨",
  plan: SCHEDULE,
};

function parseHM(time: string) {
  const [hh, mm] = time.split(":").map((s) => parseInt(s, 10));
  return { hh, mm };
}

function isNowInWindow(now: Date, startHM: string, endHM: string) {
  const { hh: sh, mm: sm } = parseHM(startHM);
  const { hh: eh, mm: em } = parseHM(endHM);

  const start = new Date(now);
  start.setHours(sh, sm, 0, 0);
  const end = new Date(now);
  end.setHours(eh, em, 0, 0);

  return now >= start && now < end;
}

export default function Home(): React.ReactElement {
  const [now, setNow] = useState<Date>(new Date());
  const [taken, setTaken] = useState<boolean>(false);
  const [btnDisabled, setBtnDisabled] = useState<boolean>(false);
  const [elderly, setElderly] = useState<ElderlyInfo>(DEFAULT_ELDERLY_INFO);
  const router = useRouter();

  useEffect(() => {
    document.title = "老人用药提醒";
    const id = setInterval(() => setNow(new Date()), 1000);
    // 优先判断是否首次访问（isFirstVisit）。
    // 如果 localStorage 中没有 isFirstVisit 字段，则视为首次访问：
    // 立即写入 isFirstVisit=false 并跳转到设置页，然后返回（不执行后续逻辑）。
    try {
      const first = localStorage.getItem("isFirstVisit");
      if (first === null) {
        localStorage.setItem("isFirstVisit", "false");
        router.push("/elderly/settings");
        return () => clearInterval(id);
      }
    } catch (e) {
      // 若 localStorage 访问出错，继续执行后续逻辑（不跳转）
    }

    // 不是首次访问 —— 读取 elderlyInfo（但不再基于 plan 长度跳转）
    try {
      const raw = localStorage.getItem("elderlyInfo");
      if (raw) {
        const parsed = JSON.parse(raw) as ElderlyInfo;
        setElderly(parsed);
      } else {
        // 未配置过，但不是首次访问（例如用户清空过 elderlyInfo），保留默认值并不自动跳转
        setElderly(DEFAULT_ELDERLY_INFO);
      }
    } catch (e) {
      // ignore JSON errors and keep defaults
      setElderly(DEFAULT_ELDERLY_INFO);
    }

    return () => clearInterval(id);
  }, []);

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

  // 根据当前时间判断是否处于用药时段
  // 规定：06:00-09:00 -> 上午 8:00；19:00-21:00 -> 晚上 8:00
  const inMorningWindow = isNowInWindow(now, "06:00", "09:00");
  const inEveningWindow = isNowInWindow(now, "19:00", "21:00");

  let activeSchedule: ScheduleItem | null = null;
  if (inMorningWindow) activeSchedule = elderly.plan.find((s) => s.time === "08:00") ?? null;
  else if (inEveningWindow) activeSchedule = elderly.plan.find((s) => s.time === "20:00") ?? null;

  function handleTaken() {
    if (!activeSchedule) return;
    setBtnDisabled(true);

    // 构造 meds 参数：[{name, dosage}] 并编码为 JSON 字符串
    const medsForParam = activeSchedule.medications.map((m) => ({
      name: m.name,
      dosage: `${m.quantity}${m.unit ?? "片"}`,
    }));

    const params = new URLSearchParams();
    params.set("name", elderly.name);
    params.set("time", activeSchedule.time);
    if (activeSchedule.label) params.set("label", activeSchedule.label);
    params.set("meds", JSON.stringify(medsForParam));

    const url = `/elderly/confirm?${params.toString()}`;
    router.push(url);

    // 保持原有的防重复点击体验：导航后 2 秒内按钮仍为禁用状态
    setTimeout(() => setBtnDisabled(false), 2000);
  }

  return (
    <div className="min-h-screen bg-rose-50 flex items-start justify-center p-6">
      <main className="w-full max-w-lg">
        <header className="mb-6">
          <div className="text-right text-lg text-zinc-700">{timeLabel}</div>
          <h1 className="mt-2 text-4xl sm:text-5xl font-bold text-emerald-800">
            {elderly.name}，{greeting}！
          </h1>
          <p className="mt-2 text-lg sm:text-xl text-zinc-600">祝您今天身体安康</p>
        </header>

        <section
          className="mb-8 rounded-2xl bg-white p-6 shadow-md ring-1 ring-zinc-200"
          aria-labelledby="reminder-title"
        >
          {activeSchedule ? (
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <div id="reminder-title" className="text-2xl font-semibold text-zinc-800">
                    {activeSchedule.label} 该吃药了
                  </div>
                  <div className="mt-2 text-lg text-zinc-600">请按时服药，按医嘱执行</div>
                </div>
                <div className="text-sm text-zinc-500">提醒</div>
              </div>

              <ul className="mt-4 space-y-3 text-xl">
                {activeSchedule.medications.map((m) => (
                  <li
                    key={m.name}
                    className="flex items-center justify-between rounded-lg bg-emerald-50/80 p-3"
                  >
                    <span>{m.name}</span>
                    <span className="font-semibold">× {m.quantity}{m.unit ?? "片"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-2xl font-semibold text-zinc-800">暂无待服用药品</div>
            </div>
          )}
        </section>

        <div className="flex justify-center">
          {activeSchedule && !taken ? (
            <button
              aria-label="确认已服药"
              className="w-4/5 rounded-xl bg-emerald-600 text-white text-2xl sm:text-3xl py-4 shadow-lg hover:bg-emerald-700 active:scale-95 focus:outline-none focus:ring-4 focus:ring-emerald-200"
              onClick={handleTaken}
            >
              我吃药了
            </button>
          ) : null}
        </div>

        <footer className="mt-6 text-center text-sm text-zinc-500">
          如需修改用药时间或剂量，请咨询医生或家属帮助设置。
        </footer>
      </main>
    </div>
  );
}
