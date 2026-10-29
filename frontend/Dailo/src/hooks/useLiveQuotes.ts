import { useEffect, useState } from 'react';

export interface LiveQuote {
  code: string;
  price: number;
  change: number;       // 전일 대비 (부호 포함)
  changeRate: number;   // 전일 대비율 % (부호 포함)
  time: string | null;  // 체결 시각 HHmmss — REST 스냅샷이면 null
  source: 'REALTIME' | 'SNAPSHOT' | 'NAVER';
}

export interface QuoteStatus {
  configured: boolean;  // 백엔드에 KIS 키 설정됨
  connected: boolean;   // 시세 소스 연결됨 (KIS 웹소켓 / 네이버 마지막 조회 성공)
  marketOpen: boolean;  // 정규장 시간
  provider?: 'KIS' | 'NAVER' | 'NONE'; // KIS 키 없으면 네이버 폴링(20초 지연)
}

// 백엔드 SSE(/api/invest/quotes/stream) 구독.
// EventSource는 Authorization 헤더를 못 실어서 fetch 스트림으로 직접 읽는다 (토큰을 URL에 넣지 않기 위해).
// 끊기면 지수 백오프 재접속, 모바일에서 앱으로 돌아오면 즉시 재접속.
export function useLiveQuotes(enabled: boolean) {
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [status, setStatus] = useState<QuoteStatus | null>(null);
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let active = false;
    let attempt = 0;
    let controller: AbortController | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const handleEvent = (block: string) => {
      let event = 'message';
      const data: string[] = [];
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith(':')) continue; // 하트비트 주석
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
      }
      if (data.length === 0) return;
      try {
        const payload = JSON.parse(data.join('\n'));
        if (event === 'snapshot') {
          setStatus(payload.status);
          setQuotes(payload.quotes || {});
        } else if (event === 'quote') {
          setQuotes(prev => ({ ...prev, [payload.code]: payload }));
        } else if (event === 'status') {
          setStatus(payload);
        }
      } catch {
        /* 깨진 이벤트는 무시 */
      }
    };

    const scheduleRetry = () => {
      if (stopped) return;
      clearTimeout(retryTimer);
      retryTimer = setTimeout(connect, Math.min(30_000, 2_000 * 2 ** attempt++));
    };

    const connect = async () => {
      if (stopped || active) return;
      active = true;
      controller = new AbortController();
      try {
        const res = await fetch('/api/invest/quotes/stream', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`, Accept: 'text/event-stream' },
          cache: 'no-store',
          signal: controller.signal,
        });
        if (res.status === 401 || res.status === 403) { stopped = true; return; } // 로그인 만료 — 다른 API 호출이 로그인 화면으로 보냄
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
        setStreaming(true);
        attempt = 0;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let match: RegExpMatchArray | null;
          while ((match = buffer.match(/\r?\n\r?\n/)) && match.index !== undefined) {
            handleEvent(buffer.slice(0, match.index));
            buffer = buffer.slice(match.index + match[0].length);
          }
        }
      } catch {
        /* 네트워크 끊김·abort — 아래에서 재접속 */
      } finally {
        active = false;
        setStreaming(false);
        scheduleRetry();
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible' && !active && !stopped) {
        attempt = 0;
        clearTimeout(retryTimer);
        connect();
      }
    };

    connect();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);

  return { quotes, status, streaming };
}
