import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { Toast, useToast } from '../components/Toast';

interface Diary {
  id: number; date: string; marketMood: string; myEmotion: string;
  title: string; body: string;
}

// 한국 증시 관례: 강세 빨강 / 약세 파랑
const MOOD_OPTIONS = [
  { value: 'BULLISH', label: '강세', icon: '📈', chip: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400' },
  { value: 'NEUTRAL', label: '보합', icon: '➡️', chip: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  { value: 'BEARISH', label: '약세', icon: '📉', chip: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' },
];
const EMOTION_OPTIONS = [
  { value: 'CONFIDENT', label: '확신', icon: '💪', bar: 'bg-emerald-400', ring: 'ring-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' },
  { value: 'CALM', label: '평온', icon: '😌', bar: 'bg-sky-400', ring: 'ring-sky-400 bg-sky-50 dark:bg-sky-900/20' },
  { value: 'ANXIOUS', label: '불안', icon: '😟', bar: 'bg-amber-400', ring: 'ring-amber-400 bg-amber-50 dark:bg-amber-900/20' },
  { value: 'FEARFUL', label: '공포', icon: '😨', bar: 'bg-rose-400', ring: 'ring-rose-400 bg-rose-50 dark:bg-rose-900/20' },
];
const MOOD_BY = Object.fromEntries(MOOD_OPTIONS.map(o => [o.value, o]));
const EMOTION_BY = Object.fromEntries(EMOTION_OPTIONS.map(o => [o.value, o]));
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// toISOString()은 UTC라 KST 오전 9시 전엔 어제 날짜가 됨 → 로컬 기준으로 직접 조립
const toYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const now = new Date();
const todayStr = toYmd(now);
const dayLabel = (ymd: string) => {
  const d = new Date(`${ymd}T00:00:00`);
  return { day: d.getDate(), weekday: WEEKDAYS[d.getDay()] };
};
const CARD = 'bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none';
const EMPTY_FORM = { date: todayStr, marketMood: 'NEUTRAL', myEmotion: 'CALM', title: '', body: '' };

export const InvestDiaryPage = () => {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Diary | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const cardRefs = useRef<Record<number, HTMLElement | null>>({});
  const { toast, show } = useToast();
  useEscapeKey(showForm, () => setShowForm(false));

  const fetchDiaries = async () => {
    try {
      const r = await api.get(`/invest/diary?year=${year}&month=${month}`);
      setDiaries(r.data.data || []);
    } catch { setDiaries([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDiaries(); }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const moveMonth = (d: number) => {
    let m = month + d, y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setYear(y); setMonth(m);
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openNew = (date = todayStr) => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, date });
    setShowForm(true);
  };

  const openEdit = (d: Diary) => {
    setEditing(d);
    setForm({ date: d.date, marketMood: d.marketMood || 'NEUTRAL', myEmotion: d.myEmotion || 'CALM', title: d.title || '', body: d.body || '' });
    setShowForm(true);
  };

  const byDate: Record<string, Diary> = Object.fromEntries(diaries.map(d => [d.date, d]));
  // 백엔드가 날짜 기준 upsert라 같은 날짜에 저장하면 기존 기록을 덮어씀 → 미리 경고
  const conflict = byDate[form.date] && byDate[form.date].id !== editing?.id ? byDate[form.date] : null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/invest/diary', form);
      // 수정 중 날짜를 바꾸면 새 날짜로 upsert되고 옛 날짜 기록이 남으므로 지워줌
      if (editing && editing.date !== form.date) {
        await api.delete(`/invest/diary/${editing.id}`);
      }
      setShowForm(false);
      show(editing ? '일기를 수정했어요' : '일기를 저장했어요');
      fetchDiaries();
    } catch { show('저장에 실패했어요', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('이 일기를 삭제할까요?')) return;
    try {
      await api.delete(`/invest/diary/${id}`);
      show('삭제했어요');
      fetchDiaries();
    } catch { show('삭제에 실패했어요', 'error'); }
  };

  const onDayClick = (ymd: string) => {
    const d = byDate[ymd];
    if (!d) { openNew(ymd); return; }
    setExpandedIds(prev => new Set(prev).add(d.id));
    setHighlightId(d.id);
    cardRefs.current[d.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setHighlightId(null), 1500);
  };

  // 달력 셀: 앞쪽 빈칸 + 1일~말일
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`),
  ];

  const emotionCounts = EMOTION_OPTIONS.map(o => ({ ...o, count: diaries.filter(d => d.myEmotion === o.value).length }));
  const topEmotion = [...emotionCounts].sort((a, b) => b.count - a.count)[0];

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">시장보다 내 마음을 먼저 기록하기</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-dark-text">투자일기</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className={`inline-flex items-center rounded-full ${CARD}`}>
            <button onClick={() => moveMonth(-1)} aria-label="이전 달" className="w-11 h-11 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-lg">‹</button>
            <span className="text-sm font-semibold text-slate-700 dark:text-dark-text min-w-[88px] text-center tabular-nums">{year}년 {month}월</span>
            <button onClick={() => moveMonth(1)} aria-label="다음 달" className="w-11 h-11 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-lg">›</button>
          </div>
          <button onClick={() => openNew()} className="h-11 px-4 bg-primary-600 text-white rounded-full text-sm font-medium hover:bg-primary-700 transition-colors">
            + 오늘 기록
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] items-start">
        {/* ── 왼쪽: 감정 달력 + 이번 달 통계 ── */}
        <div className="space-y-3 lg:sticky lg:top-0">
          <div className={`${CARD} p-4`}>
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map((w, i) => (
                <span key={w} className={`text-center text-[11px] font-medium py-1 ${i === 0 ? 'text-rose-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'}`}>{w}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {cells.map((ymd, i) => {
                if (!ymd) return <span key={`e${i}`} />;
                const d = byDate[ymd];
                const isToday = ymd === todayStr;
                const isFuture = ymd > todayStr;
                return (
                  <button key={ymd} type="button" disabled={isFuture} onClick={() => onDayClick(ymd)}
                    aria-label={`${ymd}${d ? ' 기록 있음' : ''}`}
                    className={`h-11 flex flex-col items-center justify-center rounded-xl transition-colors disabled:opacity-30 disabled:cursor-default ${
                      d ? 'hover:bg-slate-100 dark:hover:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    } ${isToday ? 'ring-2 ring-primary-500 ring-inset' : ''}`}>
                    {d ? (
                      <span className="text-lg leading-none">{EMOTION_BY[d.myEmotion]?.icon ?? '📝'}</span>
                    ) : (
                      <span className={`text-xs tabular-nums ${isToday ? 'font-bold text-primary-600' : 'text-slate-500 dark:text-slate-400'}`}>{Number(ymd.slice(8))}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`${CARD} p-4 space-y-3`}>
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold text-slate-700 dark:text-dark-text">이번 달 마음 날씨</p>
              <p className="text-xs text-slate-400 tabular-nums">{diaries.length}일 기록</p>
            </div>
            {diaries.length === 0 ? (
              <p className="text-xs text-slate-400">기록이 쌓이면 감정 분포가 보여요</p>
            ) : (
              <>
                <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700">
                  {emotionCounts.filter(e => e.count > 0).map(e => (
                    <div key={e.value} className={e.bar} style={{ width: `${(e.count / diaries.length) * 100}%` }} />
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-1 text-center">
                  {emotionCounts.map(e => (
                    <div key={e.value}>
                      <p className="text-base leading-none">{e.icon}</p>
                      <p className="text-[11px] text-slate-400 mt-1">{e.label} <span className="font-semibold text-slate-600 dark:text-slate-300 tabular-nums">{e.count}</span></p>
                    </div>
                  ))}
                </div>
                {topEmotion.count > 0 && (topEmotion.value === 'ANXIOUS' || topEmotion.value === 'FEARFUL') && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/15 rounded-xl px-3 py-2">
                    이번 달은 {topEmotion.label}한 날이 가장 많았어요. 감정에 따라 매매하지 않았는지 돌아보세요.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── 오른쪽: 타임라인 ── */}
        <div className="space-y-3 min-w-0">
          {loading ? (
            [0, 1].map(i => <div key={i} className={`${CARD} h-28 animate-pulse`} />)
          ) : diaries.length === 0 ? (
            <div className={`${CARD} p-12 text-center`}>
              <p className="text-4xl mb-3">📖</p>
              <p className="text-slate-700 dark:text-slate-200 font-semibold">{month}월 기록이 아직 없어요</p>
              <p className="text-sm text-slate-400 mt-1">달력에서 날짜를 눌러 그날의 시장과 마음을 남겨보세요</p>
            </div>
          ) : diaries.map(d => {
            const { day, weekday } = dayLabel(d.date);
            const mood = MOOD_BY[d.marketMood];
            const emo = EMOTION_BY[d.myEmotion];
            const expanded = expandedIds.has(d.id);
            const long = !!d.body && (d.body.split('\n').length > 3 || d.body.length > 150);
            return (
              <article key={d.id} ref={el => { cardRefs.current[d.id] = el; }}
                className={`${CARD} p-4 sm:p-5 flex gap-4 transition-shadow ${highlightId === d.id ? 'ring-2 ring-primary-400' : ''}`}>
                <div className="w-11 shrink-0 text-center">
                  <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-dark-text leading-none">{day}</p>
                  <p className="text-xs text-slate-400 mt-1">{weekday}</p>
                  {emo && <p className="text-xl mt-2" title={emo.label}>{emo.icon}</p>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0 pt-0.5">
                      {mood && <span className={`text-xs font-medium px-3 py-1 rounded-full ${mood.chip}`}>{mood.icon} 시장 {mood.label}</span>}
                      {emo && <span className="text-xs font-medium px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">나 {emo.label}</span>}
                    </div>
                    <div className="flex shrink-0 -mr-2 -mt-2">
                      <button onClick={() => openEdit(d)} className="min-h-[44px] px-2 text-xs text-slate-400 hover:text-primary-500 transition-colors">수정</button>
                      <button onClick={() => handleDelete(d.id)} className="min-h-[44px] px-2 text-xs text-slate-400 hover:text-rose-500 transition-colors">삭제</button>
                    </div>
                  </div>
                  {d.title && <h3 className="text-base font-semibold text-slate-900 dark:text-dark-text mt-1 break-words">{d.title}</h3>}
                  {d.body && (
                    <p className={`text-sm text-slate-500 dark:text-slate-400 whitespace-pre-wrap break-words mt-1 leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>{d.body}</p>
                  )}
                  {long && (
                    <button onClick={() => toggleExpand(d.id)} className="min-h-[36px] text-xs text-primary-500 hover:text-primary-600 font-medium">
                      {expanded ? '접기' : '더 보기'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* ── 작성 바텀시트 ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-dark-card w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-slate-900 dark:text-dark-text">{editing ? '일기 수정' : '오늘의 투자일기'}</h3>
              <button onClick={() => setShowForm(false)} aria-label="닫기" className="w-11 h-11 -mr-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xl">×</button>
            </div>
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-dark-muted mb-1.5">날짜</label>
                <input type="date" value={form.date} max={todayStr}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-dark-bg dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
                {conflict && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">이 날짜에 이미 기록이 있어요. 저장하면 기존 기록{conflict.title ? ` "${conflict.title}"` : ''}을 덮어써요.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-dark-muted mb-1.5">지금 내 마음은</label>
                <div className="grid grid-cols-4 gap-2">
                  {EMOTION_OPTIONS.map(o => (
                    <button key={o.value} type="button" onClick={() => setForm(p => ({ ...p, myEmotion: o.value }))}
                      className={`flex flex-col items-center justify-center gap-1 py-3 rounded-2xl transition-all ${
                        form.myEmotion === o.value ? `ring-2 ${o.ring}` : 'bg-slate-50 dark:bg-dark-bg opacity-60 hover:opacity-100'
                      }`}>
                      <span className="text-2xl leading-none">{o.icon}</span>
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{o.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-dark-muted mb-1.5">오늘 시장은</label>
                <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                  {MOOD_OPTIONS.map(o => (
                    <button key={o.value} type="button" onClick={() => setForm(p => ({ ...p, marketMood: o.value }))}
                      className={`flex-1 h-10 rounded-lg text-sm font-medium transition-all ${
                        form.marketMood === o.value ? 'bg-white dark:bg-dark-card text-slate-900 dark:text-dark-text shadow-sm' : 'text-slate-500 dark:text-slate-400'
                      }`}>
                      {o.icon} {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-dark-muted mb-1.5">한 줄 요약 <span className="text-slate-400">(선택)</span></label>
                <input type="text" value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="예) 금리 발표 앞두고 관망"
                  className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-dark-bg dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-dark-muted mb-1.5">메모</label>
                <textarea value={form.body}
                  onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                  rows={6}
                  placeholder={'무슨 뉴스를 봤고, 어떤 생각이 들었나요?\n사고 싶거나 팔고 싶었다면 그 이유는?'}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-dark-bg dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-sm resize-none leading-relaxed"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 font-medium text-slate-700 dark:text-dark-text hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  취소
                </button>
                <button type="submit" disabled={saving}
                  className="flex-[1.4] h-12 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 transition-colors">
                  {saving ? '저장 중...' : conflict ? '덮어쓰고 저장' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
};
