import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Toast, useToast } from './Toast';
import { todayYmd } from '../utils/format';

// 내 데이터 내보내기(백업) — 고른 묶음만 CSV로 묶은 ZIP을 받음. 목록·행 수는 서버(GET /export/items)가 단일 소스
interface ExportItem {
  key: string;
  label: string;
  description: string;
  rows: number;
}

// 서버가 400을 주면 blob 응답이라 메시지를 꺼내 읽어야 함
const errorMessage = async (e: any): Promise<string> => {
  const data = e?.response?.data;
  if (data instanceof Blob) {
    try { return JSON.parse(await data.text())?.message || ''; } catch { return ''; }
  }
  return data?.message || '';
};

const fileNameOf = (disposition?: string): string => {
  const m = disposition?.match(/filename\*=UTF-8''([^;]+)/i) || disposition?.match(/filename="?([^";]+)"?/i);
  return m ? decodeURIComponent(m[1]) : `dailo-backup-${todayYmd().replace(/-/g, '')}.zip`;
};

export const ExportSection = ({ className }: { className: string }) => {
  const [items, setItems] = useState<ExportItem[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const { toast, show } = useToast();

  useEffect(() => {
    api.get('/export/items')
      .then(res => {
        const list: ExportItem[] = res.data.data || [];
        setItems(list);
        setSelected(new Set(list.filter(i => i.rows > 0).map(i => i.key))); // 기록 있는 것만 기본 체크
      })
      .catch(() => setLoadFailed(true));
  }, []);

  const toggle = (key: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const allChecked = !!items && items.length > 0 && items.every(i => selected.has(i.key));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set((items || []).map(i => i.key)));
  const selectedRows = (items || []).filter(i => selected.has(i.key)).reduce((s, i) => s + i.rows, 0);

  const download = async () => {
    if (!items || selected.size === 0) return;
    setDownloading(true);
    try {
      const keys = items.filter(i => selected.has(i.key)).map(i => i.key).join(',');
      const res = await api.get('/export', { params: { items: keys }, responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileNameOf(res.headers['content-disposition']);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000); // 모바일 사파리는 바로 해제하면 저장 전에 끊김
      show('백업 파일을 받았어요');
    } catch (e) {
      show((await errorMessage(e)) || '내보내기에 실패했어요. 잠시 후 다시 시도해 주세요.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-800 dark:text-dark-text">내 데이터 내보내기</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            고른 항목을 엑셀에서 열 수 있는 CSV 파일로 묶어 받아요.
          </p>
        </div>
        {items && items.length > 0 && (
          <button onClick={toggleAll}
            className="shrink-0 min-h-[44px] px-3 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline">
            {allChecked ? '전체 해제' : '전체 선택'}
          </button>
        )}
      </div>

      {loadFailed && (
        <p className="mt-4 text-sm text-rose-500 font-medium">항목을 불러오지 못했어요. 새로고침해 주세요.</p>
      )}
      {!items && !loadFailed && (
        <div className="mt-4 space-y-2" aria-hidden>
          {[0, 1, 2].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />)}
        </div>
      )}

      {items && (
        <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map(item => {
            const on = selected.has(item.key);
            return (
              <li key={item.key} className="min-w-0">
                <label className={`flex items-center gap-3 min-h-[56px] px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                  on ? 'ring-2 ring-primary-500 bg-primary-50/40 dark:bg-primary-900/10'
                     : 'ring-1 ring-slate-200 dark:ring-dark-border hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}>
                  <input type="checkbox" className="sr-only peer" checked={on} onChange={() => toggle(item.key)} />
                  <span aria-hidden className={`shrink-0 w-5 h-5 rounded-md flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-primary-400 ${
                    on ? 'bg-primary-500' : 'ring-1 ring-inset ring-slate-300 dark:ring-slate-600'
                  }`}>
                    {on && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{item.label}</span>
                      <span className="shrink-0 text-xs tabular-nums text-slate-400 dark:text-slate-500">
                        {item.rows > 0 ? `${item.rows.toLocaleString()}건` : '기록 없음'}
                      </span>
                    </span>
                    <span className="block text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{item.description}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {items && (
        <div className="mt-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            비밀번호는 넣지 않아요. 사진은 주소만 들어가요. 금융 기록이 있으니 안전한 곳에 보관하세요.
          </p>
          <button onClick={download} disabled={selected.size === 0 || downloading}
            className="shrink-0 min-h-[44px] px-5 rounded-full bg-primary-500 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {downloading ? '만드는 중...' : selected.size === 0 ? '항목을 골라주세요' : `${selected.size}개 항목 받기 (${selectedRows.toLocaleString()}건)`}
          </button>
        </div>
      )}

      <Toast toast={toast} />
    </section>
  );
};
