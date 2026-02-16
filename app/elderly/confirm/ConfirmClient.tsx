"use client";
import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Medication = {
  name: string;
  quantity: number;
  unit?: string;
};

export default function ConfirmClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [btnDisabled, setBtnDisabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elderlyName = searchParams.get("name") ?? "老人";
  const medsRaw = searchParams.get("meds") ?? "";

  const medications: Medication[] = useMemo(() => {
    if (!medsRaw) return [];
    try {
      const parsed = JSON.parse(medsRaw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return medsRaw.split("|").map(s => {
        const match = s.trim().match(/(.+)\s*[x×]\s*(\d+)/);
        return match
          ? { name: match[1].trim(), quantity: parseInt(match[2]) }
          : { name: s.trim(), quantity: 1 };
      });
    }
  }, [medsRaw]);

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

  async function saveCheckIn(status: "done" | "undone") {
    setSaving(true);
    setError(null);
    try {
      const elderlyId = await resolveElderlyId();
      if (!elderlyId) {
        setError("未找到老人信息，请先在设置页完成配置");
        return false;
      }

      const recordDate = new Date().toISOString().split("T")[0];
      const res = await fetch("/api/medication", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elderly_id: elderlyId, record_date: recordDate, status }),
      });
      if (!res.ok) throw new Error("保存失败");
      return true;
    } catch {
      setError("保存记录失败，请重试");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm() {
    if (btnDisabled || saving) return;
    setBtnDisabled(true);
    const ok = await saveCheckIn("done");
    if (ok) {
      alert("已确认服药，即将返回");
      setTimeout(() => router.push("/"), 2000);
    } else {
      setBtnDisabled(false);
    }
  }

  async function handleRemindLater() {
    if (btnDisabled || saving) return;
    setBtnDisabled(true);
    const ok = await saveCheckIn("undone");
    if (ok) {
      alert("30分钟后再次提醒");
      setTimeout(() => router.push("/"), 2000);
    } else {
      setBtnDisabled(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-lg p-6">
        {error ? (
          <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-3">{error}</div>
        ) : null}
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
            disabled={btnDisabled || saving}
            style={{ flexBasis: "70%" }}
            className={`rounded-xl py-4 text-white text-2xl ${
              btnDisabled || saving ? "bg-emerald-300" : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {saving ? "保存中..." : "是的，吃好了"}
          </button>
          <button
            onClick={handleRemindLater}
            disabled={btnDisabled || saving}
            style={{ flexBasis: "30%" }}
            className={`rounded-xl py-4 text-white text-2xl ${
              btnDisabled || saving ? "bg-gray-300 text-gray-700" : "bg-gray-500 hover:bg-gray-600"
            }`}
          >
            还没吃
            <span className="block text-base">等会儿提醒</span>
          </button>
        </div>
      </div>
    </div>
  );
}