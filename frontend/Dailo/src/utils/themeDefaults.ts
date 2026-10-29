// 추천 테마 — 투자 설정 '추천 테마로 시작'에서 쓰는 기본 구성. 목표 %는 출발점일 뿐, 설정에서 바꿈.
// 종목명 키워드로 자동 배정: 위에서부터 먼저 맞는 테마 (현금성을 먼저 봐야 '현금'이 원자재 '금'에 안 걸림)

export const THEME_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#64748b', '#f43f5e', '#06b6d4', '#84cc16', '#ec4899'];

export interface DefaultTheme { name: string; targetPct: number; cash: boolean; match: RegExp }

export const DEFAULT_THEMES: DefaultTheme[] = [
  { name: '미국 지수', targetPct: 30, cash: false, match: /S&P|나스닥|NASDAQ|다우|미국/i },
  { name: 'AI·테크',   targetPct: 25, cash: false, match: /AI|로보|반도체|테크|빅테크|IT|소프트웨어/i },
  { name: '원자재',    targetPct: 20, cash: false, match: /금현물|골드|GOLD|WTI|원유|원자재|구리|은선물|농산물/i },
  { name: '국내 지수', targetPct: 10, cash: false, match: /KODEX ?200|TIGER ?200|코스피|KOSPI|코스닥|KOSDAQ/i },
  { name: '현금성',    targetPct: 15, cash: true,  match: /단기채|채권|현금|예수금|디폴트|CMA|MMF|파킹|머니마켓|KOFR|CD금리/i },
];

// 매칭 우선순위 (DEFAULT_THEMES 인덱스): 현금성 → 원자재 → AI·테크 → 국내 지수 → 미국 지수
const MATCH_ORDER = [4, 2, 1, 3, 0];

/** 종목명으로 추천 테마 인덱스 (없으면 -1) */
export function guessThemeIndex(ticker: string): number {
  for (const i of MATCH_ORDER) if (DEFAULT_THEMES[i].match.test(ticker)) return i;
  return -1;
}
