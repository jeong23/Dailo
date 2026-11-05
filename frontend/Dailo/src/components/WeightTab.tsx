import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../api/axios';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { Toast, useToast } from './Toast';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { BODY_PARTS, BODY_PART_COLOR, EXERCISE_LIBRARY, BodyPart, getBodyPart, estimate1RM } from '../utils/bodyPart';
import { getExerciseInfo, exerciseImages, ART_CREDIT, PHOTO_CREDIT } from '../utils/exerciseInfo';

// ── 타입 ──────────────────────────────────────────────
type SetType = 'NORMAL' | 'WARMUP' | 'DROP' | 'FAILURE';

interface WorkoutSet {
  id?: number;
  exerciseName: string;
  exerciseSortOrder: number;
  setNumber: number;
  weightKg?: number;
  reps?: number;
  isDone: boolean;
  setType?: SetType;
}

// 번핏식 세트 종류 — 웜업은 볼륨·1RM 집계에서 제외
const SET_TYPES: { value: SetType; label: string; short: string; cls: string }[] = [
  { value: 'NORMAL', label: '일반 세트', short: '', cls: 'text-slate-500' },
  { value: 'WARMUP', label: '웜업', short: 'W', cls: 'text-amber-500' },
  { value: 'DROP', label: '드롭 세트', short: 'D', cls: 'text-violet-500' },
  { value: 'FAILURE', label: '실패 지점까지', short: 'F', cls: 'text-rose-500' },
];
const isWorking = (s: WorkoutSet) => s.setType !== 'WARMUP';

interface SetConfig { sets: number; weightKg?: number; reps?: number; }
const SET_PRESETS: { label: string; sets: number; reps: number }[] = [
  { label: '5×5', sets: 5, reps: 5 }, { label: '3×8', sets: 3, reps: 8 }, { label: '3×10', sets: 3, reps: 10 },
  { label: '4×12', sets: 4, reps: 12 }, { label: '3×15', sets: 3, reps: 15 },
];

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

// toISOString()은 UTC라 KST 오전 9시 전엔 어제가 됨 → 로컬 기준으로 조립
const toYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayStr = () => toYmd(new Date());
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const REST_OPTIONS = [60, 90, 120, 180];
const CARD = 'bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none';
const inputCls = 'w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-dark-bg text-sm dark:text-dark-text outline-none focus:ring-2 focus:ring-orange-400';
const cellInput = 'w-full h-10 rounded-lg bg-slate-50 dark:bg-dark-bg text-center text-sm font-semibold tabular-nums dark:text-dark-text outline-none focus:ring-2 focus:ring-orange-400 placeholder:text-slate-300 dark:placeholder:text-slate-600 placeholder:font-normal';

const fmtKg = (n: number) => `${Math.round(n).toLocaleString()}kg`;
const fmtW = (w?: number) => (w == null ? '' : Number.isInteger(w) ? String(w) : w.toFixed(1));
const dateLabel = (ymd: string) => {
  const d = new Date(`${ymd}T00:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
};
const volumeOf = (sets: WorkoutSet[]) => sets.filter(isWorking).reduce((s, set) => s + (set.weightKg || 0) * (set.reps || 0), 0);

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

// 저장 여부 비교용 — id는 빼고 내용만
const snapshotOf = (blocks: ExerciseBlock[], memo: string) => JSON.stringify({
  memo: memo || '',
  b: blocks.filter(b => b.exerciseName.trim()).map(b => [b.exerciseName, b.sets.map(s => [s.weightKg ?? null, s.reps ?? null, !!s.isDone, s.setType || 'NORMAL'])]),
});

// ── 숫자 셀 입력 — "62." 처럼 입력 중인 문자열을 유지해야 소수 입력 가능 ──
const NumCell: React.FC<{
  value?: number;
  decimal?: boolean;
  placeholder?: string;
  className?: string;
  onChange: (v: number | undefined) => void;
}> = ({ value, decimal, placeholder, className, onChange }) => {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    const parsed = text === '' ? undefined : parseFloat(text);
    if (parsed !== value) setText(value == null ? '' : String(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input type="text" inputMode={decimal ? 'decimal' : 'numeric'} placeholder={placeholder} value={text}
      onChange={e => {
        const raw = decimal ? e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1') : e.target.value.replace(/[^0-9]/g, '');
        setText(raw);
        const n = raw === '' || raw === '.' ? undefined : parseFloat(raw);
        onChange(n);
      }}
      className={className} />
  );
};

const ART_BLEND = 'mix-blend-multiply dark:invert dark:mix-blend-screen';

// ── 종목 썸네일 — 사진 없는 종목(직접 추가)·로드 실패 시 부위 색 이니셜 ──
const ExerciseThumb: React.FC<{ name: string; size?: string }> = ({ name, size = 'w-11 h-11' }) => {
  const info = getExerciseInfo(name);
  const [failed, setFailed] = useState(false);
  const part = getBodyPart(name);
  if (!info || failed) {
    return (
      <span className={`${size} rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0`} style={{ background: BODY_PART_COLOR[part] }}>
        {part.slice(0, 1)}
      </span>
    );
  }
  const { kind, frames } = exerciseImages(info);
  // 라인 드로잉 SVG는 흰 배경 + 검은 선 → 라이트는 multiply로 흰 배경 제거,
  // 다크는 invert(검은 배경 + 흰 선) 후 screen으로 검은 배경 제거 — isolate 필수(블렌드 범위를 타일 안으로 한정)
  // 타일 배경은 반드시 불투명색 — 반투명이면 투명한 만큼 SVG의 검은 배경이 비쳐 어두운 사각형이 생김
  return kind === 'art' ? (
    <span className={`${size} isolate rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 overflow-hidden`}>
      <img src={frames[1]} alt="" loading="lazy" onError={() => setFailed(true)}
        className={`w-full h-full object-contain p-1 ${ART_BLEND}`} />
    </span>
  ) : (
    <img src={frames[1]} alt="" loading="lazy" onError={() => setFailed(true)}
      className={`${size} rounded-xl object-cover bg-slate-100 dark:bg-slate-800 shrink-0`} />
  );
};

// ── 동작 애니메이션 — 시작/수축 자세 2장을 크로스페이드(+살짝 스케일)로 번갈아 재생, 탭하면 일시정지 ──
const ExerciseMotion: React.FC<{ name: string }> = ({ name }) => {
  const info = getExerciseInfo(name);
  const [frame, setFrame] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [paused, setPaused] = useState(() => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (!info || paused) return;
    const id = setInterval(() => setFrame(f => 1 - f), 1200);
    return () => clearInterval(id);
  }, [info, paused]);

  const part = getBodyPart(name);
  if (!info || failed) {
    return (
      <div className="aspect-[4/3] w-full rounded-2xl flex flex-col items-center justify-center gap-2 text-white" style={{ background: `linear-gradient(135deg, ${BODY_PART_COLOR[part]}, ${BODY_PART_COLOR[part]}99)` }}>
        <span className="text-5xl">🏋️</span>
        <span className="text-sm font-semibold opacity-90">{part} 운동</span>
      </div>
    );
  }
  const { kind, frames } = exerciseImages(info);
  const isArt = kind === 'art';
  return (
    <figure>
      <button type="button" onClick={() => setPaused(p => !p)} aria-label={paused ? '동작 재생' : '동작 일시정지'}
        className={`relative isolate block aspect-[4/3] w-full rounded-2xl overflow-hidden ${
          !loaded ? 'bg-slate-100 dark:bg-slate-800 animate-pulse'
            : isArt ? 'bg-gradient-to-b from-slate-50 to-orange-50/60 dark:from-slate-800 dark:to-slate-900' : 'bg-white'
        }`}>
        {frames.map((src, i) => (
          <img key={src} src={src} alt={i === 0 ? `${name} 시작 자세` : `${name} 수축 자세`} onError={() => setFailed(true)}
            onLoad={() => i === 0 && setLoaded(true)}
            className={`absolute inset-0 w-full h-full object-contain transition-all duration-700 ease-in-out ${isArt ? `p-6 ${ART_BLEND}` : ''}`}
            style={{ opacity: loaded && frame === i ? 1 : 0, transform: `scale(${frame === i ? 1 : 0.97})` }} />
        ))}
        <span className="absolute bottom-2.5 left-3 flex gap-1">
          {[0, 1].map(i => <span key={i} className={`h-1.5 rounded-full transition-all duration-500 ${frame === i ? 'w-5 bg-orange-500' : 'w-1.5 bg-slate-300 dark:bg-slate-600'}`} />)}
        </span>
        <span className="absolute bottom-2 right-3 text-[11px] font-medium text-slate-400">
          {frame === 0 ? '시작 자세' : '수축'}{paused && ' · 일시정지'}
        </span>
      </button>
      <figcaption className="text-[10px] text-slate-400 mt-1.5 text-right">{isArt ? ART_CREDIT : PHOTO_CREDIT}</figcaption>
    </figure>
  );
};

// ── −/+ 스테퍼 (가운데는 직접 입력 가능) ─────────────────
const Stepper: React.FC<{ label: string; unit: string; value?: number; step: number; min?: number; decimal?: boolean; onChange: (v: number | undefined) => void }> =
  ({ label, unit, value, step, min = 0, decimal, onChange }) => {
    const [bump, setBump] = useState(0);
    const change = (d: number) => {
      const next = Math.max(min, Math.round(((value ?? 0) + d) * 10) / 10);
      onChange(next);
      setBump(b => b + 1);
    };
    return (
      <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-2.5 min-w-0">
        <p className="text-xs text-slate-400 text-center">{label}</p>
        <div key={bump} className="flex items-baseline justify-center gap-0.5 animate-pop">
          <NumCell value={value} decimal={decimal} placeholder="0" onChange={onChange}
            className="w-full min-w-0 h-10 bg-transparent text-center text-2xl font-bold tabular-nums text-slate-900 dark:text-dark-text outline-none focus:ring-2 focus:ring-orange-400 rounded-lg" />
        </div>
        <p className="text-[11px] text-slate-400 text-center -mt-0.5 mb-2">{unit}</p>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => change(-step)} aria-label={`${label} 줄이기`}
            className="h-11 rounded-xl bg-white dark:bg-slate-700 text-xl text-slate-500 dark:text-slate-200 shadow-sm active:scale-95 transition-transform">−</button>
          <button type="button" onClick={() => change(step)} aria-label={`${label} 늘리기`}
            className="h-11 rounded-xl bg-white dark:bg-slate-700 text-xl text-slate-500 dark:text-slate-200 shadow-sm active:scale-95 transition-transform">+</button>
        </div>
      </div>
    );
  };

// ── 종목 상세 시트: 동작 애니메이션 + 근육·자세 포인트 + 내 기록 + 세트 설정 ──
const ExerciseDetail: React.FC<{
  name: string;
  mode: 'add' | 'edit';
  initial: SetConfig;
  sessions: { date: string; sets: WorkoutSet[] }[]; // 오래된 순
  bookmarked: boolean;
  onToggleBookmark: () => void;
  onConfirm: (cfg: SetConfig) => void;
  onClose: () => void;
}> = ({ name, mode, initial, sessions, bookmarked, onToggleBookmark, onConfirm, onClose }) => {
  const [cfg, setCfg] = useState<SetConfig>(initial);
  useEscapeKey(true, onClose);
  const info = getExerciseInfo(name);
  const part = getBodyPart(name);

  const points = sessions.map(s => {
    const working = s.sets.filter(isWorking);
    return {
      label: `${Number(s.date.slice(5, 7))}/${Number(s.date.slice(8))}`,
      e1rm: Math.round(Math.max(0, ...working.map(x => estimate1RM(x.weightKg, x.reps)))),
      top: working.reduce<WorkoutSet | null>((best, x) => (!best || (x.weightKg || 0) > (best.weightKg || 0) ? x : best), null),
    };
  }).filter(p => p.e1rm > 0);
  const best = points.reduce((m, p) => Math.max(m, p.e1rm), 0);
  const last = points[points.length - 1];
  const delay = (i: number) => ({ animationDelay: `${80 + i * 60}ms` });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-dark-card w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] flex flex-col animate-sheet-up pb-[env(safe-area-inset-bottom)] sm:pb-0" onClick={e => e.stopPropagation()}>
        <div className="sm:hidden flex justify-center pt-2"><span className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" /></div>
        <div className="overflow-y-auto px-5 pt-3 pb-4 space-y-5 themed-scrollbar">
          <div className="flex items-start justify-between gap-3 animate-rise-in" style={delay(0)}>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full text-white" style={{ background: BODY_PART_COLOR[part] }}>{part}</span>
                {info && <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">{info.equipment}</span>}
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-dark-text break-words">{name}</h3>
            </div>
            <div className="flex items-center -mr-2 shrink-0">
              <StarButton on={bookmarked} name={name} onToggle={onToggleBookmark} />
              <button onClick={onClose} aria-label="닫기" className="w-11 h-11 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xl">×</button>
            </div>
          </div>

          <div className="animate-rise-in" style={delay(1)}><ExerciseMotion name={name} /></div>

          {info && (
            <div className="space-y-3 animate-rise-in" style={delay(2)}>
              <div className="flex flex-wrap gap-1.5">
                {info.primary.map(mu => <span key={mu} className="text-xs font-semibold px-3 py-1 rounded-full bg-orange-500 text-white">{mu}</span>)}
                {info.secondary.map(mu => <span key={mu} className="text-xs font-medium px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400">{mu}</span>)}
              </div>
              <ol className="space-y-1.5">
                {info.tips.map((t, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                    <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-500 flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <span className="min-w-0">{t}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {points.length > 0 && (
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 p-4 animate-rise-in" style={delay(3)}>
              <div className="flex items-baseline justify-between mb-1">
                <p className="text-sm font-semibold text-slate-700 dark:text-dark-text">내 기록 <span className="text-xs font-normal text-slate-400">최근 2개월 · 추정 1RM</span></p>
                <p className="text-sm font-bold tabular-nums text-orange-500">최고 {best}kg</p>
              </div>
              {last?.top && <p className="text-xs text-slate-400 tabular-nums">지난번 {last.label} · 최고 {fmtW(last.top.weightKg)}kg × {last.top.reps}회</p>}
              {points.length > 1 && (
                <div className="h-28 mt-2 -ml-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis width={32} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={['dataMin - 5', 'dataMax + 5']} />
                      <Tooltip formatter={(v: number) => [`${v}kg`, '1RM']} contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }} />
                      <Line type="monotone" dataKey="e1rm" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3, fill: '#f97316' }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* 세트 설정 */}
          <div className="space-y-3 animate-rise-in" style={delay(4)}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700 dark:text-dark-text">{mode === 'add' ? '세트 설정' : '남은 세트 일괄 변경'}</p>
              {last?.top && (
                <button type="button" onClick={() => setCfg(c => ({ ...c, weightKg: last.top!.weightKg, reps: last.top!.reps }))}
                  className="h-8 px-3 rounded-full text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20">지난번처럼</button>
              )}
            </div>
            <div className="flex gap-1.5 overflow-x-auto -mx-5 px-5 no-scrollbar">
              {SET_PRESETS.map(p => {
                const on = cfg.sets === p.sets && cfg.reps === p.reps;
                return (
                  <button key={p.label} type="button" onClick={() => setCfg(c => ({ ...c, sets: p.sets, reps: p.reps }))}
                    className={`shrink-0 h-9 px-4 rounded-full text-sm font-semibold tabular-nums transition-colors ${on ? 'bg-orange-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200'}`}>
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stepper label="세트" unit="세트" value={cfg.sets} step={1} min={1} onChange={v => setCfg(c => ({ ...c, sets: Math.max(1, Math.min(20, Math.round(v || 1))) }))} />
              <Stepper label="무게" unit="kg" value={cfg.weightKg} step={2.5} decimal onChange={v => setCfg(c => ({ ...c, weightKg: v }))} />
              <Stepper label="횟수" unit={name.includes('플랭크') ? '초' : '회'} value={cfg.reps} step={1} onChange={v => setCfg(c => ({ ...c, reps: v }))} />
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 dark:border-dark-border/60">
          <button onClick={() => onConfirm(cfg)}
            className="w-full h-12 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 active:scale-[0.99] transition-all tabular-nums">
            {mode === 'add' ? `운동에 추가 · ${cfg.sets}세트` : '적용하기'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── 종목명 자동완성 입력 (루틴 편집용) ──────────────────
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
        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-dark-card rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map(s => (
            <button key={s} type="button" onClick={() => { onChange(s); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-dark-text truncate">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── 즐겨찾기 별 버튼 — 누를 때 pop 애니메이션 ──
const StarButton: React.FC<{ on: boolean; name: string; onToggle: () => void; className?: string }> = ({ on, name, onToggle, className = '' }) => {
  const [bump, setBump] = useState(0);
  return (
    <button type="button" aria-pressed={on} aria-label={on ? `${name} 즐겨찾기 해제` : `${name} 즐겨찾기`}
      onClick={e => { e.stopPropagation(); setBump(b => b + 1); onToggle(); }}
      className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors hover:bg-amber-50 dark:hover:bg-amber-900/20 ${className}`}>
      <svg key={bump} viewBox="0 0 24 24" className={`w-5 h-5 ${bump ? 'animate-pop' : ''} ${on ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
        fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
        <path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.7l5.9-.9L12 3.5z" />
      </svg>
    </button>
  );
};

// ── 종목 선택 시트 (즐겨찾기 + 최근 + 부위 필터 + 기본 종목) ────
type PickerTab = BodyPart | '즐겨찾기' | '최근' | '전체';
const ExercisePicker: React.FC<{
  recent: string[];
  bookmarks: string[];
  exclude: string[];
  onPick: (name: string) => void;
  onToggleBookmark: (name: string) => void;
  onClose: () => void;
}> = ({ recent, bookmarks, exclude, onPick, onToggleBookmark, onClose }) => {
  const [query, setQuery] = useState('');
  const [part, setPart] = useState<PickerTab>(bookmarks.length > 0 ? '즐겨찾기' : recent.length > 0 ? '최근' : '전체');
  useEscapeKey(true, onClose);

  const all = Array.from(new Set([...bookmarks, ...recent, ...Object.values(EXERCISE_LIBRARY).flat()]));
  const pool = part === '즐겨찾기' ? bookmarks
    : part === '최근' ? recent
    : part === '전체' ? all
    : Array.from(new Set([...bookmarks, ...recent].filter(n => getBodyPart(n) === part).concat(part === '기타' ? [] : EXERCISE_LIBRARY[part])));
  const q = query.trim().replace(/\s/g, '').toLowerCase();
  const list = pool.filter(n => !q || n.replace(/\s/g, '').toLowerCase().includes(q));
  const exactExists = pool.some(n => n.replace(/\s/g, '') === query.trim().replace(/\s/g, ''));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-dark-card w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl h-[80dvh] sm:h-[600px] flex flex-col animate-sheet-up pb-[env(safe-area-inset-bottom)] sm:pb-0" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-dark-text">종목 추가</h3>
            <button onClick={onClose} aria-label="닫기" className="w-11 h-11 -mr-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xl">×</button>
          </div>
          <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="종목 검색 또는 직접 입력" className={inputCls} />
          <div className="flex gap-1.5 overflow-x-auto -mx-5 px-5 pb-1 no-scrollbar">
            {(['즐겨찾기', '최근', '전체', ...BODY_PARTS] as PickerTab[]).filter(p => p !== '최근' || recent.length > 0).map(p => (
              <button key={p} onClick={() => setPart(p)}
                className={`shrink-0 h-9 px-3.5 rounded-full text-xs font-medium transition-colors ${
                  part === p ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-700/70 text-slate-500 dark:text-slate-300'
                }`}>
                {p === '즐겨찾기' && <span className={`mr-1 ${part === p ? '' : 'text-amber-400'}`}>★</span>}
                {BODY_PARTS.includes(p as BodyPart) && <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ background: BODY_PART_COLOR[p as BodyPart] }} />}
                {p}{p === '즐겨찾기' && bookmarks.length > 0 ? ` ${bookmarks.length}` : ''}
              </button>
            ))}
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto px-2 pb-4 themed-scrollbar">
          {query.trim() && !exactExists && (
            <li>
              <button onClick={() => onPick(query.trim())} className="w-full flex items-center gap-3 px-3 min-h-[52px] rounded-xl text-left hover:bg-orange-50 dark:hover:bg-orange-900/10">
                <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-lg shrink-0">+</span>
                <span className="text-sm font-semibold text-orange-600 dark:text-orange-400 truncate">'{query.trim()}' 직접 추가</span>
              </button>
            </li>
          )}
          {list.map(name => {
            const bp = getBodyPart(name);
            const added = exclude.includes(name);
            return (
              <li key={name} className="flex items-center rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                <button onClick={() => onPick(name)} disabled={added}
                  className="flex-1 min-w-0 flex items-center gap-3 pl-3 py-1.5 min-h-[60px] text-left disabled:opacity-40">
                  <ExerciseThumb name={name} size="w-12 h-12" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-800 dark:text-dark-text truncate">{name}</span>
                    <span className="block text-xs text-slate-400 truncate">{bp}{getExerciseInfo(name) ? ` · ${getExerciseInfo(name)!.equipment}` : ''}{added ? ' · 추가됨' : ''}</span>
                  </span>
                </button>
                <StarButton on={bookmarks.includes(name)} name={name} onToggle={() => onToggleBookmark(name)} className="mr-1" />
              </li>
            );
          })}
          {list.length === 0 && !query.trim() && (
            <li className="text-center text-sm text-slate-400 py-10">
              {part === '즐겨찾기' ? <>자주 하는 종목의 <span className="text-amber-400">★</span>를 눌러 즐겨찾기에 담아두세요</> : '종목이 없어요'}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

// ── 휴식 타이머 ─────────────────────────────────────
const useRestTimer = () => {
  const [restSec, setRestSec] = useState<number>(() => {
    try { return parseInt(localStorage.getItem('restSeconds') || '90', 10) || 90; } catch { return 90; }
  });
  const [endAt, setEndAt] = useState<number | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!endAt) return;
    const id = setInterval(() => {
      if (Date.now() >= endAt) {
        setEndAt(null);
        try { navigator.vibrate?.([200, 100, 200]); } catch {}
      } else tick(t => t + 1);
    }, 250);
    return () => clearInterval(id);
  }, [endAt]);

  const changeRest = (s: number) => {
    setRestSec(s);
    try { localStorage.setItem('restSeconds', String(s)); } catch {}
  };
  const remaining = endAt ? Math.max(0, Math.ceil((endAt - Date.now()) / 1000)) : 0;
  return {
    restSec, changeRest, remaining, running: endAt !== null,
    start: () => setEndAt(Date.now() + restSec * 1000),
    add: (s: number) => setEndAt(e => (e ? Math.max(Date.now() + 1000, e + s * 1000) : e)),
    stop: () => setEndAt(null),
  };
};

export const WeightTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [view, setView] = useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() + 1 }; });
  const [logs, setLogs] = useState<WorkoutLog[]>([]);         // 보고 있는 달
  const [prevLogs, setPrevLogs] = useState<WorkoutLog[]>([]); // 지난 달 — '이전 기록'과 전월 대비용

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [selectedRoutineId, setSelectedRoutineId] = useState<number | null>(null);
  const [blocks, setBlocks] = useState<ExerciseBlock[]>([]);
  const [logMemo, setLogMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  // 종목 상세 시트: add = 종목 추가 시트에서 고른 종목, edit = 카드에서 연 기존 종목(bi)
  const [detail, setDetail] = useState<{ name: string; mode: 'add' | 'edit'; bi?: number } | null>(null);
  const [typeMenu, setTypeMenu] = useState<{ bi: number; si: number } | null>(null);
  const [showRestMenu, setShowRestMenu] = useState(false);

  const [editingRoutine, setEditingRoutine] = useState<WorkoutRoutine | null>(null);
  useEscapeKey(editingRoutine !== null, () => setEditingRoutine(null));
  const { toast, show } = useToast();
  const rest = useRestTimer();

  const fetchAll = useCallback(async () => {
    const { year, month } = view;
    const py = month === 1 ? year - 1 : year;
    const pm = month === 1 ? 12 : month - 1;
    const [routinesRes, logsRes, prevRes] = await Promise.allSettled([
      api.get('/workouts/routines'),
      api.get(`/workouts/logs?year=${year}&month=${month}`),
      api.get(`/workouts/logs?year=${py}&month=${pm}`),
    ]);
    if (routinesRes.status === 'fulfilled') setRoutines(routinesRes.value.data.data || []);
    setLogs(logsRes.status === 'fulfilled' ? logsRes.value.data.data || [] : []);
    setPrevLogs(prevRes.status === 'fulfilled' ? prevRes.value.data.data || [] : []);
    setLoading(false);
  }, [view]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const selectedLog = logs.find(l => l.workoutDate === selectedDate);

  useEffect(() => {
    if (selectedLog) {
      setBlocks(groupSetsToBlocks(selectedLog.sets));
      setLogMemo(selectedLog.memo || '');
      setSelectedRoutineId(selectedLog.routineId ?? null);
    } else {
      setBlocks([]);
      setLogMemo('');
      setSelectedRoutineId(null);
    }
  }, [selectedLog]);

  const dirty = snapshotOf(blocks, logMemo) !== snapshotOf(selectedLog ? groupSetsToBlocks(selectedLog.sets) : [], selectedLog?.memo || '');

  const confirmLeave = () => !dirty || window.confirm('저장하지 않은 운동 기록이 있어요. 이동할까요?');

  const selectDate = (ymd: string) => {
    if (ymd === selectedDate || !confirmLeave()) return;
    setSelectedDate(ymd);
  };

  const moveMonth = (d: number) => {
    if (!confirmLeave()) return;
    let m = view.month + d, y = view.year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setView({ year: y, month: m });
    // 선택 날짜는 항상 보고 있는 달 안에 — 이번 달이면 오늘, 아니면 1일
    const t = todayStr();
    const ym = `${y}-${String(m).padStart(2, '0')}`;
    setSelectedDate(t.startsWith(ym) ? t : `${ym}-01`);
  };

  // ── 이전 기록: 선택 날짜 이전에 같은 종목을 한 가장 최근 세션 ──
  const history = useMemo(() => [...prevLogs, ...logs]
    .filter(l => l.sets.length > 0)
    .sort((a, b) => b.workoutDate.localeCompare(a.workoutDate)), [logs, prevLogs]);

  const previousOf = (name: string): { date: string; sets: WorkoutSet[] } | null => {
    for (const l of history) {
      if (l.workoutDate >= selectedDate) continue;
      const sets = l.sets.filter(s => s.exerciseName === name).sort((a, b) => a.setNumber - b.setNumber);
      if (sets.length > 0) return { date: l.workoutDate, sets };
    }
    return null;
  };

  const recentExercises = useMemo(() => Array.from(new Set([
    ...history.flatMap(l => l.sets.map(s => s.exerciseName)),
    ...routines.flatMap(r => r.exercises.map(e => e.exerciseName)),
  ].filter(n => n && n.trim()))), [history, routines]);

  // ── 종목 즐겨찾기 (월과 무관 — 한 번만 조회) ──────────
  useEffect(() => {
    api.get('/workouts/bookmarks').then(r => setBookmarks(r.data.data || [])).catch(() => {});
  }, []);

  // 낙관적 업데이트 — 실패하면 되돌리고 토스트
  const toggleBookmark = async (name: string) => {
    const on = bookmarks.includes(name);
    const prev = bookmarks;
    setBookmarks(on ? bookmarks.filter(b => b !== name) : [...bookmarks, name]);
    try {
      const r = on
        ? await api.delete('/workouts/bookmarks', { params: { exerciseName: name } })
        : await api.post('/workouts/bookmarks', { exerciseName: name });
      setBookmarks(r.data.data || []);
      show(on ? '즐겨찾기에서 뺐어요' : '즐겨찾기에 추가했어요');
    } catch {
      setBookmarks(prev);
      show('즐겨찾기 저장에 실패했어요', 'error');
    }
  };

  // ── 오늘의 기록 편집 ──────────────────────────────
  // 상세 시트 기본값: 지난 세션의 본세트 수·마지막 무게/횟수, 첫 기록이면 3세트
  const defaultConfig = (name: string): SetConfig => {
    const working = previousOf(name)?.sets.filter(isWorking) || [];
    const lastSet = working[working.length - 1];
    return working.length > 0 ? { sets: working.length, weightKg: lastSet.weightKg, reps: lastSet.reps } : { sets: 3 };
  };

  // 선택 날짜 이전 세션들 (오래된 순) — 상세 시트 기록 차트용
  const sessionsOf = (name: string) => history
    .filter(l => l.workoutDate < selectedDate)
    .map(l => ({ date: l.workoutDate, sets: l.sets.filter(s => s.exerciseName === name) }))
    .filter(s => s.sets.length > 0)
    .reverse();

  const addExercise = (name: string, cfg: SetConfig) => {
    setBlocks(p => {
      const order = p.length;
      return [...p, {
        exerciseName: name, sortOrder: order,
        sets: Array.from({ length: cfg.sets }, (_, i) => ({
          exerciseName: name, exerciseSortOrder: order, setNumber: i + 1,
          weightKg: cfg.weightKg, reps: cfg.reps, isDone: false, setType: 'NORMAL' as SetType,
        })),
      }];
    });
  };

  // 상세 시트 '적용': 완료한 세트는 그대로 두고, 남은 세트에 무게·횟수 적용 + 세트 수 맞추기
  const applyConfig = (bi: number, cfg: SetConfig) => {
    setBlocks(prev => prev.map((b, i) => {
      if (i !== bi) return b;
      const done = b.sets.filter(s => s.isDone).length;
      const target = Math.max(done, cfg.sets);
      const sets = b.sets.slice(0, target).map(s => s.isDone ? s : { ...s, weightKg: cfg.weightKg, reps: cfg.reps });
      while (sets.length < target) {
        sets.push({ exerciseName: b.exerciseName, exerciseSortOrder: b.sortOrder, setNumber: sets.length + 1, weightKg: cfg.weightKg, reps: cfg.reps, isDone: false, setType: 'NORMAL' });
      }
      return { ...b, sets };
    }));
  };

  const removeExerciseBlock = (bi: number) => {
    if (!window.confirm(`${blocks[bi].exerciseName}을(를) 오늘 운동에서 뺄까요?`)) return;
    setBlocks(prev => prev.filter((_, i) => i !== bi)
      .map((b, i) => ({ ...b, sortOrder: i, sets: b.sets.map(s => ({ ...s, exerciseSortOrder: i })) })));
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
          setType: last?.setType === 'WARMUP' ? 'NORMAL' : last?.setType,
        }],
      };
    }));
  };

  const removeLastSet = (bi: number) => {
    setBlocks(prev => prev.map((b, i) => i !== bi || b.sets.length <= 1 ? b : { ...b, sets: b.sets.slice(0, -1) }));
  };

  const updateSet = (bi: number, si: number, patch: Partial<WorkoutSet>) => {
    setBlocks(prev => prev.map((b, i) => i !== bi ? b
      : { ...b, sets: b.sets.map((s, idx) => idx !== si ? s : { ...s, ...patch }) }));
  };

  const toggleDone = (bi: number, si: number) => {
    const set = blocks[bi].sets[si];
    const done = !set.isDone;
    // 무게·횟수 비어 있으면 이전 기록으로 채우고 완료 (번핏처럼 체크 한 번으로 기록)
    const prev = previousOf(blocks[bi].exerciseName)?.sets[si];
    updateSet(bi, si, {
      isDone: done,
      ...(done && set.weightKg == null && prev?.weightKg != null ? { weightKg: prev.weightKg } : {}),
      ...(done && set.reps == null && prev?.reps != null ? { reps: prev.reps } : {}),
    });
    if (done) rest.start();
  };

  const startFromRoutine = (routine: WorkoutRoutine) => {
    if (blocks.length > 0 && !window.confirm(`지금 기록을 "${routine.name}" 루틴으로 바꿀까요?`)) return;
    const newBlocks: ExerciseBlock[] = routine.exercises.map((ex, i) => {
      const prev = previousOf(ex.exerciseName)?.sets || [];
      return {
        exerciseName: ex.exerciseName,
        sortOrder: i,
        sets: Array.from({ length: ex.targetSets || 1 }, (_, si) => ({
          exerciseName: ex.exerciseName, exerciseSortOrder: i, setNumber: si + 1,
          weightKg: prev[si]?.weightKg ?? prev[prev.length - 1]?.weightKg,
          reps: prev[si]?.reps ?? prev[prev.length - 1]?.reps,
          isDone: false,
          setType: prev[si]?.setType ?? 'NORMAL',
        })),
      };
    });
    setBlocks(newBlocks);
    setSelectedRoutineId(routine.id ?? null);
  };

  const allSets = blocks.flatMap(b => b.sets);
  const doneSets = allSets.filter(s => s.isDone).length;
  const totalVolume = volumeOf(allSets.filter(s => s.isDone));

  const saveLog = async () => {
    const sets = blocks
      .filter(b => b.exerciseName.trim())
      .flatMap(b => b.sets.map((s, idx) => ({
        id: s.id, exerciseName: b.exerciseName, exerciseSortOrder: b.sortOrder,
        setNumber: idx + 1, weightKg: s.weightKg, reps: s.reps, isDone: s.isDone, setType: s.setType || 'NORMAL',
      })));
    setSaving(true);
    try {
      await api.post('/workouts/logs', {
        routineId: selectedRoutineId, workoutDate: selectedDate, memo: logMemo, sets,
      });
      show('운동 기록을 저장했어요');
      await fetchAll();
    } catch { show('저장에 실패했어요', 'error'); }
    finally { setSaving(false); }
  };

  const deleteCurrentLog = async () => {
    if (!selectedLog?.id || !window.confirm(`${dateLabel(selectedDate)} 운동 기록을 삭제할까요?`)) return;
    try {
      await api.delete(`/workouts/logs/${selectedLog.id}`);
      show('삭제했어요');
      fetchAll();
    } catch { show('삭제에 실패했어요', 'error'); }
  };

  // ── 루틴 관리 ─────────────────────────────────────
  const openNewRoutine = () => setEditingRoutine({
    name: '', sortOrder: routines.length,
    // 오늘 기록이 있으면 그대로 루틴으로 만들 수 있게 미리 채움
    exercises: blocks.filter(b => b.exerciseName.trim()).map((b, i) => ({ exerciseName: b.exerciseName, targetSets: b.sets.length, sortOrder: i })),
  });
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

  const toRoutinePayload = (list: WorkoutRoutine[]) => list.map((r, i) => ({
    id: r.id, name: r.name, sortOrder: i,
    exercises: r.exercises.filter(e => e.exerciseName.trim()).map((e, ei) => ({ id: e.id, exerciseName: e.exerciseName, targetSets: e.targetSets, sortOrder: ei })),
  }));

  const saveRoutine = async () => {
    if (!editingRoutine || !editingRoutine.name.trim()) return;
    try {
      await api.post('/workouts/routines', toRoutinePayload(editingRoutine.id == null ? [...routines, editingRoutine] : routines.map(r => r.id === editingRoutine.id ? editingRoutine : r)));
      setEditingRoutine(null);
      show('루틴을 저장했어요');
      fetchAll();
    } catch { show('루틴 저장에 실패했어요', 'error'); }
  };

  const deleteRoutine = async (r: WorkoutRoutine) => {
    if (!window.confirm(`"${r.name}" 루틴을 삭제할까요?`)) return;
    try {
      await api.post('/workouts/routines', toRoutinePayload(routines.filter(x => x.id !== r.id)));
      setEditingRoutine(null);
      fetchAll();
    } catch { show('삭제에 실패했어요', 'error'); }
  };

  // ── 달력·월간 통계 ────────────────────────────────
  const logByDate: Record<string, WorkoutLog> = Object.fromEntries(logs.filter(l => l.sets.length > 0).map(l => [l.workoutDate, l]));
  const partsOf = (sets: WorkoutSet[]) => Array.from(new Set(sets.map(s => getBodyPart(s.exerciseName))));
  const firstDow = new Date(view.year, view.month - 1, 1).getDay();
  const daysInMonth = new Date(view.year, view.month, 0).getDate();
  const ymPrefix = `${view.year}-${String(view.month).padStart(2, '0')}`;
  const cells: (string | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${ymPrefix}-${String(i + 1).padStart(2, '0')}`),
  ];

  const monthLogs = Object.values(logByDate);
  const monthSets = monthLogs.flatMap(l => l.sets).filter(s => (s.reps || s.weightKg) && isWorking(s));
  const monthVolume = volumeOf(monthSets);
  const prevMonthDays = prevLogs.filter(l => l.sets.length > 0).length;
  const partCounts = BODY_PARTS
    .map(p => ({ part: p, count: monthSets.filter(s => getBodyPart(s.exerciseName) === p).length }))
    .filter(p => p.count > 0)
    .sort((a, b) => b.count - a.count);
  const bestLifts = Object.values(monthSets.reduce<Record<string, { name: string; e1rm: number; set: WorkoutSet }>>((acc, s) => {
    const e = estimate1RM(s.weightKg, s.reps);
    if (e > 0 && (!acc[s.exerciseName] || e > acc[s.exerciseName].e1rm)) acc[s.exerciseName] = { name: s.exerciseName, e1rm: e, set: s };
    return acc;
  }, {})).sort((a, b) => b.e1rm - a.e1rm).slice(0, 3);

  if (loading) {
    return (
      <div className="p-4 grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-4">
        <div className={`${CARD} h-80 animate-pulse`} />
        <div className={`${CARD} h-80 animate-pulse`} />
      </div>
    );
  }

  const today = todayStr();

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] gap-4 items-start">

      {/* ══ 왼쪽 위: 달력 — 모바일 순서는 달력 → 오늘 운동 → 통계·루틴 ══ */}
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">
        <section className={`${CARD} p-4`}>
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => moveMonth(-1)} aria-label="이전 달" className="w-11 h-11 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg">‹</button>
            <p className="text-base font-bold text-slate-900 dark:text-dark-text tabular-nums">{view.year}년 {view.month}월</p>
            <button onClick={() => moveMonth(1)} aria-label="다음 달" className="w-11 h-11 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg">›</button>
          </div>
          <div className="grid grid-cols-7">
            {WEEKDAYS.map((w, i) => (
              <span key={w} className={`text-center text-[11px] font-medium py-1 ${i === 0 ? 'text-rose-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'}`}>{w}</span>
            ))}
            {cells.map((ymd, i) => {
              if (!ymd) return <span key={`e${i}`} />;
              const log = logByDate[ymd];
              const parts = log ? partsOf(log.sets) : [];
              const isSel = ymd === selectedDate;
              const isToday = ymd === today;
              return (
                <button key={ymd} onClick={() => selectDate(ymd)} aria-label={`${ymd}${log ? ' 운동함' : ''}`}
                  className="h-12 flex flex-col items-center justify-center gap-1 group">
                  <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm tabular-nums transition-colors ${
                    isSel ? 'bg-orange-500 text-white font-bold'
                      : log ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-semibold'
                      : isToday ? 'text-orange-500 font-bold' : 'text-slate-600 dark:text-slate-300 group-hover:bg-slate-100 dark:group-hover:bg-slate-800'
                  }`}>{Number(ymd.slice(8))}</span>
                  <span className="flex gap-0.5 h-1.5">
                    {parts.slice(0, 3).map(p => <span key={p} className="w-1.5 h-1.5 rounded-full" style={{ background: BODY_PART_COLOR[p] }} />)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* ══ 왼쪽 아래: 월간 통계 + 루틴 ══ */}
      <div className="space-y-4 min-w-0 order-last lg:order-none lg:col-start-1 lg:row-start-2">
        <section className={`${CARD} p-4 space-y-4`}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-slate-400">운동일</p>
              <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-dark-text mt-0.5">{monthLogs.length}<span className="text-xs font-medium text-slate-400">일</span></p>
              {prevMonthDays > 0 && (
                <p className={`text-[11px] tabular-nums ${monthLogs.length >= prevMonthDays ? 'text-emerald-500' : 'text-slate-400'}`}>
                  지난달 {monthLogs.length - prevMonthDays >= 0 ? '+' : ''}{monthLogs.length - prevMonthDays}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-400">총 세트</p>
              <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-dark-text mt-0.5">{monthSets.length}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400">총 볼륨</p>
              <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-dark-text mt-0.5 truncate">
                {monthVolume >= 10000 ? `${(monthVolume / 1000).toFixed(1)}t` : fmtKg(monthVolume)}
              </p>
            </div>
          </div>

          {partCounts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">부위별 세트</p>
              <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700">
                {partCounts.map(p => <div key={p.part} style={{ width: `${(p.count / monthSets.length) * 100}%`, background: BODY_PART_COLOR[p.part] }} />)}
              </div>
              <ul className="grid grid-cols-3 gap-x-2 gap-y-1">
                {partCounts.map(p => (
                  <li key={p.part} className="flex items-center gap-1.5 text-xs min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: BODY_PART_COLOR[p.part] }} />
                    <span className="text-slate-600 dark:text-slate-300">{p.part}</span>
                    <span className="text-slate-400 tabular-nums ml-auto">{Math.round((p.count / monthSets.length) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center">이번 달 기록이 쌓이면 부위별 분석이 보여요</p>
          )}

          {bestLifts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">이번 달 최고 기록 <span className="font-normal text-slate-400">(추정 1RM)</span></p>
              {bestLifts.map(b => (
                <div key={b.name} className="flex items-center gap-2 text-sm min-w-0">
                  <span className="w-1 h-4 rounded-full shrink-0" style={{ background: BODY_PART_COLOR[getBodyPart(b.name)] }} />
                  <span className="truncate flex-1 text-slate-700 dark:text-slate-200">{b.name}</span>
                  <span className="text-xs text-slate-400 tabular-nums shrink-0">{fmtW(b.set.weightKg)}×{b.set.reps}</span>
                  <span className="font-bold tabular-nums text-slate-900 dark:text-dark-text shrink-0 w-14 text-right">{Math.round(b.e1rm)}kg</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={`${CARD} p-4`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-dark-text">내 루틴</h2>
            <button onClick={openNewRoutine} className="h-9 px-3 text-xs font-semibold text-orange-500 hover:text-orange-600">+ 새 루틴</button>
          </div>
          {routines.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3">자주 하는 종목 묶음을 루틴으로 저장해두세요</p>
          ) : (
            <ul className="divide-y divide-slate-50 dark:divide-dark-border/50 -mx-1">
              {routines.map(r => (
                <li key={r.id} className="flex items-center gap-1">
                  <button onClick={() => openEditRoutine(r)} className="flex-1 min-w-0 text-left px-1 py-2.5 min-h-[52px]">
                    <p className="text-sm font-semibold text-slate-800 dark:text-dark-text truncate">{r.name}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{r.exercises.map(e => e.exerciseName).join(' · ') || '종목 없음'}</p>
                  </button>
                  <button onClick={() => startFromRoutine(r)} className="shrink-0 h-9 px-3 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 text-xs font-semibold hover:bg-orange-100">시작</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ══ 오른쪽: 선택한 날의 운동 ══ */}
      <div className="space-y-3 min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2">
        <section className={`${CARD} p-4 sm:p-5`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-slate-400">{selectedDate === today ? '오늘의 운동' : '운동 기록'}</p>
              <h2 className="text-xl font-bold text-slate-900 dark:text-dark-text">{dateLabel(selectedDate)}</h2>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {selectedDate !== today && today.startsWith(ymPrefix) && (
                <button onClick={() => selectDate(today)} className="h-9 px-3 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">오늘</button>
              )}
              {selectedLog?.id && (
                <button onClick={deleteCurrentLog} className="h-9 px-3 rounded-full text-xs font-medium text-slate-400 hover:text-rose-500">삭제</button>
              )}
            </div>
          </div>
          {blocks.length > 0 && (
            <>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {partsOf(allSets).map(p => (
                  <span key={p} className="text-xs font-medium px-3 py-1 rounded-full text-white" style={{ background: BODY_PART_COLOR[p] }}>{p}</span>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3">
                  <p className="text-[11px] text-slate-400">종목</p>
                  <p className="text-base font-bold tabular-nums text-slate-900 dark:text-dark-text">{blocks.length}개</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3">
                  <p className="text-[11px] text-slate-400">완료 세트</p>
                  <p className="text-base font-bold tabular-nums text-slate-900 dark:text-dark-text">{doneSets}<span className="text-xs text-slate-400 font-medium"> / {allSets.length}</span></p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3 min-w-0">
                  <p className="text-[11px] text-slate-400">볼륨</p>
                  <p className="text-base font-bold tabular-nums text-slate-900 dark:text-dark-text truncate">{fmtKg(totalVolume)}</p>
                </div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${allSets.length ? (doneSets / allSets.length) * 100 : 0}%` }} />
              </div>
            </>
          )}
        </section>

        {blocks.length === 0 && (
          <section className={`${CARD} p-6 text-center`}>
            <p className="text-4xl mb-2">🏋️</p>
            <p className="text-slate-700 dark:text-slate-200 font-semibold">{selectedDate > today ? '아직 오지 않은 날이에요' : '운동 기록이 없어요'}</p>
            <p className="text-sm text-slate-400 mt-1">루틴으로 시작하거나 종목을 하나씩 추가하세요</p>
            {routines.length > 0 && (
              <div className="flex gap-2 flex-wrap justify-center mt-4">
                {routines.map(r => (
                  <button key={r.id} onClick={() => startFromRoutine(r)}
                    className="h-11 px-4 rounded-full text-sm font-medium bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100">
                    {r.name}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── 종목 카드 ── */}
        {blocks.map((block, bi) => {
          const prev = previousOf(block.exerciseName);
          const best = Math.max(0, ...block.sets.filter(isWorking).map(s => estimate1RM(s.weightKg, s.reps)));
          const blockDone = block.sets.length > 0 && block.sets.every(s => s.isDone);
          let normalNo = 0; // 일반·드롭·실패 세트만 번호를 매김 (웜업은 W)
          return (
            <section key={`${block.sortOrder}-${block.exerciseName}`} className={`${CARD} animate-rise-in ${typeMenu?.bi === bi ? 'relative z-20' : ''}`}>
              <div className="px-4 sm:px-5 pt-4 pb-2 flex items-start gap-3">
                <button type="button" onClick={() => setDetail({ name: block.exerciseName, mode: 'edit', bi })}
                  className="min-w-0 flex-1 flex items-start gap-3 text-left group" aria-label={`${block.exerciseName} 상세 보기`}>
                  <span className="relative shrink-0">
                    <ExerciseThumb name={block.exerciseName} size="w-12 h-12" />
                    {blockDone && <span className="absolute -right-1 -bottom-1 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-dark-card animate-pop">✓</span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 min-w-0">
                      <span className="text-base font-bold text-slate-900 dark:text-dark-text truncate group-hover:text-orange-500 transition-colors">{block.exerciseName || '이름 없는 종목'}</span>
                      <span className="text-slate-300 dark:text-slate-600 shrink-0">›</span>
                    </span>
                    <span className="block text-xs text-slate-400 truncate tabular-nums">
                      {prev ? `지난 기록 ${Number(prev.date.slice(5, 7))}/${Number(prev.date.slice(8))} · ${prev.sets.map(s => `${fmtW(s.weightKg) || '-'}×${s.reps ?? '-'}`).join(', ')}` : '첫 기록이에요'}
                    </span>
                  </span>
                </button>
                {best > 0 && (
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-slate-400">1RM</p>
                    <p className="text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">{Math.round(best)}kg</p>
                  </div>
                )}
                <button onClick={() => removeExerciseBlock(bi)} aria-label="종목 빼기" className="w-9 h-9 -mr-2 -mt-1 rounded-full text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-lg shrink-0">×</button>
              </div>

              <div className="px-2 sm:px-3">
                <div className="grid grid-cols-[2rem_minmax(0,1fr)_4.25rem_3.5rem_2.75rem] gap-1.5 px-2 py-1.5 text-[11px] font-medium text-slate-400 text-center">
                  <span>세트</span><span>이전</span><span>kg</span><span>회</span><span>완료</span>
                </div>
                {block.sets.map((set, si) => {
                  const p = prev?.sets[si];
                  const type = SET_TYPES.find(t => t.value === (set.setType || 'NORMAL'))!;
                  if (type.value !== 'WARMUP') normalNo += 1;
                  const menuOpen = typeMenu?.bi === bi && typeMenu?.si === si;
                  return (
                    <div key={si} className={`relative grid grid-cols-[2rem_minmax(0,1fr)_4.25rem_3.5rem_2.75rem] gap-1.5 items-center px-2 py-1 rounded-xl transition-colors duration-300 ${set.isDone ? 'bg-emerald-50 dark:bg-emerald-900/15' : ''}`}>
                      <button type="button" onClick={() => setTypeMenu(menuOpen ? null : { bi, si })} aria-label={`${si + 1}번째 세트 종류: ${type.label}`}
                        className={`h-10 rounded-lg text-sm font-bold text-center tabular-nums hover:bg-slate-100 dark:hover:bg-slate-800 ${
                          set.isDone && type.value === 'NORMAL' ? 'text-emerald-600 dark:text-emerald-400' : type.cls
                        } ${menuOpen ? 'bg-slate-100 dark:bg-slate-800' : ''}`}>
                        {type.short || normalNo}{type.value === 'DROP' || type.value === 'FAILURE' ? <sub className="text-[9px] ml-px">{normalNo}</sub> : null}
                      </button>
                      {menuOpen && (
                        <div className="absolute left-1 top-full mt-1 z-20 w-44 bg-white dark:bg-dark-card rounded-xl shadow-2xl p-1 animate-rise-in">
                          {SET_TYPES.map(t => (
                            <button key={t.value} type="button"
                              onClick={() => { updateSet(bi, si, { setType: t.value }); setTypeMenu(null); }}
                              className={`w-full flex items-center gap-2.5 h-10 px-2.5 rounded-lg text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-800 ${(set.setType || 'NORMAL') === t.value ? 'bg-slate-50 dark:bg-slate-800 font-semibold' : ''}`}>
                              <span className={`w-6 text-center font-bold ${t.cls}`}>{t.short || '1'}</span>
                              <span className="text-slate-700 dark:text-slate-200">{t.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      <button type="button" disabled={!p}
                        onClick={() => p && updateSet(bi, si, { weightKg: p.weightKg, reps: p.reps })}
                        className="h-10 text-xs text-slate-400 tabular-nums truncate rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:hover:bg-transparent">
                        {p ? `${fmtW(p.weightKg) || '-'}×${p.reps ?? '-'}` : '—'}
                      </button>
                      <NumCell decimal value={set.weightKg} placeholder={fmtW(p?.weightKg) || '0'}
                        onChange={v => updateSet(bi, si, { weightKg: v })}
                        className={`${cellInput} ${set.isDone ? 'bg-white/70 dark:bg-dark-card/60' : ''}`} />
                      <NumCell value={set.reps} placeholder={p?.reps != null ? String(p.reps) : '0'}
                        onChange={v => updateSet(bi, si, { reps: v })}
                        className={`${cellInput} ${set.isDone ? 'bg-white/70 dark:bg-dark-card/60' : ''}`} />
                      <button type="button" onClick={() => toggleDone(bi, si)} aria-label={`${si + 1}세트 완료`}
                        className={`w-11 h-10 flex items-center justify-center rounded-lg text-base font-bold transition-colors ${
                          set.isDone ? 'bg-emerald-500 text-white animate-pop' : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 hover:text-slate-500'
                        }`}>✓</button>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 sm:px-5">
                <button onClick={() => removeLastSet(bi)} disabled={block.sets.length <= 1}
                  className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40">− 세트 삭제</button>
                <button onClick={() => addSet(bi)}
                  className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">+ 세트 추가</button>
              </div>
            </section>
          );
        })}

        <button onClick={() => setShowPicker(true)}
          className="w-full h-12 rounded-2xl border-2 border-dashed border-orange-300 dark:border-orange-900/60 text-sm font-semibold text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors">
          + 종목 추가
        </button>

        {blocks.length > 0 && (
          <textarea value={logMemo} onChange={e => setLogMemo(e.target.value)}
            placeholder="오늘 컨디션, 메모..." rows={2}
            className={`${CARD} w-full p-4 text-sm dark:text-dark-text outline-none focus:ring-2 focus:ring-orange-400 resize-none`} />
        )}

        {/* ── 하단 고정: 휴식 타이머 + 저장 ── */}
        {(blocks.length > 0 || rest.running) && (
          <div className="sticky bottom-0 -mx-4 px-4 pt-2 pb-4 bg-gradient-to-t from-slate-50 via-slate-50 dark:from-dark-bg dark:via-dark-bg to-transparent space-y-2">
            {rest.running && (
              <div className="rounded-2xl bg-slate-900 dark:bg-slate-700 text-white p-3 flex items-center gap-3 shadow-2xl">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-white/60">휴식 중</p>
                  <p className="text-2xl font-bold tabular-nums leading-tight">{Math.floor(rest.remaining / 60)}:{String(rest.remaining % 60).padStart(2, '0')}</p>
                </div>
                <button onClick={() => rest.add(-15)} className="h-11 px-3 rounded-xl bg-white/10 text-sm font-medium hover:bg-white/20">−15</button>
                <button onClick={() => rest.add(15)} className="h-11 px-3 rounded-xl bg-white/10 text-sm font-medium hover:bg-white/20">+15</button>
                <button onClick={rest.stop} className="h-11 px-4 rounded-xl bg-orange-500 text-sm font-bold hover:bg-orange-600">건너뛰기</button>
              </div>
            )}
            {blocks.length > 0 && (
              <div className={`${CARD} p-2 flex items-center gap-2`}>
                <div className="relative">
                  <button onClick={() => setShowRestMenu(v => !v)} className="h-11 px-3 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 tabular-nums">
                    ⏱ 휴식 {rest.restSec}초
                  </button>
                  {showRestMenu && (
                    <div className="absolute bottom-12 left-0 bg-white dark:bg-dark-card rounded-xl shadow-2xl p-1 flex gap-1 z-10">
                      {REST_OPTIONS.map(s => (
                        <button key={s} onClick={() => { rest.changeRest(s); setShowRestMenu(false); }}
                          className={`h-10 px-3 rounded-lg text-xs font-medium tabular-nums ${rest.restSec === s ? 'bg-orange-500 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{s}초</button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="flex-1 min-w-0 text-xs text-slate-400 truncate">{dirty ? '저장하지 않은 기록이 있어요' : '저장됨'}</p>
                <button onClick={saveLog} disabled={saving || !dirty}
                  className="h-11 px-5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 disabled:opacity-40 transition-colors shrink-0">
                  {saving ? '저장 중...' : '운동 저장'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showPicker && (
        <ExercisePicker recent={recentExercises} bookmarks={bookmarks} exclude={blocks.map(b => b.exerciseName)}
          onToggleBookmark={toggleBookmark}
          onPick={name => { setShowPicker(false); setDetail({ name, mode: 'add' }); }}
          onClose={() => setShowPicker(false)} />
      )}

      {detail && (() => {
        const block = detail.mode === 'edit' && detail.bi != null ? blocks[detail.bi] : null;
        const remaining = block?.sets.filter(s => !s.isDone) || [];
        const initial: SetConfig = block
          ? { sets: block.sets.length, weightKg: remaining[0]?.weightKg ?? block.sets[block.sets.length - 1]?.weightKg, reps: remaining[0]?.reps ?? block.sets[block.sets.length - 1]?.reps }
          : defaultConfig(detail.name);
        return (
          <ExerciseDetail key={`${detail.name}-${detail.mode}`} name={detail.name} mode={detail.mode} initial={initial}
            sessions={sessionsOf(detail.name)}
            bookmarked={bookmarks.includes(detail.name)} onToggleBookmark={() => toggleBookmark(detail.name)}
            onClose={() => { const back = detail.mode === 'add'; setDetail(null); if (back) setShowPicker(true); }}
            onConfirm={cfg => {
              if (detail.mode === 'add') addExercise(detail.name, cfg);
              else if (detail.bi != null) applyConfig(detail.bi, cfg);
              setDetail(null);
            }} />
        );
      })()}

      {/* 세트 종류 메뉴 바깥 클릭 시 닫기 */}
      {typeMenu && <div className="fixed inset-0 z-10" onClick={() => setTypeMenu(null)} />}

      {/* ── 루틴 편집 시트 ── */}
      {editingRoutine && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setEditingRoutine(null)}>
          <div className="bg-white dark:bg-dark-card w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 max-h-[92dvh] overflow-y-auto overscroll-contain" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-dark-text">{editingRoutine.id ? '루틴 편집' : '새 루틴'}</h2>
              <button onClick={() => setEditingRoutine(null)} aria-label="닫기" className="w-11 h-11 -mr-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xl">×</button>
            </div>

            <div className="flex flex-col gap-4">
              <input
                type="text" value={editingRoutine.name}
                onChange={e => setEditingRoutine(prev => prev ? { ...prev, name: e.target.value } : prev)}
                placeholder="루틴 이름 (예: 가슴/삼두 day)"
                className={`${inputCls} text-base font-semibold`}
              />

              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-slate-400">종목 {editingRoutine.exercises.length}개</p>
                {editingRoutine.exercises.map((ex, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-1 h-8 rounded-full shrink-0" style={{ background: BODY_PART_COLOR[getBodyPart(ex.exerciseName)] }} />
                    <ExerciseAutocomplete value={ex.exerciseName} onChange={v => updateRoutineExercise(i, 'exerciseName', v)} />
                    <div className="flex items-center h-11 rounded-xl bg-slate-50 dark:bg-dark-bg px-2 w-20 shrink-0 focus-within:ring-2 focus-within:ring-orange-400">
                      <input type="text" inputMode="numeric" value={ex.targetSets ?? ''}
                        onChange={e => updateRoutineExercise(i, 'targetSets', parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0)}
                        className="min-w-0 flex-1 bg-transparent outline-none text-center text-sm tabular-nums dark:text-dark-text" />
                      <span className="text-xs text-slate-400">세트</span>
                    </div>
                    <button onClick={() => removeRoutineExercise(i)} aria-label="종목 삭제" className="w-11 h-11 rounded-xl text-slate-300 hover:text-rose-500 text-lg shrink-0">×</button>
                  </div>
                ))}
                <button onClick={addRoutineExercise} className="h-11 rounded-xl border border-dashed border-slate-300 dark:border-dark-border text-sm font-medium text-slate-500 hover:text-orange-500 hover:border-orange-400">+ 종목 추가</button>
              </div>

              <div className="flex gap-2">
                {editingRoutine.id && (
                  <button onClick={() => deleteRoutine(editingRoutine)}
                    className="h-12 px-4 rounded-xl text-sm font-medium text-rose-500 bg-rose-50 dark:bg-rose-900/15 hover:bg-rose-100">삭제</button>
                )}
                <button
                  onClick={saveRoutine}
                  disabled={!editingRoutine.name.trim()}
                  className="flex-1 h-12 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
};
