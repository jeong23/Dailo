import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import { useEscapeKey } from '../hooks/useEscapeKey';

// ── 타입 ──────────────────────────────────────────────
interface WorkoutSet {
  id?: number;
  exerciseName: string;
  exerciseSortOrder: number;
  setNumber: number;
  weightKg?: number;
  reps?: number;
  isDone: boolean;
}

interface WorkoutLog {
  id?: number;
  routineId?: number | null;
  workoutDate: string;
  memo?: string;
  sets: WorkoutSet[];
}

interface RoutineExercise {
  id?: number;
  exerciseName: string;
  targetSets?: number;
  sortOrder: number;
}

interface WorkoutRoutine {
  id?: number;
  name: string;
  sortOrder: number;
  exercises: RoutineExercise[];
}

// 편집용 — 세션 내 종목 블록 (여러 세트를 하나로 묶어서 표시)
interface ExerciseBlock {
  exerciseName: string;
  sortOrder: number;
  sets: WorkoutSet[];
}

const todayStr = () => new Date().toISOString().split('T')[0];

const inputCls = 'w-full p-1.5 rounded-lg border text-sm dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500';

// ── 종목명 자동완성 입력 ──────────────────────────────
const ExerciseAutocomplete: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = (q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const res = await api.get(`/workouts/exercise-names?query=${encodeURIComponent(q)}`).catch(() => null);
      setSuggestions(res?.data?.data || []);
    }, 200);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapRef} className="relative flex-1 min-w-0">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); fetchSuggestions(e.target.value); setOpen(true); }}
        onFocus={() => { fetchSuggestions(value); setOpen(true); }}
        placeholder={placeholder || '종목명 (예: 벤치프레스)'}
        className={inputCls}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => { onChange(s); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-dark-text truncate"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const groupSetsToBlocks = (sets: WorkoutSet[]): ExerciseBlock[] => {
  const map = new Map<number, ExerciseBlock>();
  sets.forEach(s => {
    if (!map.has(s.exerciseSortOrder)) {
      map.set(s.exerciseSortOrder, { exerciseName: s.exerciseName, sortOrder: s.exerciseSortOrder, sets: [] });
    }
    map.get(s.exerciseSortOrder)!.sets.push(s);
  });
  return Array.from(map.values()).sort((a, b) => a.sortOrder - b.sortOrder);
};

export const WeightTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [selectedRoutineId, setSelectedRoutineId] = useState<number | null>(null);
  const [blocks, setBlocks] = useState<ExerciseBlock[]>([]);
  const [logMemo, setLogMemo] = useState('');

  const [editingRoutine, setEditingRoutine] = useState<WorkoutRoutine | null>(null);
  useEscapeKey(editingRoutine !== null, () => setEditingRoutine(null));

  const fetchAll = useCallback(async () => {
    const now = new Date(selectedDate);
    const [routinesRes, logsRes] = await Promise.allSettled([
      api.get('/workouts/routines'),
      api.get(`/workouts/logs?year=${now.getFullYear()}&month=${now.getMonth() + 1}`),
    ]);
    if (routinesRes.status === 'fulfilled') setRoutines(routinesRes.value.data.data || []);
    if (logsRes.status === 'fulfilled') setLogs(logsRes.value.data.data || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate.slice(0, 7)]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const log = logs.find(l => l.workoutDate === selectedDate);
    if (log) {
      setBlocks(groupSetsToBlocks(log.sets));
      setLogMemo(log.memo || '');
      setSelectedRoutineId(log.routineId ?? null);
    } else {
      setBlocks([]);
      setLogMemo('');
      setSelectedRoutineId(null);
    }
  }, [selectedDate, logs]);

  // ── 오늘의 기록 편집 ──────────────────────────────
  const addExerciseBlock = () => {
    setBlocks(prev => [...prev, {
      exerciseName: '', sortOrder: prev.length,
      sets: [{ exerciseName: '', exerciseSortOrder: prev.length, setNumber: 1, isDone: false }],
    }]);
  };

  const removeExerciseBlock = (bi: number) => {
    setBlocks(prev => prev.filter((_, i) => i !== bi)
      .map((b, i) => ({ ...b, sortOrder: i, sets: b.sets.map(s => ({ ...s, exerciseSortOrder: i })) })));
  };

  const updateBlockName = (bi: number, name: string) => {
    setBlocks(prev => prev.map((b, i) => i !== bi ? b : { ...b, exerciseName: name, sets: b.sets.map(s => ({ ...s, exerciseName: name })) }));
  };

  const addSet = (bi: number) => {
    setBlocks(prev => prev.map((b, i) => {
      if (i !== bi) return b;
      const last = b.sets[b.sets.length - 1];
      return {
        ...b,
        sets: [...b.sets, {
          exerciseName: b.exerciseName, exerciseSortOrder: b.sortOrder,
          setNumber: b.sets.length + 1, weightKg: last?.weightKg, reps: last?.reps, isDone: false,
        }],
      };
    }));
  };

  const removeSet = (bi: number, si: number) => {
    setBlocks(prev => prev.map((b, i) => i !== bi ? b
      : { ...b, sets: b.sets.filter((_, idx) => idx !== si).map((s, idx) => ({ ...s, setNumber: idx + 1 })) }));
  };

  const updateSet = (bi: number, si: number, key: 'weightKg' | 'reps' | 'isDone', value: number | boolean | undefined) => {
    setBlocks(prev => prev.map((b, i) => i !== bi ? b
      : { ...b, sets: b.sets.map((s, idx) => idx !== si ? s : { ...s, [key]: value }) }));
  };

  const startFromRoutine = (routine: WorkoutRoutine) => {
    const newBlocks: ExerciseBlock[] = routine.exercises.map((ex, i) => ({
      exerciseName: ex.exerciseName,
      sortOrder: i,
      sets: Array.from({ length: ex.targetSets || 1 }, (_, si) => ({
        exerciseName: ex.exerciseName, exerciseSortOrder: i, setNumber: si + 1, isDone: false,
      })),
    }));
    setBlocks(newBlocks);
    setSelectedRoutineId(routine.id ?? null);
  };

  const totalVolume = blocks.reduce((sum, b) =>
    sum + b.sets.reduce((s, set) => s + (set.weightKg || 0) * (set.reps || 0), 0), 0);

  const saveLog = async () => {
    const sets = blocks
      .filter(b => b.exerciseName.trim())
      .flatMap(b => b.sets.map((s, idx) => ({
        id: s.id, exerciseName: b.exerciseName, exerciseSortOrder: b.sortOrder,
        setNumber: idx + 1, weightKg: s.weightKg, reps: s.reps, isDone: s.isDone,
      })));
    await api.post('/workouts/logs', {
      routineId: selectedRoutineId, workoutDate: selectedDate, memo: logMemo, sets,
    });
    fetchAll();
  };

  const deleteCurrentLog = async () => {
    const log = logs.find(l => l.workoutDate === selectedDate);
    if (!log?.id) return;
    await api.delete(`/workouts/logs/${log.id}`);
    fetchAll();
  };

  // ── 루틴 관리 ─────────────────────────────────────
  const openNewRoutine = () => setEditingRoutine({ name: '', sortOrder: routines.length, exercises: [] });
  const openEditRoutine = (r: WorkoutRoutine) => setEditingRoutine({ ...r, exercises: r.exercises.map(e => ({ ...e })) });

  const updateRoutineExercise = (i: number, key: 'exerciseName' | 'targetSets', value: string | number) => {
    setEditingRoutine(prev => prev ? { ...prev, exercises: prev.exercises.map((e, idx) => idx !== i ? e : { ...e, [key]: value }) } : prev);
  };
  const addRoutineExercise = () => {
    setEditingRoutine(prev => prev ? { ...prev, exercises: [...prev.exercises, { exerciseName: '', targetSets: 3, sortOrder: prev.exercises.length }] } : prev);
  };
  const removeRoutineExercise = (i: number) => {
    setEditingRoutine(prev => prev ? { ...prev, exercises: prev.exercises.filter((_, idx) => idx !== i) } : prev);
  };

  const buildRoutinesPayload = (updated: WorkoutRoutine) => {
    const others = routines.filter(r => r.id !== updated.id);
    return [...others, updated].map((r, i) => ({
      id: r.id, name: r.name, sortOrder: i,
      exercises: r.exercises.map((e, ei) => ({ id: e.id, exerciseName: e.exerciseName, targetSets: e.targetSets, sortOrder: ei })),
    }));
  };

  const saveRoutine = async () => {
    if (!editingRoutine || !editingRoutine.name.trim()) return;
    await api.post('/workouts/routines', buildRoutinesPayload(editingRoutine));
    setEditingRoutine(null);
    fetchAll();
  };

  const deleteRoutine = async (r: WorkoutRoutine) => {
    const remaining = routines.filter(x => x.id !== r.id).map((ro, i) => ({
      id: ro.id, name: ro.name, sortOrder: i,
      exercises: ro.exercises.map((e, ei) => ({ id: e.id, exerciseName: e.exerciseName, targetSets: e.targetSets, sortOrder: ei })),
    }));
    await api.post('/workouts/routines', remaining);
    fetchAll();
  };

  // ── 최근 기록 ─────────────────────────────────────
  const recentLogs = [...logs]
    .filter(l => l.sets.length > 0)
    .sort((a, b) => b.workoutDate.localeCompare(a.workoutDate));

  if (loading) return <div className="p-6 text-center text-slate-400 text-sm">불러오는 중...</div>;

  return (
    <div className="flex flex-col gap-4 p-4">

      {/* ── 루틴 관리 ── */}
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold dark:text-dark-text">내 루틴</h2>
          <button
            onClick={openNewRoutine}
            className="px-3 py-2 min-h-[44px] bg-orange-500 text-white rounded-full text-xs font-semibold hover:bg-orange-600 transition-colors"
          >
            + 루틴 추가
          </button>
        </div>
        {routines.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">루틴을 추가해보세요</p>
        ) : (
          <div className="flex flex-col gap-2">
            {routines.map(r => (
              <div key={r.id} className="flex items-center gap-2 border border-slate-100 dark:border-dark-border/50 rounded-xl p-3">
                <button
                  onClick={() => startFromRoutine(r)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm font-semibold dark:text-dark-text truncate">{r.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{r.exercises.length}개 종목 · 오늘 기록에 적용</p>
                </button>
                <button onClick={() => openEditRoutine(r)} className="text-xs text-primary-500 hover:text-primary-600 font-medium px-2 py-2 min-h-[44px]">편집</button>
                <button onClick={() => deleteRoutine(r)} className="text-slate-300 hover:text-rose-500 text-lg px-2 py-2 min-h-[44px]">×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 오늘의 기록 ── */}
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="p-2 rounded-lg border text-sm dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
          />
          {selectedDate !== todayStr() && (
            <button onClick={() => setSelectedDate(todayStr())} className="text-xs text-primary-500 font-medium">오늘로</button>
          )}
        </div>

        {routines.length > 0 && blocks.length === 0 && (
          <div className="flex gap-2 flex-wrap mb-3">
            {routines.map(r => (
              <button
                key={r.id}
                onClick={() => startFromRoutine(r)}
                className="px-3 py-2 min-h-[44px] rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-orange-100 dark:hover:bg-orange-900/20 transition-colors"
              >
                🏋️ {r.name}에서 시작
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {blocks.map((block, bi) => (
            <div key={bi} className="border border-slate-100 dark:border-dark-border/50 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <ExerciseAutocomplete value={block.exerciseName} onChange={v => updateBlockName(bi, v)} />
                <button onClick={() => removeExerciseBlock(bi)} className="text-slate-300 hover:text-rose-500 text-lg px-2 py-2 min-h-[44px]">×</button>
              </div>

              <div className="flex flex-col gap-1.5">
                {block.sets.map((set, si) => (
                  <div key={si} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-10 flex-shrink-0">{si + 1}세트</span>
                    <input
                      type="number" step="0.5" value={set.weightKg ?? ''}
                      onChange={e => updateSet(bi, si, 'weightKg', e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="kg" className={`${inputCls} w-20`}
                    />
                    <span className="text-xs text-slate-400">kg ×</span>
                    <input
                      type="number" value={set.reps ?? ''}
                      onChange={e => updateSet(bi, si, 'reps', e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="회" className={`${inputCls} w-16`}
                    />
                    <span className="text-xs text-slate-400">회</span>
                    <button
                      onClick={() => updateSet(bi, si, 'isDone', !set.isDone)}
                      className={`ml-auto w-11 h-11 flex items-center justify-center rounded-lg text-sm font-bold transition-colors ${
                        set.isDone ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      ✓
                    </button>
                    <button onClick={() => removeSet(bi, si)} className="text-slate-300 hover:text-rose-500 text-base px-2 py-2 min-h-[44px]">×</button>
                  </div>
                ))}
                <button onClick={() => addSet(bi)} className="text-xs text-primary-500 hover:text-primary-600 font-medium self-start py-2 min-h-[44px]">+ 세트 추가</button>
              </div>
            </div>
          ))}

          <button
            onClick={addExerciseBlock}
            className="w-full py-3 min-h-[44px] border border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-sm text-slate-400 hover:text-orange-500 hover:border-orange-400 transition-colors"
          >
            + 종목 추가
          </button>
        </div>

        {blocks.length > 0 && (
          <>
            <div className="mt-3">
              <textarea
                value={logMemo} onChange={e => setLogMemo(e.target.value)}
                placeholder="오늘 컨디션, 메모..." rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={saveLog}
                className="flex-1 py-3 min-h-[44px] bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors"
              >
                저장 {totalVolume > 0 && `(총 ${Math.round(totalVolume).toLocaleString()}kg)`}
              </button>
              {logs.some(l => l.workoutDate === selectedDate) && (
                <button
                  onClick={deleteCurrentLog}
                  className="px-4 py-3 min-h-[44px] rounded-xl text-sm font-medium text-rose-500 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors"
                >
                  삭제
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── 최근 기록 ── */}
      {recentLogs.length > 0 && (
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-4">
          <p className="text-sm font-semibold dark:text-dark-text mb-3">최근 운동 기록</p>
          <div className="flex flex-col divide-y divide-slate-50 dark:divide-dark-border/50">
            {recentLogs.map(log => {
              const exerciseCount = new Set(log.sets.map(s => s.exerciseSortOrder)).size;
              const volume = log.sets.reduce((s, set) => s + (set.weightKg || 0) * (set.reps || 0), 0);
              return (
                <button
                  key={log.id}
                  onClick={() => setSelectedDate(log.workoutDate)}
                  className="flex items-center gap-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors -mx-4 px-4 min-h-[44px]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold dark:text-dark-text truncate">{log.workoutDate}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{exerciseCount}개 종목 · 총 {Math.round(volume).toLocaleString()}kg</p>
                  </div>
                  <span className="text-slate-300 dark:text-slate-600">›</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 루틴 편집 모달 ── */}
      {editingRoutine && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-card w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold dark:text-dark-text">{editingRoutine.id ? '루틴 편집' : '새 루틴'}</h2>
              <button onClick={() => setEditingRoutine(null)} className="text-slate-400 hover:text-slate-600 text-xl w-11 h-11 flex items-center justify-center">✕</button>
            </div>

            <div className="flex flex-col gap-4">
              <input
                type="text" value={editingRoutine.name}
                onChange={e => setEditingRoutine(prev => prev ? { ...prev, name: e.target.value } : prev)}
                placeholder="루틴 이름 (예: 가슴/삼두 day)"
                className={`${inputCls} text-base font-semibold`}
              />

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-400">종목</p>
                  <button onClick={addRoutineExercise} className="text-xs text-primary-500 hover:text-primary-600 font-medium py-2 min-h-[44px]">+ 종목 추가</button>
                </div>
                {editingRoutine.exercises.map((ex, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <ExerciseAutocomplete value={ex.exerciseName} onChange={v => updateRoutineExercise(i, 'exerciseName', v)} />
                    <input
                      type="number" value={ex.targetSets ?? ''}
                      onChange={e => updateRoutineExercise(i, 'targetSets', e.target.value ? parseInt(e.target.value) : 0)}
                      placeholder="세트" className={`${inputCls} w-16 text-center`}
                    />
                    <span className="text-xs text-slate-400 whitespace-nowrap">세트</span>
                    <button onClick={() => removeRoutineExercise(i)} className="text-slate-300 hover:text-rose-500 text-lg px-2 py-2 min-h-[44px]">×</button>
                  </div>
                ))}
                {editingRoutine.exercises.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-3">종목을 추가하세요</p>
                )}
              </div>

              <button
                onClick={saveRoutine}
                disabled={!editingRoutine.name.trim()}
                className="w-full py-3 min-h-[44px] bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
