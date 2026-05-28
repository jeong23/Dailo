import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api, { getStoredMemberId } from '../api/axios';

interface Habit {
  id: number;
  name: string;
  emoji: string;
  color: string;
  habitType: string; // "GOOD" | "BAD"
  sortOrder: number;
}

interface HabitLog {
  id: number;
  habitId: number;
  logDate: string;
  count: number;
}

const COLORS = [
  '#f97316', '#3b82f6', '#22c55e', '#a855f7',
  '#ef4444', '#eab308', '#ec4899', '#06b6d4',
];

const EMOJIS = ['💪', '📚', '🏃', '🧘', '💧', '🥗', '😴', '✍️', '🎵', '🧹', '🌿', '🎯'];

const todayStr = new Date().toISOString().split('T')[0];

const EditIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const DeleteIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export const HabitPage = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [form, setForm] = useState({ name: '', emoji: '💪', color: '#22c55e', habitType: 'GOOD' });

  const fetchHabits = useCallback(async () => {
    const res = await api.get('/habits').catch(() => null);
    setHabits(res?.data?.data || []);
  }, []);

  const fetchLogs = useCallback(async (y: number, m: number) => {
    const res = await api.get(`/habits/logs?year=${y}&month=${m}`).catch(() => null);
    setLogs(res?.data?.data || []);
  }, []);

  useEffect(() => { fetchHabits(); }, [fetchHabits]);
  useEffect(() => { fetchLogs(year, month); }, [year, month, fetchLogs]);

  const logCountMap = useMemo(() => {
    const map = new Map<string, number>();
    logs.forEach(l => map.set(`${l.habitId}-${l.logDate}`, l.count));
    return map;
  }, [logs]);

  const getCount = (habitId: number, dateStr: string) =>
    logCountMap.get(`${habitId}-${dateStr}`) || 0;

  const hasLog = (habitId: number, dateStr: string) =>
    getCount(habitId, dateStr) > 0;

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const todayDay = now.getFullYear() === year && now.getMonth() + 1 === month ? now.getDate() : null;

  const padDate = (d: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  // 월간 그리드용 토글 (0→1, 1+→0)
  const toggleLog = async (habitId: number, day: number) => {
    const dateStr = padDate(day);
    if (dateStr > todayStr) return;

    const key = `${habitId}-${dateStr}`;
    if (logCountMap.has(key)) {
      setLogs(prev => prev.filter(l => !(l.habitId === habitId && l.logDate === dateStr)));
    } else {
      setLogs(prev => [...prev, { id: Date.now(), habitId, logDate: dateStr, count: 1 }]);
    }
    try {
      await api.post('/habits/logs', { habitId, logDate: dateStr });
    } catch {
      fetchLogs(year, month);
    }
  };

  // 오늘 카운트 +1
  const increment = async (habitId: number) => {
    setLogs(prev => {
      const existing = prev.find(l => l.habitId === habitId && l.logDate === todayStr);
      if (existing) {
        return prev.map(l =>
          l.habitId === habitId && l.logDate === todayStr ? { ...l, count: l.count + 1 } : l
        );
      }
      return [...prev, { id: Date.now(), habitId, logDate: todayStr, count: 1 }];
    });
    try {
      await api.post('/habits/logs/increment', { habitId, logDate: todayStr });
    } catch {
      fetchLogs(year, month);
    }
  };

  // 오늘 카운트 -1
  const decrement = async (habitId: number) => {
    const count = getCount(habitId, todayStr);
    if (count === 0) return;
    setLogs(prev => {
      const existing = prev.find(l => l.habitId === habitId && l.logDate === todayStr);
      if (!existing) return prev;
      if (existing.count <= 1) {
        return prev.filter(l => !(l.habitId === habitId && l.logDate === todayStr));
      }
      return prev.map(l =>
        l.habitId === habitId && l.logDate === todayStr ? { ...l, count: l.count - 1 } : l
      );
    });
    try {
      await api.post('/habits/logs/decrement', { habitId, logDate: todayStr });
    } catch {
      fetchLogs(year, month);
    }
  };

  const getCompletionRate = (habitId: number): number => {
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
    const totalDays = isCurrentMonth ? now.getDate() : daysInMonth;
    const checkedDays = logs.filter(l => l.habitId === habitId).length;
    return totalDays > 0 ? Math.round((checkedDays / totalDays) * 100) : 0;
  };

  const getStreak = (habitId: number): number => {
    let streak = 0;
    const d = new Date();
    const todayDs = d.toISOString().split('T')[0];
    if (!hasLog(habitId, todayDs)) d.setDate(d.getDate() - 1);
    for (let i = 0; i < 366; i++) {
      const ds = d.toISOString().split('T')[0];
      if (hasLog(habitId, ds)) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return streak;
  };

  const openCreateModal = () => {
    setEditingHabit(null);
    setForm({ name: '', emoji: '💪', color: '#22c55e', habitType: 'GOOD' });
    setShowModal(true);
  };

  const openEditModal = (habit: Habit) => {
    setEditingHabit(habit);
    setForm({ name: habit.name, emoji: habit.emoji, color: habit.color, habitType: habit.habitType || 'GOOD' });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingHabit) {
        await api.put(`/habits/${editingHabit.id}`, form);
      } else {
        await api.post('/habits', { ...form, memberId: getStoredMemberId() });
      }
      setShowModal(false);
      fetchHabits();
    } catch {
      alert('저장 실패');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('이 습관을 삭제하시겠습니까? 기록도 모두 삭제됩니다.')) return;
    await api.delete(`/habits/${id}`);
    fetchHabits();
    fetchLogs(year, month);
  };

  const moveMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setYear(y); setMonth(m);
  };

  const goodHabits = habits.filter(h => h.habitType !== 'BAD');
  const badHabits = habits.filter(h => h.habitType === 'BAD');

  const totalRate = habits.length > 0
    ? Math.round(habits.reduce((sum, h) => sum + getCompletionRate(h.id), 0) / habits.length)
    : 0;

  const renderHabitRow = (habit: Habit, idx: number) => {
    const rate = getCompletionRate(habit.id);
    const streak = getStreak(habit.id);
    const isBad = habit.habitType === 'BAD';
    const rowBg = idx % 2 === 0 ? 'bg-white dark:bg-dark-card' : 'bg-slate-50/50 dark:bg-slate-800/20';

    return (
      <tr key={habit.id} className={idx % 2 !== 0 ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''}>
        <td className={`sticky left-0 z-10 ${rowBg} px-4 py-3 border-b border-slate-50 dark:border-dark-border/50`} style={{ minWidth: '160px' }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base leading-none shrink-0">{habit.emoji}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700 dark:text-dark-text truncate">{habit.name}</p>
                {streak >= 2 && (
                  <p className="text-xs font-medium mt-0.5" style={{ color: isBad ? '#f43f5e' : habit.color }}>
                    {isBad ? '⚠️' : '🔥'} {streak}일 연속
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => openEditModal(habit)} className="p-1 text-slate-300 hover:text-primary-500 transition-colors"><EditIcon /></button>
              <button onClick={() => handleDelete(habit.id)} className="p-1 text-slate-300 hover:text-rose-500 transition-colors"><DeleteIcon /></button>
            </div>
          </div>
        </td>
        {days.map(d => {
          const dateStr = padDate(d);
          const count = getCount(habit.id, dateStr);
          const isFuture = dateStr > todayStr;
          const isToday = d === todayDay;

          return (
            <td
              key={d}
              className={`py-3 text-center border-b border-slate-50 dark:border-dark-border/50 ${isToday ? 'bg-primary-50/40 dark:bg-primary-900/10' : ''}`}
              style={{ width: '32px' }}
            >
              <button
                onClick={() => toggleLog(habit.id, d)}
                disabled={isFuture}
                className={`w-6 h-6 rounded-full mx-auto flex items-center justify-center transition-all text-[10px] font-bold ${
                  count > 0
                    ? 'text-white shadow-sm'
                    : isFuture
                    ? 'opacity-20 cursor-default bg-slate-100 dark:bg-slate-800'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                style={count > 0 ? { backgroundColor: isBad ? '#f43f5e' : habit.color } : undefined}
              >
                {count > 0 && (count > 9 ? '9+' : count)}
              </button>
            </td>
          );
        })}
        <td className="px-4 py-3 text-right border-b border-slate-50 dark:border-dark-border/50">
          <span className={`text-sm font-bold tabular-nums ${
            rate >= 80 ? 'text-emerald-500' : rate >= 50 ? 'text-amber-500' : 'text-slate-400'
          }`}>
            {rate}%
          </span>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">{year}년 {month}월</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-dark-text">습관 트래커</h1>
          {habits.length > 0 && (
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              이번 달 평균 달성률{' '}
              <span className={`font-semibold ${totalRate >= 80 ? 'text-emerald-500' : totalRate >= 50 ? 'text-amber-500' : 'text-slate-500'}`}>
                {totalRate}%
              </span>
            </p>
          )}
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primary-600 text-white rounded-full text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          + 습관 추가
        </button>
      </div>

      {/* 오늘의 습관 카운트 패널 */}
      {habits.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 나쁜 습관 */}
          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span className="text-sm font-bold text-rose-500">나쁜 습관</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-400 font-medium">
                {badHabits.length}
              </span>
            </div>
            {badHabits.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">나쁜 습관이 없습니다</p>
            ) : (
              <div className="space-y-2.5">
                {badHabits.map(habit => {
                  const count = getCount(habit.id, todayStr);
                  return (
                    <div
                      key={habit.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-rose-100 dark:border-rose-900/30 bg-rose-50/40 dark:bg-rose-900/10"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl leading-none shrink-0">{habit.emoji}</span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-dark-text truncate">{habit.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <button
                          onClick={() => decrement(habit.id)}
                          disabled={count === 0}
                          className="w-7 h-7 rounded-full bg-white dark:bg-dark-bg border border-slate-200 dark:border-dark-border flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 transition-all font-bold text-lg leading-none"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-lg font-bold tabular-nums text-rose-500">{count}</span>
                        <button
                          onClick={() => increment(habit.id)}
                          className="w-7 h-7 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center text-white font-bold text-lg leading-none transition-all active:scale-95"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 좋은 습관 */}
          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-sm font-bold text-emerald-500">좋은 습관</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-400 font-medium">
                {goodHabits.length}
              </span>
            </div>
            {goodHabits.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">좋은 습관이 없습니다</p>
            ) : (
              <div className="space-y-2.5">
                {goodHabits.map(habit => {
                  const count = getCount(habit.id, todayStr);
                  return (
                    <div
                      key={habit.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/40 dark:bg-emerald-900/10"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl leading-none shrink-0">{habit.emoji}</span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-dark-text truncate">{habit.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <button
                          onClick={() => decrement(habit.id)}
                          disabled={count === 0}
                          className="w-7 h-7 rounded-full bg-white dark:bg-dark-bg border border-slate-200 dark:border-dark-border flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 transition-all font-bold text-lg leading-none"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-lg font-bold tabular-nums text-emerald-500">{count}</span>
                        <button
                          onClick={() => increment(habit.id)}
                          className="w-7 h-7 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white font-bold text-lg leading-none transition-all active:scale-95"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 월 네비게이션 */}
      <div className="flex items-center gap-3">
        <button onClick={() => moveMonth(-1)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-base font-semibold dark:text-dark-text min-w-[100px] text-center">
          {year}년 {month}월
        </span>
        <button onClick={() => moveMonth(1)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 월간 기록 그리드 */}
      {habits.length === 0 ? (
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-14 text-center">
          <p className="text-5xl mb-4">🌱</p>
          <p className="text-slate-600 dark:text-slate-300 font-semibold text-lg">아직 등록된 습관이 없습니다</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">위의 버튼을 눌러 첫 습관을 추가해 보세요</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none overflow-hidden">
          <div className="overflow-x-auto">
            <table className="border-collapse w-full" style={{ minWidth: `${140 + daysInMonth * 32 + 72}px` }}>
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/30">
                  <th
                    className="sticky left-0 z-10 bg-slate-50/80 dark:bg-slate-800/30 px-4 py-3 text-left text-xs font-semibold text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-dark-border"
                    style={{ minWidth: '160px' }}
                  >
                    습관
                  </th>
                  {days.map(d => {
                    const dateStr = padDate(d);
                    const dayOfWeek = new Date(dateStr).getDay();
                    const isToday = d === todayDay;
                    return (
                      <th
                        key={d}
                        className={`py-3 text-center border-b border-slate-100 dark:border-dark-border ${isToday ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                        style={{ width: '32px', minWidth: '32px' }}
                      >
                        <span className={`text-[11px] font-semibold ${
                          isToday ? 'text-primary-500' : dayOfWeek === 0 ? 'text-red-400' : dayOfWeek === 6 ? 'text-blue-400' : 'text-slate-400 dark:text-slate-500'
                        }`}>
                          {d}
                        </span>
                      </th>
                    );
                  })}
                  <th
                    className="px-4 py-3 text-right text-xs font-semibold text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-dark-border"
                    style={{ minWidth: '72px' }}
                  >
                    달성률
                  </th>
                </tr>
              </thead>
              <tbody>
                {badHabits.length > 0 && (
                  <>
                    <tr>
                      <td
                        colSpan={daysInMonth + 2}
                        className="px-4 py-1.5 bg-rose-50/60 dark:bg-rose-900/10 border-y border-rose-100 dark:border-rose-900/20"
                      >
                        <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wide">나쁜 습관</span>
                      </td>
                    </tr>
                    {badHabits.map((habit, idx) => renderHabitRow(habit, idx))}
                  </>
                )}
                {goodHabits.length > 0 && (
                  <>
                    <tr>
                      <td
                        colSpan={daysInMonth + 2}
                        className="px-4 py-1.5 bg-emerald-50/60 dark:bg-emerald-900/10 border-y border-emerald-100 dark:border-emerald-900/20"
                      >
                        <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-wide">좋은 습관</span>
                      </td>
                    </tr>
                    {goodHabits.map((habit, idx) => renderHabitRow(habit, idx + badHabits.length))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 습관 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-card w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold dark:text-dark-text">
                {editingHabit ? '습관 수정' : '습관 추가'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              {/* 습관 유형 */}
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-dark-muted">습관 유형</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, habitType: 'GOOD', color: '#22c55e' }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                      form.habitType === 'GOOD'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                        : 'border-slate-200 dark:border-dark-border text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    좋은 습관
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, habitType: 'BAD', color: '#ef4444' }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                      form.habitType === 'BAD'
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'
                        : 'border-slate-200 dark:border-dark-border text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    나쁜 습관
                  </button>
                </div>
              </div>

              {/* 이모지 선택 */}
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-dark-muted">이모지</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJIS.map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, emoji: e }))}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
                        form.emoji === e
                          ? 'bg-primary-50 dark:bg-primary-900/30 ring-2 ring-primary-500'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* 이름 */}
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-dark-muted">습관 이름</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder={form.habitType === 'BAD' ? '예: 자세교정, 야식' : '예: 스트레칭, 러닝'}
                  required
                />
              </div>

              {/* 색상 선택 */}
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-dark-muted">색상</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, color: c }))}
                      className={`w-8 h-8 rounded-full transition-all ${
                        form.color === c ? 'ring-2 ring-offset-2 ring-slate-500 dark:ring-slate-300 scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 border border-slate-200 dark:border-dark-border rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors dark:text-dark-text"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition-colors"
                >
                  {editingHabit ? '수정하기' : '추가하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};