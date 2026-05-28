import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DailyPlan, TodoItem, TimeBoxSlot } from '../types';
import api from '../api/axios';

const HOURS = Array.from({ length: 19 }, (_, i) => i + 5);

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// 슬롯을 선형 인덱스로 변환 (5:00 = 0, 5:30 = 1, 6:00 = 2 ...)
const slotToIndex = (hour: number, slot: number) => (hour - 5) * 2 + slot;

interface TimeBoxBlock {
  id?: number;
  planDate: string;
  startHour: number; startSlot: number;
  endHour: number;   endSlot: number;
  content: string;
  isDone: boolean;
}

// 신호등 색상: 내용 없음 → 기본 / 미완료 → 빨강 / 완료 → 초록
const itemRowStyle = (content: string, isDone: boolean) => {
  if (!content?.trim()) return 'bg-transparent';
  if (isDone) return 'bg-green-50 dark:bg-green-900/20';
  return 'bg-red-50 dark:bg-red-900/20';
};

const itemTextStyle = (content: string, isDone: boolean) => {
  if (!content?.trim()) return 'text-slate-700 dark:text-dark-text';
  if (isDone) return 'text-green-700 dark:text-green-400 line-through';
  return 'text-red-700 dark:text-red-400';
};

const slotStyle = (value: string, done: boolean) => {
  if (!value?.trim()) return '';
  if (done) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
  return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
};

const today = () => new Date().toISOString().split('T')[0];

export const TodoPage = () => {
  const [searchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(searchParams.get('date') || today());

  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (dateParam && dateParam !== selectedDate) setSelectedDate(dateParam);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [plan, setPlan] = useState<DailyPlan>({ planDate: selectedDate });
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [timeSlots, setTimeSlots] = useState<Record<number, TimeBoxSlot>>({});
  const [blocks, setBlocks] = useState<TimeBoxBlock[]>([]);
  const [blockSelectStart, setBlockSelectStart] = useState<{ hour: number; slot: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | ''>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const planTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const todoTimer = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const timeboxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPlan({ planDate: selectedDate });
    setTodoItems([]);
    setTimeSlots({});
    fetchAll(selectedDate);
  }, [selectedDate]);

  const fetchAll = async (date: string) => {
    const [planRes, itemsRes, slotsRes, blocksRes] = await Promise.allSettled([
      api.get(`/daily-plans/${date}`),
      api.get(`/todo-items?date=${date}`),
      api.get(`/time-box?date=${date}`),
      api.get(`/time-box-blocks?date=${date}`),
    ]);
    if (planRes.status === 'fulfilled' && planRes.value.data.data) setPlan(planRes.value.data.data);
    if (itemsRes.status === 'fulfilled') setTodoItems(itemsRes.value.data.data || []);
    if (slotsRes.status === 'fulfilled') {
      const map: Record<number, TimeBoxSlot> = {};
      (slotsRes.value.data.data || []).forEach((s: TimeBoxSlot) => { map[s.hour] = s; });
      setTimeSlots(map);
    }
    if (blocksRes.status === 'fulfilled') setBlocks(blocksRes.value.data.data || []);
  };

  const createBlock = async (start: { hour: number; slot: number }, end: { hour: number; slot: number }) => {
    const startIdx = slotToIndex(start.hour, start.slot);
    const endIdx = slotToIndex(end.hour, end.slot);
    const actualStart = startIdx <= endIdx ? start : end;
    const actualEnd = startIdx <= endIdx ? end : start;
    const res = await api.post('/time-box-blocks', {
      planDate: selectedDate,
      startHour: actualStart.hour, startSlot: actualStart.slot,
      endHour: actualEnd.hour,   endSlot: actualEnd.slot,
      content: '', isDone: false,
    }).catch(() => null);
    if (res) setBlocks(prev => [...prev, res.data.data]);
  };

  const updateBlock = (id: number, content: string, isDone: boolean) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content, isDone } : b));
    api.put(`/time-box-blocks/${id}`, { content, isDone }).catch(() => {});
  };

  const deleteBlock = async (id: number) => {
    await api.delete(`/time-box-blocks/${id}`).catch(() => {});
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const debouncedSavePlan = (updated: DailyPlan) => {
    setSaveStatus('saving');
    if (planTimer.current) clearTimeout(planTimer.current);
    planTimer.current = setTimeout(() => {
      api.post('/daily-plans', updated)
        .then(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus(''), 2000); })
        .catch(() => setSaveStatus(''));
    }, 800);
  };

  const updatePlan = (field: keyof DailyPlan, value: string) => {
    const updated = { ...plan, [field]: value, planDate: selectedDate };
    setPlan(updated);
    debouncedSavePlan(updated);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/daily-plans/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const updated = { ...plan, futureVisionUrl: res.data.data, planDate: selectedDate };
      setPlan(updated);
      await api.post('/daily-plans', updated);
    } catch { alert('이미지 업로드 실패'); }
    finally { setUploading(false); }
  };

  const [focusId, setFocusId] = useState<number | null>(null);

  const addTodoItem = async (type: 'BRAIN_DUMP' | 'BIG3') => {
    const items = todoItems.filter(i => i.type === type);
    if (type === 'BIG3' && items.length >= 3) return;
    if (type === 'BRAIN_DUMP' && items.length >= 30) return;
    const res = await api.post('/todo-items', {
      planDate: selectedDate, content: '', type, sortOrder: items.length,
    }).catch(() => null);
    if (res) {
      setTodoItems(prev => [...prev, res.data.data]);
      setFocusId(res.data.data.id);
    }
  };

  const updateTodoContent = (id: number, content: string, currentIsDone: boolean) => {
    setTodoItems(prev => prev.map(i => i.id === id ? { ...i, content } : i));
    if (todoTimer.current[id]) clearTimeout(todoTimer.current[id]);
    todoTimer.current[id] = setTimeout(() => {
      api.put(`/todo-items/${id}`, { content, isDone: currentIsDone }).catch(() => {});
    }, 800);
  };

  const toggleTodo = async (item: TodoItem) => {
    const updated = { ...item, isDone: !item.isDone };
    setTodoItems(prev => prev.map(i => i.id === item.id ? updated : i));
    await api.put(`/todo-items/${item.id}`, { content: item.content, isDone: updated.isDone }).catch(() => {});
  };

  const deleteTodo = async (id: number) => {
    await api.delete(`/todo-items/${id}`).catch(() => {});
    setTodoItems(prev => prev.filter(i => i.id !== id));
  };

  const toggleTimeSlotDone = (hour: number, field: 'slot1Done' | 'slot2Done') => {
    const current = timeSlots[hour];
    if (!current) return;
    const updated = { ...current, [field]: !current[field] };
    setTimeSlots(prev => ({ ...prev, [hour]: updated }));
    api.post('/time-box', updated).catch(() => {});
  };

  const updateTimeSlot = (hour: number, field: 'slot1' | 'slot2', value: string) => {
    setTimeSlots(prev => ({ ...prev, [hour]: { ...prev[hour], planDate: selectedDate, hour, [field]: value } }));
    if (timeboxTimer.current) clearTimeout(timeboxTimer.current);
    timeboxTimer.current = setTimeout(() => {
      setTimeSlots(prev => {
        const slot = { ...prev[hour], planDate: selectedDate, hour, [field]: value };
        api.post('/time-box', slot).catch(() => {});
        return prev;
      });
    }, 800);
  };

  const moveDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // ── TimeBox 블록 선택 핸들러 (클릭 & Shift+클릭, 30분 단위) ──
  const getCoveringBlock = (hour: number, slot: number) => {
    const idx = slotToIndex(hour, slot);
    return blocks.find(b =>
      idx >= slotToIndex(b.startHour, b.startSlot) && idx <= slotToIndex(b.endHour, b.endSlot)
    );
  };

  const isSlotSelected = (hour: number, slot: number) =>
    blockSelectStart?.hour === hour && blockSelectStart?.slot === slot;

  const handleSlotClick = async (hour: number, slot: number, e: React.MouseEvent) => {
    if (getCoveringBlock(hour, slot)) return;

    if (e.shiftKey && blockSelectStart !== null) {
      const startIdx = slotToIndex(blockSelectStart.hour, blockSelectStart.slot);
      const endIdx = slotToIndex(hour, slot);
      if (startIdx === endIdx) { setBlockSelectStart(null); return; }
      const [s, en] = startIdx < endIdx
        ? [blockSelectStart, { hour, slot }]
        : [{ hour, slot }, blockSelectStart];
      await createBlock(s, en);
      setBlockSelectStart(null);
    } else if (isSlotSelected(hour, slot)) {
      setBlockSelectStart(null);
    } else {
      setBlockSelectStart({ hour, slot });
    }
  };

  // ── TodoItem 드래그앤드롭 ──────────────────────────
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<'BRAIN_DUMP' | 'BIG3' | null>(null);
  const [big3DragOverIdx, setBig3DragOverIdx] = useState<number | null>(null);

  const moveType = async (id: number, toType: 'BRAIN_DUMP' | 'BIG3') => {
    const item = todoItems.find(i => i.id === id);
    if (!item || item.type === toType) return;
    if (toType === 'BIG3' && big3.length >= 3) return;
    setTodoItems(prev => prev.map(i => i.id === id ? { ...i, type: toType } : i));
    await api.put(`/todo-items/${id}`, { content: item.content, isDone: item.isDone, type: toType }).catch(() => {});
  };

  const reorderBig3 = async (fromId: number, toIdx: number) => {
    const currentBig3 = todoItems.filter(i => i.type === 'BIG3');
    const fromIdx = currentBig3.findIndex(i => i.id === fromId);
    if (fromIdx === -1 || fromIdx === toIdx) return;
    const reordered = [...currentBig3];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setTodoItems(prev => {
      const others = prev.filter(i => i.type !== 'BIG3');
      return [...others, ...reordered.map((item, idx) => ({ ...item, sortOrder: idx }))];
    });
    await Promise.all(
      reordered.map((item, idx) =>
        api.put(`/todo-items/${item.id}`, { content: item.content, isDone: item.isDone, sortOrder: idx }).catch(() => {})
      )
    );
  };

  const brainDump = todoItems.filter(i => i.type === 'BRAIN_DUMP');
  const big3 = todoItems.filter(i => i.type === 'BIG3');
  const dow = new Date(selectedDate).getDay();
  const d = new Date(selectedDate);
  const dateStr = `${d.getFullYear()} . ${d.getMonth() + 1} . ${d.getDate()}`;

  return (
    <div className="h-full flex flex-col gap-4">
      {/* ── 날짜 헤더 ── */}
      <div className="flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={() => moveDate(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 text-xl">‹</button>
          <button
            onClick={() => document.getElementById('date-picker')?.click()}
            className="text-xl font-bold dark:text-dark-text px-2 hover:text-primary-600 transition-colors"
          >
            {dateStr}
          </button>
          <input id="date-picker" type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="sr-only" />
          <button onClick={() => moveDate(1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 text-xl">›</button>
        </div>
        <div className="flex items-center gap-4">
          {saveStatus === 'saving' && <span className="text-xs text-slate-400">저장 중...</span>}
          {saveStatus === 'saved' && <span className="text-xs text-primary-500">저장됨 ✓</span>}
          {DAYS.map((day, i) => (
            <span key={day} className={`text-sm font-medium ${i === dow ? 'text-primary-600 dark:text-primary-400 font-bold' : 'text-slate-300 dark:text-slate-600'}`}>
              {day}
            </span>
          ))}
        </div>
      </div>

      {/* ── 다이어리 본문 ── */}
      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-200 dark:border-dark-border">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_200px] min-w-[800px] min-h-full bg-white dark:bg-dark-card rounded-xl">

        {/* ── 왼쪽 ── */}
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-dark-border border-r border-slate-200 dark:border-dark-border">

          {/* 미래 시각화 */}
          <div className="p-6">
            <SectionTitle color="teal">미래 시각화</SectionTitle>
            <div
              className="mt-3 w-full h-56 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex flex-col items-center justify-center cursor-pointer overflow-hidden hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors bg-slate-50 dark:bg-slate-800/30"
              onClick={() => fileInputRef.current?.click()}
            >
              {plan.futureVisionUrl ? (
                <img src={plan.futureVisionUrl} alt="미래 시각화" className="w-full h-full object-contain" />
              ) : (
                <>
                  <svg className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-slate-400 dark:text-slate-500 text-sm font-medium">
                    {uploading ? '업로드 중...' : '클릭하여 이미지 업로드'}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600 text-xs mt-1">JPG, PNG, GIF 등</span>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </div>

          {/* 정체성 */}
          <div className="p-6">
            <SectionTitle color="red">정체성</SectionTitle>
            <div className="mt-3 space-y-3">
              {(['identity1', 'identity2', 'identity3'] as (keyof DailyPlan)[]).map((f, i) => (
                <input key={i} type="text" value={(plan[f] as string) || ''} onChange={e => updatePlan(f, e.target.value)}
                  placeholder="나는 ..."
                  className="w-full bg-transparent text-base dark:text-dark-text placeholder-slate-300 dark:placeholder-slate-700 focus:outline-none border-b-2 border-slate-200 dark:border-slate-700 focus:border-primary-400 pb-1 transition-colors" />
              ))}
            </div>
          </div>

          {/* 내적동기 */}
          <div className="p-6">
            <SectionTitle color="red">내적동기</SectionTitle>
            <div className="mt-3 space-y-3">
              {(['motivation1', 'motivation2', 'motivation3'] as (keyof DailyPlan)[]).map((f, i) => (
                <input key={i} type="text" value={(plan[f] as string) || ''} onChange={e => updatePlan(f, e.target.value)}
                  placeholder="..."
                  className="w-full bg-transparent text-base dark:text-dark-text placeholder-slate-300 dark:placeholder-slate-700 focus:outline-none border-b-2 border-slate-200 dark:border-slate-700 focus:border-primary-400 pb-1 transition-colors" />
              ))}
            </div>
          </div>

          {/* 감사일기 */}
          <div className="p-6">
            <SectionTitle color="red">감사일기</SectionTitle>
            <div className="mt-3 space-y-3">
              {(['gratitude1', 'gratitude2', 'gratitude3'] as (keyof DailyPlan)[]).map((f, i) => (
                <input key={i} type="text" value={(plan[f] as string) || ''} onChange={e => updatePlan(f, e.target.value)}
                  placeholder="감사한 것..."
                  className="w-full bg-transparent text-base dark:text-dark-text placeholder-slate-300 dark:placeholder-slate-700 focus:outline-none border-b-2 border-slate-200 dark:border-slate-700 focus:border-primary-400 pb-1 transition-colors" />
              ))}
            </div>
          </div>
        </div>

        {/* ── 가운데 ── */}
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-dark-border border-r border-slate-200 dark:border-dark-border">

          {/* 기상 직후 할 일 */}
          <div className="p-6">
            <SectionTitle color="teal">기상 직후 할 일</SectionTitle>
            <textarea
              value={plan.firstTask || ''} onChange={e => updatePlan('firstTask', e.target.value)}
              placeholder="일어나자마자 바로 할 일..." rows={3}
              className="mt-3 w-full bg-transparent text-base dark:text-dark-text placeholder-slate-300 dark:placeholder-slate-700 focus:outline-none resize-none border border-slate-200 dark:border-slate-700 rounded-lg p-3 focus:border-primary-400 transition-colors"
            />
          </div>

          {/* Brain Dump */}
          <div
            className={`p-6 flex-1 flex flex-col transition-colors ${dragOver === 'BRAIN_DUMP' ? 'bg-primary-50 dark:bg-primary-900/10' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver('BRAIN_DUMP'); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={e => { e.preventDefault(); if (dragId) moveType(dragId, 'BRAIN_DUMP'); setDragOver(null); setDragId(null); }}
          >
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <span className="text-base font-bold dark:text-dark-text">Brain Dump</span>
              <span className="text-xs text-slate-400">{brainDump.length}/30</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
              {brainDump.map(item => (
                <div key={item.id}
                  draggable
                  onDragStart={() => setDragId(item.id!)}
                  onDragEnd={() => { setDragId(null); setDragOver(null); }}
                  className={`flex items-center gap-3 group rounded-lg px-2 py-1 transition-colors cursor-grab active:cursor-grabbing ${itemRowStyle(item.content, item.isDone)}`}>
                  <span className="text-slate-300 dark:text-slate-600 text-xs select-none">⠿</span>
                  <button onClick={() => toggleTodo(item)} onMouseDown={e => e.stopPropagation()}
                    className={`w-5 h-5 flex-shrink-0 rounded-md flex items-center justify-center transition-colors ${item.isDone ? 'bg-green-500' : 'bg-red-400'}`}>
                    {item.isDone && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <input type="text" value={item.content} onChange={e => updateTodoContent(item.id!, e.target.value, item.isDone)}
                    placeholder="할 일..."
                    autoFocus={item.id === focusId}
                    onFocus={() => setFocusId(null)}
                    onMouseDown={e => e.stopPropagation()}
                    className={`flex-1 bg-transparent text-base focus:outline-none py-0.5 placeholder-slate-300 dark:placeholder-slate-700 transition-colors ${itemTextStyle(item.content, item.isDone)}`} />
                  <button onClick={() => deleteTodo(item.id!)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all text-sm">✕</button>
                </div>
              ))}
              {brainDump.length < 30 && (
                <button onClick={() => addTodoItem('BRAIN_DUMP')}
                  className="w-full py-2 text-slate-300 dark:text-slate-600 text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg hover:border-primary-300 transition-colors">
                  + 할 일 추가
                </button>
              )}
            </div>
          </div>

          {/* Big 3 */}
          <div
            className={`p-6 transition-colors ${dragOver === 'BIG3' ? 'bg-primary-50 dark:bg-primary-900/10' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver('BIG3'); }}
            onDragLeave={e => {
              if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                setDragOver(null);
                setBig3DragOverIdx(null);
              }
            }}
            onDrop={e => {
              e.preventDefault();
              const fromItem = dragId ? todoItems.find(i => i.id === dragId) : null;
              if (fromItem?.type === 'BRAIN_DUMP') {
                moveType(dragId!, 'BIG3');
              }
              setDragOver(null);
              setBig3DragOverIdx(null);
              setDragId(null);
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-base font-bold dark:text-dark-text">Big 3</span>
              {big3.length < 3 && (
                <button onClick={() => addTodoItem('BIG3')} className="text-sm text-slate-400 hover:text-primary-500 transition-colors">+ 추가</button>
              )}
            </div>
            <div className="space-y-3">
              {big3.length === 0
                ? <button onClick={() => addTodoItem('BIG3')} className="w-full py-4 text-slate-300 dark:text-slate-600 text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg hover:border-primary-300 transition-colors">+ 핵심 과제 추가</button>
                : big3.map((item, i) => (
                  <div key={item.id}
                    draggable
                    onDragStart={e => { e.stopPropagation(); setDragId(item.id!); }}
                    onDragEnd={() => { setDragId(null); setDragOver(null); setBig3DragOverIdx(null); }}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); setBig3DragOverIdx(i); }}
                    onDrop={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      const fromItem = dragId ? todoItems.find(t => t.id === dragId) : null;
                      if (fromItem?.type === 'BIG3' && dragId) {
                        reorderBig3(dragId, i);
                      } else if (fromItem?.type === 'BRAIN_DUMP' && dragId) {
                        moveType(dragId, 'BIG3');
                      }
                      setDragOver(null);
                      setBig3DragOverIdx(null);
                      setDragId(null);
                    }}
                    className={`flex items-center gap-3 group rounded-lg px-2 py-1 transition-all cursor-grab active:cursor-grabbing border-2
                      ${big3DragOverIdx === i && dragId !== item.id
                        ? 'border-primary-400 border-dashed scale-[1.02]'
                        : 'border-transparent'
                      }
                      ${dragId === item.id ? 'opacity-40' : ''}
                      ${itemRowStyle(item.content, item.isDone)}`}>
                    <span className="text-slate-300 dark:text-slate-600 text-xs select-none">⠿</span>
                    <button onClick={() => toggleTodo(item)} onMouseDown={e => e.stopPropagation()}
                      className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center transition-all font-bold text-sm select-none border-2
                        ${item.isDone
                          ? 'bg-green-500 border-green-500 text-white'
                          : item.content?.trim()
                            ? 'bg-transparent border-red-400 text-red-400'
                            : 'bg-transparent border-slate-300 dark:border-slate-600 text-slate-300 dark:text-slate-600'
                        }`}>
                      {item.isDone
                        ? <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        : i + 1
                      }
                    </button>
                    <input type="text" value={item.content} onChange={e => updateTodoContent(item.id!, e.target.value, item.isDone)}
                      placeholder="오늘의 핵심 과제..."
                      onMouseDown={e => e.stopPropagation()}
                      className={`flex-1 bg-transparent text-base focus:outline-none py-0.5 placeholder-slate-300 dark:placeholder-slate-700 transition-colors ${itemTextStyle(item.content, item.isDone)}`} />
                    <button onClick={() => deleteTodo(item.id!)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all text-sm">✕</button>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Feedback */}
          <div className="p-6">
            <span className="text-base font-bold dark:text-dark-text block mb-3">Feedback</span>
            <div className="space-y-4">
              {([
                { field: 'feedbackStart', label: '시작' },
                { field: 'feedbackMid', label: '중간' },
                { field: 'feedbackEnd', label: '마무리' },
              ] as { field: keyof DailyPlan; label: string }[]).map(({ field, label }) => (
                <div key={field}>
                  <p className="text-sm text-slate-400 mb-1.5 font-medium">- {label}</p>
                  <textarea
                    value={(plan[field] as string) || ''} onChange={e => updatePlan(field, e.target.value)}
                    rows={2}
                    className="w-full bg-transparent text-base dark:text-dark-text placeholder-slate-300 focus:outline-none resize-none border-b-2 border-slate-200 dark:border-slate-700 focus:border-primary-400 transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 오른쪽: Time Box ── */}
        <div className="p-4 flex flex-col h-full">
          <span className="text-base font-bold dark:text-dark-text block mb-1">Time Box</span>
          <p className="text-xs text-slate-400 mb-3">클릭 → 시작 선택 · Shift+클릭 → 블록 생성</p>
          <div className="flex-1 overflow-auto select-none">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                  <th className="w-8" />
                  <th className="text-xs text-slate-400 font-normal pb-1 text-center border-l border-slate-200 dark:border-slate-700">30 mins</th>
                  <th className="text-xs text-slate-400 font-normal pb-1 text-center border-l border-slate-200 dark:border-slate-700">30 mins</th>
                </tr>
              </thead>
              <tbody>
                {HOURS.map(hour => {
                  const block = blocks.find(b => hour >= b.startHour && hour <= b.endHour);
                  const isBlockStart = block?.startHour === hour;
                  const rowSpan = block ? block.endHour - block.startHour + 1 : 1;
                  const isSelected = blockSelectStart?.hour === hour;

                  return (
                    <tr key={hour} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="text-xs text-slate-400 text-right pr-2 w-8 font-medium py-2 align-middle">{hour}</td>

                      {block && !isBlockStart ? null : block && isBlockStart ? (
                        <td colSpan={2} rowSpan={rowSpan}
                          className={`border-l-4 px-2 align-middle ${
                            block.isDone
                              ? 'border-green-400 bg-green-100 dark:bg-green-900/40'
                              : block.content?.trim()
                                ? 'border-red-400 bg-red-50 dark:bg-red-900/30'
                                : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/40'
                          }`}>
                          <div className="flex items-center gap-1.5 py-0.5">
                            <button onClick={() => updateBlock(block.id!, block.content, !block.isDone)}
                              className={`w-4 h-4 flex-shrink-0 rounded flex items-center justify-center ${block.isDone ? 'bg-green-500' : block.content?.trim() ? 'bg-red-400' : 'bg-slate-300'}`}>
                              {block.isDone && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                            <input type="text" value={block.content}
                              onChange={e => updateBlock(block.id!, e.target.value, block.isDone)}
                              onClick={e => e.stopPropagation()}
                              placeholder="내용 입력..."
                              className={`flex-1 bg-transparent focus:outline-none text-sm cursor-text placeholder-slate-300 ${
                                block.isDone ? 'text-green-700 dark:text-green-400 line-through' : 'text-slate-700 dark:text-dark-text'
                              }`} />
                            <button onClick={() => deleteBlock(block.id!)}
                              className="text-slate-300 hover:text-red-400 text-sm font-bold">✕</button>
                          </div>
                        </td>
                      ) : (
                        <>
                          {(['slot1', 'slot2'] as const).map((slotKey, i) => {
                            const doneKey = (i === 0 ? 'slot1Done' : 'slot2Done') as 'slot1Done' | 'slot2Done';
                            return (
                              <td key={slotKey}
                                className={`py-1.5 border-l border-slate-200 dark:border-slate-700 px-1.5 cursor-pointer transition-colors
                                  ${isSelected ? 'bg-blue-100 dark:bg-blue-900/20' : slotStyle(timeSlots[hour]?.[slotKey] || '', !!timeSlots[hour]?.[doneKey])}`}
                                onClick={e => {
                                  if (e.shiftKey || blockSelectStart !== null) {
                                    handleSlotClick(hour, i, e);
                                  } else {
                                    toggleTimeSlotDone(hour, doneKey);
                                  }
                                }}
                              >
                                <input type="text"
                                  value={timeSlots[hour]?.[slotKey] || ''}
                                  onChange={e => updateTimeSlot(hour, slotKey, e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  onMouseDown={e => e.stopPropagation()}
                                  className="w-full bg-transparent focus:outline-none text-xs px-0.5 cursor-text" />
                              </td>
                            );
                          })}
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

const SectionTitle = ({ children, color }: { children: React.ReactNode; color: 'red' | 'teal' }) => (
  <span className={`text-base font-bold pb-1 border-b-2 inline-block ${
    color === 'red'
      ? 'text-red-500 border-red-400'
      : 'text-teal-600 dark:text-teal-400 border-teal-500'
  }`}>
    {children}
  </span>
);
