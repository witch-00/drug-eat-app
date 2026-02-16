"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// TypeScript 类型定义
type Medication = {
  name: string;
  quantity: number; // 数量
  unit?: string; // 片/粒/包/毫升
};

type ScheduleItem = {
  id: string;
  medication: Medication;
  times: string[]; // HH:MM
  note?: string;
};

type ElderlyInfo = {
  name: string;
  plans: ScheduleItem[];
  familyCode?: string;
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export default function SettingsPage(): React.ReactElement {
  // 确保初始状态中 plans 始终为数组，避免首次渲染时访问 undefined
  const [elderly, setElderly] = useState<ElderlyInfo>({ name: "王阿姨", plans: [], familyCode: undefined });
  const [elderlyId, setElderlyId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 表单字段
  const [nameInput, setNameInput] = useState("");
  const [medName, setMedName] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState<string>("片");
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [note, setNote] = useState("");

  // family code
  const [familyCode, setFamilyCode] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);
      try {
        await fetch("/api/user/me");
        const settingsRes = await fetch("/api/user/settings");
        if (!settingsRes.ok) {
          throw new Error("获取用户设置失败");
        }
        const settings = await settingsRes.json();
        const defaultId = settings?.default_elderly_id as number | null;
        if (defaultId) {
          const elderlyRes = await fetch(`/api/elderly?id=${defaultId}`);
          if (!elderlyRes.ok) {
            throw new Error("获取老人信息失败");
          }
          const data = await elderlyRes.json();
          setElderlyId(data.id ?? null);
          setFamilyCode(data.familyCode ?? null);
          setElderly({ name: data.name ?? "", plans: data.plans ?? [], familyCode: data.familyCode ?? undefined });
          setNameInput(data.name ?? "");
        } else {
          setElderly((prev) => ({ ...prev, name: "" }));
        }
      } catch {
        setError("加载数据失败，请刷新重试");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // 表单验证
  const formValid = useMemo(() => {
    return medName.trim().length > 0 && quantity > 0 && times.length > 0;
  }, [medName, quantity, times]);

  function persistElderly(next: ElderlyInfo) {
    setElderly(next);
  }

  function handleAddTime() {
    setTimes((t) => [...t, "08:00"]);
  }

  function handleRemoveTime(idx: number) {
    setTimes((t) => t.filter((_, i) => i !== idx));
  }

  function handleSave() {
    if (!elderly) return;
    if (!formValid) return;

    const item: ScheduleItem = editingId
      ? {
          id: editingId,
          medication: { name: medName.trim(), quantity, unit },
          times: times.map((s) => s),
          note: note.trim(),
        }
      : {
          id: uid(),
          medication: { name: medName.trim(), quantity, unit },
          times: times.map((s) => s),
          note: note.trim(),
        };

    let nextPlans: ScheduleItem[];
    if (editingId) {
      nextPlans = elderly.plans.map((p) => (p.id === editingId ? item : p));
    } else {
      nextPlans = [...elderly.plans, item];
    }

    const next: ElderlyInfo = { ...elderly, name: nameInput.trim() || elderly.name, plans: nextPlans };
    persistElderly(next);

    // 重置表单
    setMedName("");
    setQuantity(1);
    setUnit("片");
    setTimes(["08:00"]);
    setNote("");
    setShowForm(false);
    setEditingId(null);
  }

  function startEdit(item: ScheduleItem) {
    setEditingId(item.id);
    setMedName(item.medication.name);
    setQuantity(item.medication.quantity);
    setUnit(item.medication.unit ?? "片");
    setTimes(item.times.length ? item.times : ["08:00"]);
    setNote(item.note ?? "");
    setShowForm(true);
  }

  function handleDelete(item: ScheduleItem) {
    if (!elderly) return;
    if (!confirm("确定删除该药品吗？")) return;
    const next = { ...elderly, plans: elderly.plans.filter((p) => p.id !== item.id) };
    persistElderly(next);
  }

  function handleCopyCode() {
    if (!familyCode) return;
    try {
      navigator.clipboard.writeText(familyCode);
      alert("复制成功");
    } catch {
      alert("复制失败，请手动复制：" + familyCode);
    }
  }

  async function saveElderlyToApi() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        id: elderlyId,
        name: nameInput.trim() || elderly.name,
        plans: elderly.plans,
        familyCode,
      };

      const res = await fetch("/api/elderly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let message = "保存老人信息失败";
        try {
          const err = await res.json();
          if (err?.error) message = err.error;
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      const data = await res.json();
      setElderlyId(data.id ?? null);
      setFamilyCode(data.familyCode ?? null);
      setElderly({ name: data.name ?? "", plans: data.plans ?? [], familyCode: data.familyCode ?? undefined });
      setNameInput(data.name ?? "");

      setSuccess("保存成功，家庭查看码已更新");

      if (data.id) {
        await fetch("/api/user/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ default_elderly_id: data.id }),
        });
      }

      return data.id as number;
    } catch (e) {
      const message = e instanceof Error ? e.message : "保存失败，请稍后重试";
      setError(message);
      return null;
    } finally {
      setSaving(false);
    }
  }
  // 完成配置并返回主页面：保存当前用药计划并跳转
  function handleFinishAndReturn() {
    if (!elderly || !(elderly.plans && elderly.plans.length > 0)) {
      alert("请至少添加一种药品后再完成");
      return;
    }

    saveElderlyToApi().then((id) => {
      if (id) {
        alert("用药计划已保存，返回首页");
        router.push("/");
      }
    });
  }

  if (loading) return <div className="p-6">加载中…</div>;

  return (
    <div className="min-h-screen bg-white p-6 sm:p-8">
      <div className="max-w-xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-black text-center flex-1">我的用药计划</h1>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="ml-4 bg-blue-200 text-blue-800 px-4 py-2 rounded-lg text-lg"
            aria-expanded={showForm}
          >
            添加药品
          </button>
        </header>

        {error ? (
          <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-3">{error}</div>
        ) : null}
        {success ? (
          <div className="mb-4 rounded-lg bg-emerald-50 text-emerald-700 px-4 py-3">{success}</div>
        ) : null}

        <section className="mb-6">
          {elderly.plans.length === 0 ? (
            <div className="py-12 text-center text-xl text-gray-600">暂无用药计划，点击添加</div>
          ) : (
            <ul className="space-y-3">
              {elderly.plans.map((p) => (
                <li
                  key={p.id}
                  className="border rounded-lg p-4 flex items-center justify-between shadow-sm"
                >
                  <div>
                      <div className="text-[20px] font-bold text-black">{p.medication.name}</div>
                      <div className="text-[18px] text-[#333333]">{p.medication.quantity}{p.medication.unit}</div>
                      <div className="text-[18px] text-[#333333]">{p.times.join("，")}</div>
                    {p.note ? <div className="text-sm text-gray-500">{p.note}</div> : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button onClick={() => startEdit(p)} className="text-blue-600 text-lg">编辑</button>
                    <button onClick={() => handleDelete(p)} className="text-red-600 text-lg">删除</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className={`overflow-hidden transition-all duration-300 ${showForm ? "max-h-[800px] pb-6" : "max-h-0"}`}
        >
          <div className="border p-4 rounded-lg">
            <div className="mb-3">
              <label className="block text-[18px] font-semibold text-black mb-1">姓名（可选）</label>
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full bg-white border border-[#666666] text-black text-[16px] font-semibold placeholder-[#999999] rounded p-3 min-h-[48px] focus:outline-none focus:border-[#1677ff] focus:shadow-md focus:shadow-[#1677ff]/20"
                placeholder="请输入老人姓名（如王阿姨)"
              />
            </div>

            <div className="mb-3">
              <label className="block text-[18px] font-semibold text-black mb-1">药品名称</label>
              <input
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
                className="w-full bg-white border border-[#666666] text-black text-[16px] font-semibold placeholder-[#999999] rounded p-3 min-h-[48px] focus:outline-none focus:border-[#1677ff] focus:shadow-md focus:shadow-[#1677ff]/20"
                placeholder="请输入药品名称（如降压药）"
              />
              {medName.trim().length === 0 ? (
                <div className="text-red-600 mt-1">药品名称不能为空</div>
              ) : null}
            </div>

            <div className="mb-3 flex gap-3 items-center">
              <div className="flex-1">
                <label className="block text-[18px] font-semibold text-black mb-1">每次用量</label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full bg-white border border-[#666666] text-black text-[16px] font-semibold placeholder-[#999999] rounded p-3 min-h-[48px] focus:outline-none focus:border-[#1677ff] focus:shadow-md focus:shadow-[#1677ff]/20"
                />
              </div>
              <div>
                <label className="block text-[18px] font-semibold text-black mb-1">单位</label>
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className="bg-white border border-[#666666] text-black text-[16px] font-semibold rounded p-3 min-h-[48px] focus:outline-none focus:border-[#1677ff] focus:shadow-md focus:shadow-[#1677ff]/20">
                  <option>片</option>
                  <option>粒</option>
                  <option>包</option>
                  <option>毫升</option>
                </select>
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-[18px] font-semibold text-black mb-1">服药时间</label>
              <div className="space-y-2">
                {times.map((t, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="time"
                      value={t}
                      onChange={(e) => setTimes((s) => s.map((v, idx) => (idx === i ? e.target.value : v)))}
                      className="bg-white border border-[#666666] text-black text-[16px] font-semibold rounded p-3 min-h-[48px] focus:outline-none focus:border-[#1677ff] focus:shadow-md focus:shadow-[#1677ff]/20"
                    />
                    <button onClick={() => handleRemoveTime(i)} className="text-red-600">删除</button>
                  </div>
                ))}
                <button onClick={handleAddTime} className="mt-2 bg-gray-100 px-3 py-2 rounded text-lg">+ 添加服药时间</button>
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-[18px] font-semibold text-black mb-1">备注（可选）</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full bg-white border border-[#666666] text-black text-[16px] font-semibold placeholder-[#999999] rounded p-3 min-h-[48px] focus:outline-none focus:border-[#1677ff] focus:shadow-md focus:shadow-[#1677ff]/20" placeholder="如：餐后服用、睡前服用" />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={!formValid}
                className={`px-6 py-3 rounded text-white text-xl ${formValid ? "bg-blue-500" : "bg-gray-300 text-gray-600"}`}
              >
                保存
              </button>
            </div>
          </div>
        </section>

        <section className="mt-8 text-center">
          <h2 className="text-2xl font-bold text-black">您的家庭查看码</h2>
          <div className="mt-3 text-2xl font-bold text-black">{familyCode ?? "保存后生成"}</div>
          <div className="mt-2 text-[16px] text-[#333333]">请将此码告诉子女，他们可以随时查看您的用药记录</div>
          <div className="mt-4 flex justify-center gap-4">
            <button
              onClick={handleCopyCode}
              disabled={!familyCode}
              className={`bg-gray-200 px-4 py-2 rounded text-lg ${!familyCode ? "opacity-50" : ""}`}
            >
              点击复制查看码
            </button>
            <button onClick={() => alert("请将复制的查看码发给子女")} className="bg-green-200 px-4 py-2 rounded text-lg">分享到微信</button>
          </div>
        </section>
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleFinishAndReturn}
            disabled={saving}
            className={`w-4/5 rounded-xl text-white text-2xl sm:text-3xl py-4 shadow-lg ${
              saving ? "bg-emerald-300" : "bg-emerald-600"
            }`}
          >
            {saving ? "保存中..." : "完成并返回"}
          </button>
        </div>
      </div>
    </div>
  );
}
