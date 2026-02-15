"use client";
import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Medication = {
  name: string;
  quantity: number;
  unit?: string;
};

export default function ConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [btnDisabled, setBtnDisabled] = useState(false);
  const [loading, setLoading] = useState(false);

  // 读取URL参数
  const elderlyName = searchParams.get("name") ?? "老人";
  const scheduledTime = searchParams.get("time") ?? "08:00";
  const medsRaw = searchParams.get("meds") ?? "";

  // 解析药品列表
  const medications: Medication[] = useMemo(() => {
    if (!medsRaw) return [];
    try {
      const parsed = JSON.parse(medsRaw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return medsRaw.split("|").map(s => {
        const match = s.trim().match(/(.+)\s*[x×]\s*(\d+)/);
        return match ? { name: match[1].trim(), quantity: parseInt(match[2]) } : { name: s.trim(), quantity: 1 };
      });
    }
  }, [medsRaw]);

  // 调用你的/api/medication保存数据
  async function saveCheckIn(status: "completed" | "remind_later") {
    setLoading(true);
    try {
      const res = await fetch("/api/medication", { // 改这里！用你的API路径
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elderlyName, scheduledTime, status, meds: medications }),
      });
      if (!res.ok) throw new Error("保存失败");
    } catch (e) {
      alert("保存记录失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  // 确认服药
  async function handleConfirm() {
    if (btnDisabled || loading) return;
    setBtnDisabled(true);
    await saveCheckIn("completed");
    alert("已确认服药，即将返回");
    setTimeout(() => router.push("/"), 2000);
  }

  // 稍后提醒
  function handleRemindLater() {
    if (btnDisabled || loading) return;
    setBtnDisabled(true);
    alert("30分钟后再次提醒");
    setTimeout(() => router.push("/"), 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4">
          {elderlyName}，您确定吃过
          {medications.length > 0 ? (
            <span className="block mt-2">{medications.map(m => m.name).join("、")}</span>
          ) : (
            <span className="block mt-2">该药品</span>
          )}
          吗？
        </h1>
        <div className="mt-6 flex gap-4 justify-center">
          <button
            onClick={handleConfirm}
            disabled={btnDisabled || loading}
            style={{ flexBasis: "70%" }}
            className={`rounded-xl py-4 text-white text-2xl ${btnDisabled || loading ? "bg-emerald-300" : "bg-emerald-600 hover:bg-emerald-700"}`}
          >
            {loading ? "保存中..." : "是的，吃好了"}
          </button>
          <button
            onClick={handleRemindLater}
            disabled={btnDisabled || loading}
            style={{ flexBasis: "30%" }}
            className={`rounded-xl py-4 text-white text-2xl ${btnDisabled || loading ? "bg-gray-300 text-gray-700" : "bg-gray-500 hover:bg-gray-600"}`}
          >
            还没吃
            <span className="block text-base">等会儿提醒</span>
          </button>
        </div>
      </div>
    </div>
  );
}