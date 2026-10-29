import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DailyPlan, TodoItem, TimeBoxSlot } from '../types';
import api from '../api/axios';
import { VisionBoard } from '../components/VisionBoard';

// 5시 ~ 다음날 4시: 24~28은 자정 이후(00~04시)지만 같은 플랜 날짜에 hour=24..28로 저장 — 정렬·slotToIndex가 그대로 이어짐
const HOURS = Array.from({ length: 24 }, (_, i) => i + 5);
const TOTAL_SLOTS = HOURS.length * 2;
const hourLabel = (h: number) => String(h % 24 === 0 ? 24 : h % 24).padStart(2, '0');

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// 슬롯을 선형 인덱스로 변환 (5:00 = 0, 5:30 = 1, 6:00 = 2 ...)
// ⠿ 핸들: 터치에선 44px 타깃 + touch-action:none(드래그 중 페이지 스크롤 방지)
const DRAG_HANDLE = 'flex-shrink-0 -ml-2 w-8 h-11 sm:w-auto sm:h-auto sm:ml-0 flex items-center justify-center text-slate-400 dark:text-slate-500 sm:text-slate-300 sm:dark:text-slate-600 text-base sm:text-xs select-none touch-none cursor-grab';
// 삭제 버튼: 마우스 기기는 hover 때만, 터치 기기(hover 없음)는 항상 보이게
const DELETE_BTN = 'flex-shrink-0 w-8 h-8 -mr-1 flex items-center justify-center text-slate-300 hover:text-red-400 transition-all text-sm [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100';

const slotToIndex = (hour: number, slot: number) => (hour - 5) * 2 + slot;
const indexToSlot = (idx: number) => ({ hour: 5 + Math.floor(idx / 2), slot: idx % 2 });
const slotTime = (idx: number) => `${hourLabel(5 + Math.floor(idx / 2))}:${idx % 2 ? '30' : '00'}`;

// 30분 단위 블록을 2열(30mins | 30mins) 그리드 조각으로 나눔: 앞쪽 반 칸 / 꽉 찬 시간들 / 뒤쪽 반 칸
// row = HOURS 인덱스, col = 0(앞 30분) | 1(뒤 30분)
type BlockPiece = { row: number; rowSpan: number; col: number; colSpan: number };
const blockPieces = (s: number, e: number): BlockPiece[] => {
  const pieces: BlockPiece[] = [];
  let i = s;
  if (i % 2 === 1) { pieces.push({ row: (i - 1) / 2, rowSpan: 1, col: 1, colSpan: 1 }); i++; }
  const fullEnd = e % 2 === 1 ? e : e - 1;
  if (fullEnd > i) { pieces.push({ row: i / 2, rowSpan: (fullEnd - i + 1) / 2, col: 0, colSpan: 2 }); i = fullEnd + 1; }
  if (i <= e) pieces.push({ row: i / 2, rowSpan: 1, col: 0, colSpan: 1 });
  return pieces;
};

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
  // 블록 범위 선택: anchor = 시작 칸, end = 현재 끝 칸(미리보기) — 둘 다 slotToIndex 값
  const [sel, setSel] = useState<{ anchor: number; end: number } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selMsg, setSelMsg] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | ''>('');
  const planTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const todoTimer = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const timeboxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPlan({ planDate: selectedDate });
    setTodoItems([]);
    setTimeSlots({});
    setSel(null);
    setSelectMode(false);
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

  const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  // ── TimeBox 블록 선택 (30분 단위) ──
  // 데스크탑: Shift+클릭 → 시작, 다른 칸 클릭(또는 Shift+클릭) → 생성 (마우스 올린 범위 미리보기)
  // 블록 만들기 모드(폰·데스크탑 공통): 칸을 드래그하거나 시작·끝 칸을 차례로 탭 — 모드 중 칸은 touch-none, 시간 열로 스크롤
  const blockRanges = blocks.map(b => ({
    block: b, s: slotToIndex(b.startHour, b.startSlot), e: slotToIndex(b.endHour, b.endSlot),
  }));
  const coveredSlots = new Set<number>();
  blockRanges.forEach(({ s, e }) => { for (let i = s; i <= e; i++) coveredSlots.add(i); });

  const selLo = sel ? Math.min(sel.anchor, sel.end) : -1;
  const selHi = sel ? Math.max(sel.anchor, sel.end) : -1;
  const rangeOverlaps = (lo: number, hi: number) => blockRanges.some(r => r.s <= hi && r.e >= lo);
  const selBlocked = !!sel && rangeOverlaps(selLo, selHi);

  const finishSelection = async (a: number, b: number) => {
    const lo = Math.min(a, b), hi = Math.max(a, b);
    setSel(null);
    if (lo === hi) return;
    if (rangeOverlaps(lo, hi)) { setSelMsg('다른 블록과 겹쳐서 만들 수 없어요'); return; }
    setSelectMode(false);
    await createBlock(indexToSlot(lo), indexToSlot(hi));
  };

  const cancelSelection = () => { setSel(null); setSelectMode(false); setSelMsg(''); };

  useEffect(() => {
    if (!sel && !selectMode) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cancelSelection(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, selectMode]);

  // 모드에서 탭으로 블록을 만든 직후 따라오는 click이 '완료 토글'로 처리되지 않게
  const suppressClickUntil = useRef(0);

  const handleSlotClick = (idx: number, e: React.MouseEvent) => {
    if (selectMode || Date.now() < suppressClickUntil.current) return; // 모드에선 pointer 핸들러가 처리
    setSelMsg('');
    if (sel) {
      if (idx === sel.anchor) setSel(null);
      else finishSelection(sel.anchor, idx);
    } else if (e.shiftKey) {
      setSel({ anchor: idx, end: idx });
    } else {
      const { hour, slot } = indexToSlot(idx);
      toggleTimeSlotDone(hour, slot === 0 ? 'slot1Done' : 'slot2Done');
    }
  };

  // 블록 만들기 모드: 드래그 or 탭-탭
  const selDrag = useRef<{ anchor: number; end: number; x: number; y: number } | null>(null);
  const selScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopSelScroll = () => {
    if (selScrollTimer.current) clearInterval(selScrollTimer.current);
    selScrollTimer.current = null;
  };
  useEffect(() => stopSelScroll, []);

  const slotIdxAt = (x: number, y: number) => {
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('[data-slot-idx]') as HTMLElement | null;
    return el ? Number(el.dataset.slotIdx) : null;
  };
  const extendSel = (x: number, y: number) => {
    const d = selDrag.current;
    const idx = slotIdxAt(x, y);
    if (!d || idx === null || idx === d.end) return;
    d.end = idx;
    setSel({ anchor: d.anchor, end: idx });
  };

  const selPointerProps = (idx: number) => !selectMode ? {} : {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      e.preventDefault();
      setSelMsg('');
      if (sel) {
        // 두 번째 탭: 끝점 (같은 칸 다시 탭 → 취소)
        suppressClickUntil.current = Date.now() + 600;
        if (idx === sel.anchor) setSel(null);
        else finishSelection(sel.anchor, idx);
        return;
      }
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* 터치는 기본 캡처 — 풀어야 elementFromPoint로 옆 칸 판정 */ }
      selDrag.current = { anchor: idx, end: idx, x: e.clientX, y: e.clientY };
      setSel({ anchor: idx, end: idx });
      navigator.vibrate?.(10);
      const scroller = scrollParentOf(e.currentTarget);
      stopSelScroll();
      selScrollTimer.current = setInterval(() => {
        const d = selDrag.current;
        if (!d || !scroller) return;
        const r = scroller.getBoundingClientRect();
        if (d.y < r.top + 60) scroller.scrollTop -= 10;
        else if (d.y > r.bottom - 60) scroller.scrollTop += 10;
        else return;
        extendSel(d.x, d.y);
      }, 16);
    },
  };

  // 드래그 중 move/up은 window에서 받음 (손가락이 다른 칸으로 넘어가도 계속 추적)
  useEffect(() => {
    if (!selectMode) return;
    const onMove = (e: PointerEvent) => {
      const d = selDrag.current;
      if (!d) return;
      d.x = e.clientX; d.y = e.clientY;
      extendSel(e.clientX, e.clientY);
    };
    const onUp = () => {
      const d = selDrag.current;
      if (!d) return;
      selDrag.current = null;
      stopSelScroll();
      if (d.end !== d.anchor) finishSelection(d.anchor, d.end);
      // 같은 칸에서 뗐으면 anchor 유지 → 다음 탭이 끝점
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectMode, blocks, selectedDate]);

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

  // ── 터치 드래그 (폰·폴드) ─────────────────────────
  // HTML5 DnD(draggable)는 터치에서 동작하지 않음 → ⠿ 핸들에서 Pointer Events로 직접 구현
  // 핸들에 pointer capture를 걸고, 손가락 아래 요소를 elementFromPoint로 찾아 data-drop-zone / data-big3-idx로 판정
  const [ghost, setGhost] = useState<{ content: string; x: number; y: number } | null>(null);
  const touchDrag = useRef<{ id: number; zone: 'BRAIN_DUMP' | 'BIG3' | null; idx: number | null; y: number } | null>(null);
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAutoScroll = () => {
    if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
    autoScrollTimer.current = null;
  };
  useEffect(() => stopAutoScroll, []);

  // 화면 위·아래 가장자리에 손가락을 대고 있으면 스크롤 영역을 계속 굴림 (Brain Dump ↔ Big3가 한 화면에 안 들어올 때)
  const scrollParentOf = (el: HTMLElement | null): HTMLElement | null => {
    for (let n = el?.parentElement; n; n = n.parentElement) {
      const oy = getComputedStyle(n).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n;
    }
    return null;
  };

  const touchHandleProps = (item: TodoItem) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse' || !item.id) return; // 마우스는 기존 draggable 사용
      e.preventDefault();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 캡처 실패해도 move/up은 핸들에서 계속 받음 */ }
      touchDrag.current = { id: item.id, zone: null, idx: null, y: e.clientY };
      setDragId(item.id);
      setGhost({ content: item.content || (item.type === 'BIG3' ? '핵심 과제' : '할 일'), x: e.clientX, y: e.clientY });
      navigator.vibrate?.(15);
      const scroller = scrollParentOf(e.currentTarget);
      stopAutoScroll();
      autoScrollTimer.current = setInterval(() => {
        const t = touchDrag.current;
        if (!t || !scroller) return;
        const r = scroller.getBoundingClientRect();
        if (t.y < r.top + 60) scroller.scrollTop -= 10;
        else if (t.y > r.bottom - 60) scroller.scrollTop += 10;
      }, 16);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const t = touchDrag.current;
      if (!t) return;
      t.y = e.clientY;
      setGhost(g => g && { ...g, x: e.clientX, y: e.clientY });
      const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const zone = (under?.closest('[data-drop-zone]') as HTMLElement | null)?.dataset.dropZone as 'BRAIN_DUMP' | 'BIG3' | undefined;
      const idxAttr = (under?.closest('[data-big3-idx]') as HTMLElement | null)?.dataset.big3Idx;
      t.zone = zone ?? null;
      t.idx = zone === 'BIG3' && idxAttr !== undefined ? Number(idxAttr) : null;
      setDragOver(t.zone);
      setBig3DragOverIdx(t.idx);
    },
    onPointerUp: () => {
      const t = touchDrag.current;
      if (t) {
        const from = todoItems.find(i => i.id === t.id);
        if (t.zone === 'BRAIN_DUMP') moveType(t.id, 'BRAIN_DUMP');
        else if (t.zone === 'BIG3') {
          if (from?.type === 'BIG3' && t.idx !== null) reorderBig3(t.id, t.idx);
          else if (from?.type === 'BRAIN_DUMP') moveType(t.id, 'BIG3');
        }
      }
      endTouchDrag();
    },
    onPointerCancel: () => endTouchDrag(),
  });

  const endTouchDrag = () => {
    touchDrag.current = null;
    stopAutoScroll();
    setGhost(null);
    setDragId(null);
    setDragOver(null);
    setBig3DragOverIdx(null);
  };

  // Big3가 꽉 찬 상태에서 Brain Dump 항목을 끌고 오면 빨간색으로 '못 놓음' 표시
  const big3Blocked = dragOver === 'BIG3' && big3.length >= 3 && todoItems.find(i => i.id === dragId)?.type === 'BRAIN_DUMP';
  const dow = new Date(selectedDate).getDay();
  const d = new Date(selectedDate);
  const dateStr = `${d.getFullYear()} . ${d.getMonth() + 1} . ${d.getDate()}`;

  return (
    <div className="md:h-full flex flex-col gap-3 md:gap-4">
      {/* 터치 드래그 중 손가락을 따라다니는 미리보기 */}
      {ghost && (
        <div className="fixed z-[70] pointer-events-none -translate-x-1/2 -translate-y-[130%] max-w-[70vw] truncate px-3 py-2 rounded-xl bg-white dark:bg-slate-700 shadow-2xl ring-2 ring-primary-400 text-sm font-medium text-slate-800 dark:text-dark-text"
          style={{ left: ghost.x, top: ghost.y }}>
          {ghost.content}
        </div>
      )}
      {/* ── 날짜 헤더 ── */}
      <div className="flex-shrink-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <button onClick={() => moveDate(-1)} aria-label="이전 날" className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 text-xl">‹</button>
          <button
            onClick={() => document.getElementById('date-picker')?.click()}
            className="text-lg sm:text-xl font-bold whitespace-nowrap tabular-nums dark:text-dark-text px-1 sm:px-2 hover:text-primary-600 transition-colors"
          >
            {dateStr}
          </button>
          <input id="date-picker" type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="sr-only" />
          <button onClick={() => moveDate(1)} aria-label="다음 날" className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 text-xl">›</button>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {saveStatus === 'saving' && <span className="text-xs text-slate-400 whitespace-nowrap">저장 중...</span>}
          {saveStatus === 'saved' && <span className="text-xs text-primary-500 whitespace-nowrap">저장됨 ✓</span>}
          {/* 좁은 화면(폴드 커버)에선 오늘 요일만 */}
          <span className="sm:hidden text-sm font-bold text-primary-600 dark:text-primary-400">{DAYS[dow]}</span>
          {DAYS.map((day, i) => (
            <span key={day} className={`hidden sm:inline text-sm font-medium ${i === dow ? 'text-primary-600 dark:text-primary-400 font-bold' : 'text-slate-300 dark:text-slate-600'}`}>
              {day}
            </span>
          ))}
        </div>
      </div>

      {/* ── 다이어리 본문 ── */}
      {/* 모바일: 페이지(main)가 스크롤 / md 이상: 본문 박스 안에서 스크롤 — min-w 고정폭 제거(폴드 커버에서 가로 스크롤 생김) */}
      <div className="md:flex-1 md:min-h-0 md:overflow-auto rounded-xl border border-slate-200 dark:border-dark-border">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_1fr_320px] 2xl:grid-cols-[1fr_1fr_380px] min-h-full bg-white dark:bg-dark-card rounded-xl">

        {/* ── 왼쪽 ── */}
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-dark-border border-b md:border-b-0 md:border-r border-slate-200 dark:border-dark-border">

          {/* 미래 시각화 — 회원별 보드 하나(날짜 무관), 사진 여러 장 자유 배치 */}
          <div className="p-4 sm:p-6">
            <VisionBoard title={<SectionTitle color="teal">미래 시각화</SectionTitle>} legacyUrl={plan.futureVisionUrl} />
          </div>

          {/* 정체성 */}
          <div className="p-4 sm:p-6">
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
          <div className="p-4 sm:p-6">
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
          <div className="p-4 sm:p-6">
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
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-dark-border border-b xl:border-b-0 xl:border-r border-slate-200 dark:border-dark-border">

          {/* 기상 직후 할 일 */}
          <div className="p-4 sm:p-6">
            <SectionTitle color="teal">기상 직후 할 일</SectionTitle>
            <textarea
              value={plan.firstTask || ''} onChange={e => updatePlan('firstTask', e.target.value)}
              placeholder="일어나자마자 바로 할 일..." rows={3}
              className="mt-3 w-full bg-transparent text-base dark:text-dark-text placeholder-slate-300 dark:placeholder-slate-700 focus:outline-none resize-none border border-slate-200 dark:border-slate-700 rounded-lg p-3 focus:border-primary-400 transition-colors"
            />
          </div>

          {/* Brain Dump */}
          <div
            data-drop-zone="BRAIN_DUMP"
            className={`p-4 sm:p-6 flex-1 flex flex-col transition-colors ${dragOver === 'BRAIN_DUMP' ? 'bg-primary-50 dark:bg-primary-900/10' : ''}`}
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
                  className={`flex items-center gap-3 group rounded-lg px-2 py-1 transition-colors cursor-grab active:cursor-grabbing ${dragId === item.id ? 'opacity-40' : ''} ${itemRowStyle(item.content, item.isDone)}`}>
                  <span {...touchHandleProps(item)} aria-label="끌어서 옮기기" className={DRAG_HANDLE}>⠿</span>
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
                  <button onClick={() => deleteTodo(item.id!)} aria-label="삭제" className={DELETE_BTN}>✕</button>
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
            data-drop-zone="BIG3"
            className={`p-4 sm:p-6 transition-colors ${big3Blocked ? 'bg-red-50 dark:bg-red-900/10' : dragOver === 'BIG3' ? 'bg-primary-50 dark:bg-primary-900/10' : ''}`}
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
              <span className="text-base font-bold dark:text-dark-text">
                Big 3
                {big3Blocked && <span className="ml-2 text-xs font-medium text-red-500">3개가 꽉 찼어요</span>}
              </span>
              {big3.length < 3 && (
                <button onClick={() => addTodoItem('BIG3')} className="text-sm text-slate-400 hover:text-primary-500 transition-colors">+ 추가</button>
              )}
            </div>
            <div className="space-y-3">
              {big3.length === 0
                ? <button onClick={() => addTodoItem('BIG3')} className="w-full py-4 text-slate-300 dark:text-slate-600 text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg hover:border-primary-300 transition-colors">+ 핵심 과제 추가</button>
                : big3.map((item, i) => (
                  <div key={item.id}
                    data-big3-idx={i}
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
                    <span {...touchHandleProps(item)} aria-label="끌어서 옮기기" className={DRAG_HANDLE}>⠿</span>
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
                    <button onClick={() => deleteTodo(item.id!)} aria-label="삭제" className={DELETE_BTN}>✕</button>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Feedback */}
          <div className="p-4 sm:p-6">
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
        {/* md~lg(폴드 펼침)에선 2열 아래 전체 폭으로 */}
        <div className="p-4 flex flex-col h-full md:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-base font-bold dark:text-dark-text">Time Box</span>
            <button
              onClick={() => { if (selectMode) cancelSelection(); else { setSel(null); setSelMsg(''); setSelectMode(true); } }}
              className={`min-h-11 md:min-h-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                selectMode
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-dark-text'
                  : 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-100'
              }`}>
              {selectMode ? '취소' : '＋ 블록 만들기'}
            </button>
          </div>
          <p className={`text-xs mb-3 ${selMsg ? 'text-red-500' : selectMode ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'}`}>
            {selMsg
              || (selectMode
                ? (sel ? `${slotTime(selLo)} ~ ${slotTime(selHi + 1)} · 끝 칸을 탭하거나 드래그` : '칸을 드래그하거나, 시작 칸 → 끝 칸 차례로 탭 (30분 단위) · 스크롤은 왼쪽 시간 줄')
                : (isTouch ? '여러 칸을 묶으려면 ＋ 블록 만들기' : 'Shift+클릭 → 시작 · 다른 칸 클릭 → 블록 생성 (30분 단위) · Esc 취소'))}
          </p>
          <div className="flex-1 overflow-auto select-none">
            <div className="grid grid-cols-[2rem_1fr_1fr] border-b-2 border-slate-200 dark:border-slate-700">
              <span />
              <span className="text-xs text-slate-400 pb-1 text-center border-l border-slate-200 dark:border-slate-700">30 mins</span>
              <span className="text-xs text-slate-400 pb-1 text-center border-l border-slate-200 dark:border-slate-700">30 mins</span>
            </div>
            <div className="grid grid-cols-[2rem_1fr_1fr] auto-rows-[minmax(2.75rem,auto)] md:auto-rows-[minmax(2.25rem,auto)]">
              {HOURS.map((hour, row) => (
                <div key={`h${hour}`} style={{ gridRow: row + 1, gridColumn: 1 }}
                  className={`text-xs text-right pr-2 font-medium flex items-center justify-end border-b border-slate-100 dark:border-slate-800 ${
                    hour >= 24 ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400'
                  }`}>
                  {hourLabel(hour)}
                </div>
              ))}

              {/* 블록 없는 30분 칸 */}
              {Array.from({ length: TOTAL_SLOTS }, (_, idx) => idx).filter(idx => !coveredSlots.has(idx)).map(idx => {
                const { hour, slot } = indexToSlot(idx);
                const slotKey = slot === 0 ? 'slot1' : 'slot2';
                const doneKey = slot === 0 ? 'slot1Done' : 'slot2Done';
                const inSel = sel !== null && idx >= selLo && idx <= selHi;
                return (
                  <div key={`s${idx}`} data-slot-idx={idx}
                    style={{ gridRow: Math.floor(idx / 2) + 1, gridColumn: slot + 2 }}
                    {...selPointerProps(idx)}
                    onClick={e => handleSlotClick(idx, e)}
                    onMouseEnter={() => { if (sel && !selectMode) setSel({ ...sel, end: idx }); }}
                    className={`flex items-center border-b border-b-slate-100 dark:border-b-slate-800 border-l border-l-slate-200 dark:border-l-slate-700 px-1.5 cursor-pointer transition-colors min-w-0
                      ${selectMode ? 'touch-none' : ''}
                      ${inSel
                        ? (selBlocked ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30')
                        : slotStyle(timeSlots[hour]?.[slotKey] || '', !!timeSlots[hour]?.[doneKey])}`}
                  >
                    <input type="text"
                      value={timeSlots[hour]?.[slotKey] || ''}
                      onChange={e => updateTimeSlot(hour, slotKey, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      onMouseDown={e => e.stopPropagation()}
                      tabIndex={selectMode ? -1 : undefined}
                      className={`w-full min-w-0 bg-transparent focus:outline-none text-xs px-0.5 cursor-text ${selectMode ? 'pointer-events-none' : ''}`} />
                  </div>
                );
              })}

              {/* 블록: 30분 경계면 조각(앞 반 칸 / 꽉 찬 시간 / 뒤 반 칸)으로 나눠 그림 — 입력은 가장 큰 조각에 */}
              {blockRanges.map(({ block, s, e }) => {
                const pieces = blockPieces(s, e);
                const main = pieces.reduce((a, p) => (p.rowSpan * p.colSpan > a.rowSpan * a.colSpan ? p : a), pieces[0]);
                const tone = block.isDone
                  ? 'border-green-400 bg-green-100 dark:bg-green-900/40'
                  : block.content?.trim()
                    ? 'border-red-400 bg-red-50 dark:bg-red-900/30'
                    : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/40';
                return pieces.map((p, pi) => (
                  <div key={`b${block.id}-${pi}`}
                    style={{ gridRow: `${p.row + 1} / span ${p.rowSpan}`, gridColumn: `${p.col + 2} / span ${p.colSpan}` }}
                    className={`border-l-4 border-b border-b-slate-100 dark:border-b-slate-800 px-2 flex items-center min-w-0 ${tone}`}>
                    {p === main ? (
                      <div className="flex items-center gap-1.5 w-full min-w-0">
                        <button onClick={() => updateBlock(block.id!, block.content, !block.isDone)}
                          aria-label={block.isDone ? '완료 취소' : '완료'}
                          className="w-7 h-7 -ml-1.5 flex-shrink-0 flex items-center justify-center">
                          <span className={`w-4 h-4 rounded flex items-center justify-center ${block.isDone ? 'bg-green-500' : block.content?.trim() ? 'bg-red-400' : 'bg-slate-300'}`}>
                            {block.isDone && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                        </button>
                        <div className="flex-1 min-w-0">
                          <input type="text" value={block.content}
                            onChange={ev => updateBlock(block.id!, ev.target.value, block.isDone)}
                            onClick={ev => ev.stopPropagation()}
                            placeholder="내용 입력..."
                            className={`w-full bg-transparent focus:outline-none text-sm cursor-text placeholder-slate-300 ${
                              block.isDone ? 'text-green-700 dark:text-green-400 line-through' : 'text-slate-700 dark:text-dark-text'
                            }`} />
                          <span className="block text-[10px] text-slate-400 tabular-nums truncate">{slotTime(s)} ~ {slotTime(e + 1)}</span>
                        </div>
                        <button onClick={() => deleteBlock(block.id!)} aria-label="블록 삭제"
                          className="w-7 h-7 -mr-1.5 flex-shrink-0 flex items-center justify-center text-slate-400 hover:text-red-400 text-sm font-bold">✕</button>
                      </div>
                    ) : (
                      <span className={`text-xs truncate opacity-60 ${block.isDone ? 'text-green-700 dark:text-green-400 line-through' : 'text-slate-500 dark:text-slate-400'}`}>
                        ↳ {block.content}
                      </span>
                    )}
                  </div>
                ));
              })}
            </div>
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
