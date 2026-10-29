import { useEffect, useRef, useState } from 'react';
import api from '../api/axios';

// 회원 메모를 서버에 자동저장 (GET/PUT /notes/{key}) — 예전엔 기기 localStorage라 다른 기기에서 안 보였음
//  legacyKey: 예전 localStorage 키. 서버에 메모가 없고 이 기기에 남아 있으면 한 번 올리고 지움
//  normalize: 저장 직전 값 변환 (예: 글머리 기호만 남은 메모 → '')
//  키가 바뀌기 전에 600ms 디바운스가 남아 있으면 이전 키로 바로 저장 (달 이동 직후 입력이 사라지지 않게)
export function useServerNote(key: string, legacyKey: string, normalize: (v: string) => string = v => v) {
  const [memo, setMemoState] = useState('');
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const lastSaved = useRef('');
  const pending = useRef<{ key: string; value: string } | null>(null);
  const normalizeRef = useRef(normalize);
  normalizeRef.current = normalize;

  const put = (k: string, value: string) =>
    api.put(`/notes/${k}`, { content: value }).then(() => { if (k === key) { lastSaved.current = value; if (value) setSaved(true); } }).catch(() => {});

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    setSaved(false);
    api.get(`/notes/${key}`).then(r => {
      if (!alive) return;
      let text: string = r.data.data || '';
      let local = '';
      try {
        local = localStorage.getItem(legacyKey) || '';
        if (!local) localStorage.removeItem(legacyKey); // 빈 예전 값은 바로 정리
      } catch { /* 저장소 차단 */ }
      if (!text && local) {
        text = local;
        api.put(`/notes/${key}`, { content: local })
          .then(() => { try { localStorage.removeItem(legacyKey); } catch { /* 무시 */ } })
          .catch(() => {});
      }
      lastSaved.current = text;
      setMemoState(text);
      setLoaded(true);
    }).catch(() => { if (alive) { setMemoState(''); setLoaded(true); } });
    return () => {
      alive = false;
      // 달을 옮기기 직전 입력 — 이전 키로 바로 저장
      if (pending.current) { const p = pending.current; pending.current = null; api.put(`/notes/${p.key}`, { content: p.value }).catch(() => {}); }
    };
  }, [key, legacyKey]);

  useEffect(() => {
    if (!loaded) return;
    const value = normalizeRef.current(memo);
    if (value === lastSaved.current) { pending.current = null; return; }
    pending.current = { key, value };
    const timer = setTimeout(() => { pending.current = null; put(key, value); }, 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memo, key, loaded]);

  const setMemo = (v: string) => { setMemoState(v); setSaved(false); };
  return { memo, setMemo, saved, loaded };
}
