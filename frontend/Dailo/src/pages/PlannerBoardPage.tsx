import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

interface Big3Item {
  content: string;
  isDone: boolean;
}

interface DayEntry {
  planDate: string;
  hasPlan: boolean;
  big3Total: number;
  big3Done: number;
  brainDumpTotal: number;
  brainDumpDone: number;
  big3Items: Big3Item[];
}

const today = new Date().toISOString().split('T')[0];

export const PlannerBoardPage = () => {
  const navigate = useNavigate();
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const { year, month } = ym;
  const [entries, setEntries] = useState<Record<string, DayEntry>>({});
  const [loading, setLoading] = useState(false);

  // 월간 메모 (localStorage)
  const memoKey = `plannerGoals-${year}-${String(month).padStart(2, '0')}`;
  const [memo, setMemo] = useState('');
  const [memoSaved, setMemoSaved] = useState(false);

  const fetchBoard = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/daily-plans/board?year=${y}&month=${m}`);
      const map: Record<string, DayEntry> = {};
      (res.data.data || []).forEach((e: DayEntry) => { map[e.planDate] = e; });
      setEntries(map);
    } catch {
      setEntries({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBoard(year, month); }, [year, month, fetchBoard]);

  // 월 바뀌면 메모 로드
  useEffect(() => {
    setMemo(localStorage.getItem(memoKey) || '');
    setMemoSaved(false);
  }, [memoKey]);

  // 메모 자동저장
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(memoKey, memo);
      if (memo) setMemoSaved(true);
    }, 600);
    return () => clearTimeout(timer);
  }, [memo, memoKey]);

  const moveMonth = (delta: number) => {
    setYm(prev => {
      let m = prev.month + delta;
      let y = prev.year;
      if (m > 12) { m = 1; y++; }
      if (m < 1)  { m = 12; y--; }
      return { year: y, month: m };
    });
  };

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const dateStr = (day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => moveMonth(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 text-xl"
          >‹</button>
          <h1 className="text-2xl font-bold dark:text-dark-text min-w-[140px] text-center">
            {year}년 {month}월
          </h1>
          <button
            onClick={() => moveMonth(1)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 text-xl"
          >›</button>
        </div>
        <button
          onClick={() => setYm({ year: now.getFullYear(), month: now.getMonth() + 1 })}
          className="text-sm text-slate-400 hover:text-primary-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          이번 달
        </button>
      </div>

      {/* 달력 */}
      <div className="overflow-x-auto">
        <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border overflow-hidden min-w-[560px]">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-dark-border">
            {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
              <div
                key={d}
                className={`py-3 text-center text-xs font-bold ${
                  i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 셀 */}
          {loading ? (
            <div className="py-24 text-center text-slate-300 dark:text-slate-600 text-sm">불러오는 중...</div>
          ) : (
            <div className="grid grid-cols-7">
              {cells.map((day, idx) => {
                if (day === null) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="h-32 border-b border-r border-slate-100 dark:border-dark-border [&:nth-child(7n)]:border-r-0"
                    />
                  );
                }

                const ds = dateStr(day);
                const entry = entries[ds];
                const isToday = ds === today;
                const col = idx % 7;

                let cellBg = '';
                if (entry?.big3Total > 0) {
                  cellBg = entry.big3Done === entry.big3Total
                    ? 'bg-green-50 dark:bg-green-900/10'
                    : 'bg-red-50 dark:bg-red-900/10';
                }

                return (
                  <div
                    key={ds}
                    onClick={() => navigate(`/todo?date=${ds}`)}
                    className={`h-32 border-b border-r border-slate-100 dark:border-dark-border [&:nth-child(7n)]:border-r-0 p-2 cursor-pointer transition-all hover:brightness-95 dark:hover:brightness-110 flex flex-col gap-1 ${cellBg}`}
                  >
                    {/* 날짜 번호 */}
                    <div className="flex items-center justify-between shrink-0">
                      <span className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday
                          ? 'bg-primary-500 text-white'
                          : col === 0
                          ? 'text-red-400'
                          : col === 6
                          ? 'text-blue-400'
                          : 'text-slate-700 dark:text-dark-text'
                      }`}>
                        {day}
                      </span>
                      {entry?.hasPlan && (
                        <span className="text-teal-400 text-[9px]">●</span>
                      )}
                    </div>

                    {/* Big3 내용 */}
                    {entry?.big3Items && entry.big3Items.length > 0 ? (
                      <div className="flex-1 min-h-0 space-y-0.5 overflow-hidden">
                        {entry.big3Items.slice(0, 3).map((item, i) => (
                          <p
                            key={i}
                            className={`leading-tight truncate ${
                              item.isDone
                                ? 'line-through text-slate-300 dark:text-slate-600'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                            style={{ fontSize: '10px' }}
                          >
                            {item.content}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <div className="flex-1" />
                    )}

                    {/* 하단: 완료율 바 */}
                    {entry?.big3Total > 0 && (
                      <div className="shrink-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-slate-400 dark:text-slate-500" style={{ fontSize: '9px' }}>
                            {entry.big3Done}/{entry.big3Total}
                          </span>
                          {entry.brainDumpTotal > 0 && (
                            <span className="text-slate-300 dark:text-slate-600" style={{ fontSize: '9px' }}>
                              📋{entry.brainDumpDone}/{entry.brainDumpTotal}
                            </span>
                          )}
                        </div>
                        <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-1 rounded-full transition-all ${
                              entry.big3Done === entry.big3Total ? 'bg-green-500' : 'bg-red-400'
                            }`}
                            style={{ width: `${(entry.big3Done / entry.big3Total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-6 text-xs text-slate-400 dark:text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
          Big3 완료
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" />
          Big3 미완료
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-teal-400">●</span>
          플랜 작성
        </div>
      </div>

      {/* 이달의 목표 메모 */}
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-6">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="text-base font-semibold dark:text-dark-text">{year}년 {month}월 목표 & 할 일</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">이달에 꼭 해야 할 일, 목표, 메모를 자유롭게 작성하세요</p>
          </div>
          {memoSaved && (
            <span className="text-xs text-emerald-500 font-medium shrink-0 ml-4">저장됨</span>
          )}
        </div>
        <textarea
          value={memo}
          onChange={e => { setMemo(e.target.value); setMemoSaved(false); }}
          rows={7}
          placeholder={`예시:\n• 운동 주 3회 이상\n• 책 1권 완독\n• 사이드 프로젝트 MVP 완성\n• 저축 목표 달성`}
          className="w-full p-3 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-bg text-sm text-slate-800 dark:text-dark-text placeholder-slate-300 dark:placeholder-slate-600 resize-none outline-none focus:ring-2 focus:ring-primary-500 transition-all leading-relaxed"
        />
      </div>
    </div>
  );
};