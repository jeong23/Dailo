import React, { useState, useEffect } from 'react';
import api from '../api/axios';

interface Diary {
  id: number; date: string; marketMood: string; myEmotion: string;
  title: string; body: string;
}

const MOOD_OPTIONS = [
  { value: 'BULLISH', label: '강세 📈', color: 'bg-blue-50 border-blue-400 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' },
  { value: 'NEUTRAL', label: '중립 ➡️', color: 'bg-slate-50 border-slate-400 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  { value: 'BEARISH', label: '약세 📉', color: 'bg-rose-50 border-rose-400 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400' },
];
const EMOTION_OPTIONS = [
  { value: 'CONFIDENT', label: '확신 💪', color: 'bg-emerald-50 border-emerald-400 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' },
  { value: 'CALM', label: '평온 😌', color: 'bg-blue-50 border-blue-400 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' },
  { value: 'ANXIOUS', label: '불안 😟', color: 'bg-amber-50 border-amber-400 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
  { value: 'FEARFUL', label: '공포 😨', color: 'bg-rose-50 border-rose-400 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400' },
];

const MOOD_DOT: Record<string, string> = { BULLISH: 'bg-blue-400', NEUTRAL: 'bg-slate-400', BEARISH: 'bg-rose-400' };
const EMOTION_ICON: Record<string, string> = { CONFIDENT: '💪', CALM: '😌', ANXIOUS: '😟', FEARFUL: '😨' };

const now = new Date();
const todayStr = now.toISOString().split('T')[0];

export const InvestDiaryPage = () => {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const [form, setForm] = useState({
    date: todayStr, marketMood: 'NEUTRAL', myEmotion: 'CALM', title: '', body: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchDiaries = async () => {
    try {
      const r = await api.get(`/invest/diary?year=${year}&month=${month}`);
      setDiaries(r.data.data || []);
    } catch { setDiaries([]); }
  };

  useEffect(() => { fetchDiaries(); }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const moveMonth = (d: number) => {
    let m = month + d, y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setYear(y); setMonth(m);
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ date: todayStr, marketMood: 'NEUTRAL', myEmotion: 'CALM', title: '', body: '' });
    setShowForm(true);
  };

  const openEdit = (d: Diary) => {
    setEditingId(d.id);
    setForm({ date: d.date, marketMood: d.marketMood || 'NEUTRAL', myEmotion: d.myEmotion || 'CALM', title: d.title || '', body: d.body || '' });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/invest/diary', form);
      setShowForm(false);
      fetchDiaries();
    } catch { alert('저장 실패'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    await api.delete(`/invest/diary/${id}`);
    fetchDiaries();
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">워런 버핏 · 피터 린치 원칙</p>
          <h1 className="text-2xl font-bold dark:text-dark-text">투자일기</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => moveMonth(-1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 text-lg">‹</button>
          <span className="text-sm font-semibold dark:text-dark-text min-w-[90px] text-center">{year}년 {month}월</span>
          <button onClick={() => moveMonth(1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 text-lg">›</button>
          <button onClick={openNew} className="ml-2 px-4 py-2 bg-primary-600 text-white rounded-full text-sm font-medium hover:bg-primary-700 transition-colors">
            + 작성
          </button>
        </div>
      </div>

      {/* 일기 목록 */}
      {diaries.length === 0 ? (
        <div className="bg-white dark:bg-dark-card rounded-2xl p-12 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none">
          <p className="text-4xl mb-3">📖</p>
          <p className="text-slate-600 dark:text-slate-300 font-semibold">이번 달 일기가 없습니다</p>
          <p className="text-sm text-slate-400 mt-1">오늘의 시장 분위기와 심리 상태를 기록해보세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {diaries.map(d => (
            <div key={d.id} className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{d.date}</span>
                  {d.marketMood && (
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${MOOD_DOT[d.marketMood]}`} title={d.marketMood} />
                  )}
                  {d.myEmotion && (
                    <span className="text-base leading-none">{EMOTION_ICON[d.myEmotion]}</span>
                  )}
                  {d.title && (
                    <span className="text-sm font-semibold dark:text-dark-text">{d.title}</span>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(d)} className="text-xs text-slate-400 hover:text-primary-500 transition-colors">수정</button>
                  <button onClick={() => handleDelete(d.id)} className="text-xs text-slate-400 hover:text-rose-500 transition-colors">삭제</button>
                </div>
              </div>
              {d.body && (
                <div className="mt-2">
                  <p className={`text-sm text-slate-500 dark:text-slate-400 whitespace-pre-wrap ${expandedIds.has(d.id) ? '' : 'line-clamp-3'}`}>
                    {d.body}
                  </p>
                  {d.body.split('\n').length > 3 || d.body.length > 150 ? (
                    <button
                      onClick={() => toggleExpand(d.id)}
                      className="text-xs text-primary-500 hover:text-primary-600 mt-1 font-medium transition-colors"
                    >
                      {expandedIds.has(d.id) ? '접기 ▲' : '더 보기 ▼'}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 작성 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-card w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold dark:text-dark-text">투자일기 {editingId ? '수정' : '작성'}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-dark-muted mb-1">날짜</label>
                <input type="date" value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-dark-muted mb-2">시장 분위기</label>
                <div className="flex gap-2">
                  {MOOD_OPTIONS.map(o => (
                    <button key={o.value} type="button"
                      onClick={() => setForm(p => ({ ...p, marketMood: o.value }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                        form.marketMood === o.value ? o.color : 'border-slate-200 dark:border-dark-border text-slate-400'
                      }`}
                    >{o.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-dark-muted mb-2">내 심리 상태</label>
                <div className="flex gap-2 flex-wrap">
                  {EMOTION_OPTIONS.map(o => (
                    <button key={o.value} type="button"
                      onClick={() => setForm(p => ({ ...p, myEmotion: o.value }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-all min-w-[70px] ${
                        form.myEmotion === o.value ? o.color : 'border-slate-200 dark:border-dark-border text-slate-400'
                      }`}
                    >{o.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-dark-muted mb-1">제목 (선택)</label>
                <input type="text" value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="오늘의 한 줄 요약"
                  className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-dark-muted mb-1">메모</label>
                <textarea value={form.body}
                  onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                  rows={6}
                  placeholder="오늘 든 생각, 뉴스 반응, 투자 근거 등을 자유롭게 기록하세요..."
                  className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-sm resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-3 border border-slate-200 dark:border-dark-border rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors dark:text-dark-text">
                  취소
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 transition-colors">
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};