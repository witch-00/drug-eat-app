"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// TypeScript 类型（复用主页面类型定义）
type Medication = {
  name: string;
  quantity: number;
  unit?: string;
};

type ScheduleItem = {
  time: string; // "08:00"
  label?: string; // "上午 8:00"
  medications: Medication[];
};

type CheckInRecord = {
  elderlyName: string;
  scheduledTime: string; // "08:00"
  scheduledLabel?: string;
  actualTimeISO: string;
  status: "completed" | string;
};

export default function ConfirmPage(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [btnDisabled, setBtnDisabled] = useState(false);

  // 从 URL 查询参数读取数据：name, time, label, meds
  // meds 可为 JSON 编码的数组，或以 | 分隔的药名列表
  const elderlyName = searchParams.get("name") ?? "老人";
  const scheduledTime = searchParams.get("time") ?? "08:00";
  const scheduledLabel = searchParams.get("label") ?? undefined;
  const medsRaw = searchParams.get("meds") ?? "";

  const medications: Medication[] = useMemo(() => {
    if (!medsRaw) return [];
    try {
      const parsed = JSON.parse(medsRaw);
      if (Array.isArray(parsed)) return parsed as Medication[];
    } catch (e) {
      // not JSON, fallthrough
    }
    // fallback: split by '|', each part can be 'name x qty' or just name
    return medsRaw.split("|").map((s) => {
      const part = s.trim();
      const match = part.match(/(.+)\s*[x×]\s*(\d+)/);
      if (match) return { name: match[1].trim(), quantity: parseInt(match[2], 10) };
      return { name: part, quantity: 1 };
    });
  }, [medsRaw]);

  function saveCheckIn(status: "completed" | string) {
    const record: CheckInRecord = {
      elderlyName,
      scheduledTime,
      scheduledLabel,
      actualTimeISO: new Date().toISOString(),
      status,
    };

    try {
      const dateKey = new Date().toISOString().split("T")[0];
      const storageKey = `checkIn_${dateKey}_${scheduledTime}`; // 与主界面统一命名规则
      localStorage.setItem(storageKey, JSON.stringify(record));
    } catch (e) {
      // ignore
    }
  }

  async function handleConfirm() {
    if (btnDisabled) return;
    setBtnDisabled(true);
    saveCheckIn("completed");
    alert("已确认服药，即将返回主界面");
    // 2 秒后返回主界面
    setTimeout(() => router.push("/"), 2000);
  }

  function handleRemindLater() {
    if (btnDisabled) return;
    setBtnDisabled(true);
    // 不修改打卡，仅提示
    alert("已为您设置30分钟后再次提醒");
    setTimeout(() => router.push("/"), 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-800 mb-4">
          {elderlyName}，您确定已经吃过
          {medications.length > 0 ? (
            <span className="block mt-2 text-xl sm:text-2xl">{medications.map((m) => m.name).join("、")}</span>
          ) : (
            <span className="block mt-2 text-xl sm:text-2xl">该药品</span>
          )}
          吗？
        </h1>

        <div className="mt-6 flex gap-4 items-center justify-center">
          <button
            onClick={handleConfirm}
            disabled={btnDisabled}
            style={{ flexBasis: "70%" }}
            className={`rounded-xl py-4 text-white text-2xl sm:text-3xl shadow-md ${
              btnDisabled ? "bg-emerald-300" : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            是的，吃好了
          </button>

          <button
            onClick={handleRemindLater}
            disabled={btnDisabled}
            style={{ flexBasis: "30%" }}
            className={`rounded-xl py-4 text-white text-2xl sm:text-3xl shadow-md ${
              btnDisabled ? "bg-gray-300 text-gray-700" : "bg-gray-500 hover:bg-gray-600"
            }`}
          >
            还没吃
            <span className="block text-base">等会儿提醒我</span>
          </button>
        </div>
      </div>
    </div>
  );
}
