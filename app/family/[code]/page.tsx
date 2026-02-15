'use client';

import { useState, useEffect } from 'react';

// 定义服药记录的数据类型（匹配 API 返回格式）
interface MedicationRecord {
  id: number;
  elderly_id: number;
  record_date: string;
  status: 'done' | 'undone';
  created_at: string;
}

// 默认测试用的老人ID（可根据实际需求调整，比如从URL参数获取）
const DEFAULT_ELDERLY_ID = 1;

export default function MedicationTracker() {
  // 状态管理
  const [records, setRecords] = useState<MedicationRecord[]>([]);
  const [newRecordDate, setNewRecordDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newRecordStatus, setNewRecordStatus] = useState<'done' | 'undone'>('undone');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 1. 页面加载时调用 GET API 获取服药记录
  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      // 调用 API，筛选指定老人的记录
      const res = await fetch(`/api/medication?elderly_id=${DEFAULT_ELDERLY_ID}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('获取服药记录失败');
      }

      const data = await res.json();
      setRecords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
      console.error('获取记录失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 页面初始化加载数据
  useEffect(() => {
    fetchRecords();
  }, []);

  // 2. 点击添加按钮调用 POST API 创建新记录
  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const newRecord = {
        elderly_id: DEFAULT_ELDERLY_ID,
        record_date: newRecordDate,
        status: newRecordStatus,
      };

      const res = await fetch('/api/medication', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newRecord),
      });

      if (!res.ok) {
        throw new Error('创建服药记录失败');
      }

      // 创建成功后刷新列表
      fetchRecords();
      // 重置表单
      setNewRecordDate(new Date().toISOString().split('T')[0]);
      setNewRecordStatus('undone');
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
      console.error('创建记录失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 3. 勾选复选框调用 PATCH API 更新状态
  const handleToggleStatus = async (id: number, currentStatus: 'done' | 'undone') => {
    setLoading(true);
    setError(null);

    try {
      const updatedStatus = currentStatus === 'done' ? 'undone' : 'done';
      const res = await fetch('/api/medication', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          status: updatedStatus,
        }),
      });

      if (!res.ok) {
        throw new Error('更新服药状态失败');
      }

      // 更新成功后刷新列表
      fetchRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
      console.error('更新状态失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 页面渲染
  return (
    <main className="max-w-4xl mx-auto p-6 bg-white min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">老人服药打卡管理</h1>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* 添加新打卡记录表单 */}
      <form onSubmit={handleAddRecord} className="mb-8 p-4 border rounded-lg">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">
              打卡日期
            </label>
            <input
              type="date"
              value={newRecordDate}
              onChange={(e) => setNewRecordDate(e.target.value)}
              className="px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">
              服药状态
            </label>
            <select
              value={newRecordStatus}
              onChange={(e) => setNewRecordStatus(e.target.value as 'done' | 'undone')}
              className="px-3 py-2 border rounded-md"
            >
              <option value="undone">未服药</option>
              <option value="done">已服药</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? '添加中...' : '添加打卡记录'}
        </button>
      </form>

      {/* 服药记录列表 */}
      <div className="border rounded-lg">
        {loading && records.length === 0 ? (
          <div className="p-6 text-center text-gray-500">加载中...</div>
        ) : records.length === 0 ? (
          <div className="p-6 text-center text-gray-500">暂无服药打卡记录</div>
        ) : (
          <ul className="divide-y">
            {records.map((record) => (
              <li key={record.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={record.status === 'done'}
                    onChange={() => handleToggleStatus(record.id, record.status)}
                    className="h-5 w-5"
                    disabled={loading}
                  />
                  <div>
                    <p className="font-medium">
                      {record.record_date} - {record.status === 'done' ? '已服药' : '未服药'}
                    </p>
                    <p className="text-sm text-gray-500">
                      记录时间: {new Date(record.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span className="text-sm text-gray-400">老人ID: {record.elderly_id}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}