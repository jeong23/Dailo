import React, { useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import { shrinkImage } from '../utils/imageResize';

// 미래 시각화 보드 — 사진 여러 장을 보드 안에서 자유롭게 옮기고 크기 조절
// 회원별 보드 하나(날짜 무관). 위치·크기는 보드 대비 % → 폰·폴드·PC에서 같은 배치 (보드 4:3 고정)
// 마우스: 바로 드래그 / 터치: 탭해서 선택한 사진만 드래그(선택 안 된 사진 위에서는 페이지 스크롤)

export interface VisionItem {
  id: number;
  imageUrl: string;
  x: number; y: number; w: number; h: number; z: number;
}

const BOARD_RATIO = 4 / 3; // 가로 / 세로
const MAX_ITEMS = 20;
const MIN_SIZE = 5;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// 사진 원본 비율 그대로, 보드 폭의 45%로 시작
const naturalRatio = (url: string) => new Promise<number>(resolve => {
  const img = new Image();
  img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1);
  img.onerror = () => resolve(1);
  img.src = url;
});

const initialRect = (ratio: number, n: number) => {
  let w = 45;
  let h = (w * BOARD_RATIO) / ratio;
  if (h > 80) { w = (w * 80) / h; h = 80; }
  const offset = (n * 6) % 30; // 새 사진이 겹쳐 숨지 않게 계단식
  return { x: clamp(5 + offset, 0, 100 - w), y: clamp(5 + offset, 0, 100 - h), w, h };
};

interface Drag {
  id: number;
  mode: 'move' | 'resize';
  startX: number; startY: number;
  orig: VisionItem;
  boardW: number; boardH: number;
  moved: boolean;
  last: VisionItem; // 마지막 계산값 — itemsRef는 렌더 후에야 갱신되므로 저장은 이 값으로
}

export const VisionBoard = ({ title, legacyUrl }: { title: React.ReactNode; legacyUrl?: string }) => {
  const [items, setItems] = useState<VisionItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useRef<Drag | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    api.get('/vision-board')
      .then(res => setItems(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // 보드 바깥을 누르면 선택 해제
  useEffect(() => {
    if (selectedId === null) return;
    const onDown = (e: PointerEvent) => {
      if (!boardRef.current?.contains(e.target as Node)) setSelectedId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') setSelectedId(null);
      if (e.key === 'Delete') removeItem(selectedId);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const maxZ = () => itemsRef.current.reduce((m, i) => Math.max(m, i.z), 0);

  const save = (item: VisionItem) => {
    const { x, y, w, h, z } = item;
    api.put(`/vision-board/${item.id}`, { x, y, w, h, z }).catch(() => {});
  };

  const addFromUrl = async (url: string, n: number) => {
    const rect = initialRect(await naturalRatio(url), n);
    const res = await api.post('/vision-board', { imageUrl: url, ...rect, z: maxZ() + 1 });
    const created: VisionItem = res.data.data;
    setItems(prev => [...prev, created]);
    setSelectedId(created.id);
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = ''; // 같은 사진을 다시 골라도 onChange가 발화하도록
    const room = MAX_ITEMS - itemsRef.current.length;
    if (picked.length === 0) return;
    if (room <= 0) { alert(`사진은 ${MAX_ITEMS}장까지 올릴 수 있어요.`); return; }
    const files = picked.slice(0, room);
    const errors: string[] = [];
    setProgress({ done: 0, total: files.length });
    for (let i = 0; i < files.length; i++) {
      try {
        const file = await shrinkImage(files[i]);
        const form = new FormData();
        form.append('file', file);
        const up = await api.post('/daily-plans/upload-image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        await addFromUrl(up.data.data, itemsRef.current.length);
      } catch (err: any) {
        errors.push(err?.response?.data?.message || '업로드에 실패했어요');
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setProgress(null);
    if (picked.length > room) errors.push(`${MAX_ITEMS}장을 넘는 ${picked.length - room}장은 올리지 않았어요`);
    if (errors.length) alert(errors.join('\n'));
  };

  const importLegacy = () => {
    if (legacyUrl) addFromUrl(legacyUrl, 0).catch((err: any) => alert(err?.response?.data?.message || '가져오지 못했어요'));
  };

  const removeItem = (id: number) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setSelectedId(null);
    api.delete(`/vision-board/${id}`).catch(() => {});
  };

  const bringToFront = (item: VisionItem) => {
    const top = maxZ();
    if (item.z === top && itemsRef.current.filter(i => i.z === top).length === 1) return item;
    const updated = { ...item, z: top + 1 };
    setItems(prev => prev.map(i => i.id === item.id ? updated : i));
    return updated;
  };

  const startDrag = (e: React.PointerEvent, item: VisionItem, mode: Drag['mode']) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.stopPropagation();
    e.preventDefault();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    drag.current = { id: item.id, mode, startX: e.clientX, startY: e.clientY, orig: item, boardW: rect.width, boardH: rect.height, moved: false, last: item };
  };

  const onItemPointerDown = (e: React.PointerEvent, item: VisionItem) => {
    if (e.button !== 0) return;
    const wasSelected = selectedId === item.id;
    setSelectedId(item.id);
    const front = bringToFront(item);
    // 터치는 선택된 사진만 끌기 — 선택 안 된 사진 위 스와이프는 페이지 스크롤로 남겨둠
    if (front !== item) save(front);
    if (e.pointerType === 'mouse' || wasSelected) startDrag(e, front, 'move');
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = ((e.clientX - d.startX) / d.boardW) * 100;
    const dy = ((e.clientY - d.startY) / d.boardH) * 100;
    if (Math.abs(dx) + Math.abs(dy) > 0.3) d.moved = true;
    const o = d.orig;
    let next: VisionItem;
    if (d.mode === 'move') {
      next = { ...o, x: clamp(o.x + dx, 0, 100 - o.w), y: clamp(o.y + dy, 0, 100 - o.h) };
    } else {
      // 오른쪽 아래 모서리: 사진 비율 유지하며 크기 조절
      const ratio = o.w / o.h;
      const maxW = Math.min(100 - o.x, (100 - o.y) * ratio);
      const minW = Math.max(MIN_SIZE, MIN_SIZE * ratio);
      const w = clamp(o.w + Math.max(dx, dy * ratio), minW, maxW);
      next = { ...o, w, h: w / ratio };
    }
    d.last = next;
    setItems(prev => prev.map(i => i.id === d.id ? next : i));
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) save(d.last);
  };

  const full = items.length >= MAX_ITEMS;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        {title}
        {items.length > 0 && (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={full || !!progress}
            className="min-h-[44px] sm:min-h-0 rounded-full px-3 py-1.5 text-xs font-medium bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 disabled:opacity-40 transition-colors whitespace-nowrap">
            + 사진 추가 <span className="tabular-nums opacity-70">{items.length}/{MAX_ITEMS}</span>
          </button>
        )}
      </div>

      <div
        ref={boardRef}
        className="relative mt-3 w-full aspect-[4/3] rounded-lg overflow-hidden select-none bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700"
        onPointerDown={e => { if (e.target === e.currentTarget) setSelectedId(null); }}
      >
        {loaded && items.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={!!progress}
              className="flex flex-col items-center justify-center w-full h-full border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors">
              <svg className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">목표 사진을 여러 장 올려 보드를 꾸며보세요</span>
              <span className="text-slate-400 dark:text-slate-500 text-xs mt-1">끌어서 옮기고 모서리로 크기 조절 · 최대 {MAX_ITEMS}장</span>
            </button>
            {legacyUrl && (
              <button type="button" onClick={importLegacy}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 min-h-[44px] rounded-full px-4 text-xs font-medium bg-white dark:bg-dark-card shadow text-teal-700 dark:text-teal-300 whitespace-nowrap">
                이 날 올렸던 사진 가져오기
              </button>
            )}
          </div>
        )}

        {items.map(item => {
          const selected = item.id === selectedId;
          return (
            <div
              key={item.id}
              className={`absolute ${selected ? 'touch-none cursor-move' : 'cursor-pointer [@media(hover:hover)]:cursor-move'}`}
              style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.w}%`, height: `${item.h}%`, zIndex: item.z }}
              onPointerDown={e => onItemPointerDown(e, item)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <img src={item.imageUrl} alt="목표 사진" draggable={false}
                className={`w-full h-full object-cover rounded-md shadow-md pointer-events-none ${selected ? 'ring-2 ring-primary-500 ring-offset-1 ring-offset-white dark:ring-offset-slate-900' : ''}`} />
              {selected && (
                <>
                  {/* 삭제: 44px 터치 영역, 보이는 원은 작게 */}
                  <button type="button" aria-label="사진 삭제"
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => removeItem(item.id)}
                    className="absolute top-0 right-0 w-11 h-11 flex items-start justify-end p-1">
                    <span className="w-6 h-6 rounded-full bg-slate-900/80 text-white text-xs flex items-center justify-center shadow">✕</span>
                  </button>
                  {/* 크기 조절 손잡이 (오른쪽 아래) */}
                  <div aria-label="크기 조절"
                    onPointerDown={e => startDrag(e, item, 'resize')}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    className="absolute bottom-0 right-0 w-11 h-11 flex items-end justify-end p-1 touch-none cursor-nwse-resize">
                    <span className="w-5 h-5 rounded-full bg-white border-2 border-primary-500 shadow" />
                  </div>
                </>
              )}
            </div>
          );
        })}

        {progress && (
          <div className="absolute inset-0 z-[999] flex items-center justify-center bg-black/40 text-white text-sm font-medium">
            업로드 중... {progress.done}/{progress.total}
          </div>
        )}
      </div>
      {items.length > 0 && (
        <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
          <span className="[@media(hover:hover)]:hidden">사진을 탭해 선택 → 끌어서 이동 · 모서리 ●로 크기 조절</span>
          <span className="hidden [@media(hover:hover)]:inline">끌어서 이동 · 모서리 ●로 크기 조절 · 선택 후 Delete로 삭제</span>
        </p>
      )}
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
    </div>
  );
};
