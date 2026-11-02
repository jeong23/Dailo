import React from 'react';
import { Link } from 'react-router-dom';
import { AssetGuide } from '../utils/assetGuide';
import { THEME_COLORS } from '../utils/themeDefaults';

// 자산 현황 오른쪽 '리밸런싱 가이드' — utils/assetGuide 결과를 문장으로. 데스크탑은 오른쪽 sticky, 모바일은 목표 배분 위
const CARD = 'bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none';
const fmt = (n: number) => Math.round(n).toLocaleString();

interface Props {
  guide: AssetGuide;
  band: number;
  themeBand: number;
  allowSell: boolean;
  themeOrder: number[]; // 테마 색 — 자산 현황 테마 막대와 같은 순서
  hasThemes: boolean;
}

export const AssetGuidePanel = ({ guide, band, themeBand, allowSell, themeOrder, hasThemes }: Props) => {
  const { transfers, stuck, themeSteps, investAfter } = guide;
  const colorOf = (id: number) => THEME_COLORS[Math.max(themeOrder.indexOf(id), 0) % THEME_COLORS.length];

  return (
    <section className={`${CARD} p-5 sm:p-6 space-y-5`}>
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-dark-text">리밸런싱 가이드</p>
        <p className="text-xs text-slate-400 mt-0.5">목표 배분에 맞추려면 · 칸은 ±{band}%p, 테마는 ±{themeBand}%p 안이면 그대로</p>
      </div>

      {guide.total <= 0 ? (
        <p className="text-sm text-slate-400">자산 금액이 들어오면 옮길 곳을 알려드려요</p>
      ) : guide.balanced ? (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/15 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">목표와 거의 같아요</p>
          <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">지금처럼 매달 정한 대로 넣으면 돼요</p>
        </div>
      ) : (
        <>
          {/* 1. 칸 사이 옮기기 */}
          {(transfers.length > 0 || stuck.length > 0) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">① 칸 사이 옮기기</p>
              <ol className="space-y-2">
                {transfers.map((t, i) => (
                  <li key={`${t.from}-${t.to}`} className="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-3.5 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-primary-600 text-white text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                      <p className="min-w-0 flex-1 text-sm font-semibold text-slate-800 dark:text-dark-text truncate">{t.fromName} → {t.toName}</p>
                      <p className="shrink-0 text-sm font-bold tabular-nums text-primary-600 dark:text-primary-400">{fmt(t.amount)}원</p>
                    </div>
                    <p className="mt-1 pl-7 text-xs text-slate-500 dark:text-slate-400">
                      {t.redirect
                        ? `${t.fromName}은 팔지 않고, 앞으로 넣을 투자금을 ${t.toName}(으)로 돌려 맞춰요 (비중 맞출 때 팔기: 꺼짐)`
                        : t.toSavings
                          ? `${t.toName} 월 납입을 늘리거나 새 적금으로 — 한 번에 넣기보다 나눠서`
                          : `${t.fromName}에서 ${t.toName}(으)로 옮겨요`}
                    </p>
                  </li>
                ))}
                {stuck.map(s => (
                  <li key={s.key} className="rounded-xl border border-dashed border-slate-200 dark:border-dark-border px-3.5 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="min-w-0 flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{s.name}</p>
                      <p className={`shrink-0 text-sm font-semibold tabular-nums ${s.gap > 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                        {s.gap > 0 ? `${fmt(s.gap)}원 부족` : `${fmt(-s.gap)}원 초과`}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {s.kind === 'MANUAL'
                        ? '직접 입력 칸이라 옮길 수 없어요 — 목표를 바꾸거나 새 돈이 생길 때 채워요'
                        : s.kind === 'SAVINGS' && s.gap < 0
                          ? '적금은 해지하면 이자·기여금을 잃어요 — 새 납입만 줄여서 맞춰요'
                          : s.gap > 0
                            ? '옮겨 올 넘치는 칸이 없어요 — 다음 달부터 남는 돈으로 채워요'
                            : stuck.some(x => x.kind === 'MANUAL' && x.gap > 0)
                              ? `${stuck.filter(x => x.kind === 'MANUAL' && x.gap > 0).map(x => x.name).join('·')}처럼 직접 옮길 수 없는 칸 몫이에요 — 그 목표를 위해 모아두는 돈으로 봐도 돼요`
                              : '받을 칸이 없어요 — 목표 비중을 다시 확인해 보세요'}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* 2. 투자 안에서 테마별 */}
          {investAfter !== null && hasThemes && themeSteps.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                ② 투자 안에서 테마별 <span className="font-normal text-slate-400">· 옮긴 뒤 투자 {fmt(investAfter)}원 기준</span>
              </p>
              <ul className="space-y-1.5">
                {themeSteps.map(s => (
                  <li key={s.id} className="flex items-start gap-2.5 min-w-0 py-1">
                    <span className="w-2 h-2 mt-1.5 rounded-full shrink-0" style={{ background: colorOf(s.id) }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="min-w-0 flex-1 text-sm font-medium text-slate-800 dark:text-dark-text truncate">{s.name}</p>
                        <p className={`shrink-0 text-sm font-bold tabular-nums ${s.action === 'BUY' ? 'text-rose-500' : 'text-blue-500'}`}>
                          {s.action === 'BUY' ? '+' : '−'}{fmt(Math.abs(s.gap))}원
                        </p>
                      </div>
                      <p className="text-xs text-slate-400">
                        {s.action === 'BUY'
                          ? s.fromNewMoney ? '앞으로 넣는 돈으로 이만큼 채우기' : s.cash ? '현금성으로 남겨두기' : '이만큼 더 사기'
                          : s.action === 'TRIM'
                            ? s.cash ? '현금성에서 꺼내 다른 테마 매수에 쓰기' : s.satellite ? '위성 상한 초과 — 상한까지 줄이기' : '이만큼 줄이기 (판 돈으로 모자란 테마 매수)'
                            : s.satellite ? '위성 상한 초과 — 더 사지 않기' : '팔지 않고 추가 매수만 멈추기'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <Link to="/invest" className="inline-block text-xs font-medium text-primary-500 min-h-[32px] leading-8">투자 현황에서 종목·계좌별로 보기 →</Link>
            </div>
          )}
          {investAfter !== null && !hasThemes && (
            <p className="text-xs text-slate-400">투자 안 테마를 정하면 테마별로 얼마를 사고 줄일지도 알려드려요 — <Link to="/accounts?tab=invest" className="underline">내 계좌 &gt; 투자</Link></p>
          )}
        </>
      )}

      <p className="text-[11px] text-slate-400 leading-relaxed">
        참고용 계산이에요. 세금·수수료, 연금저축·IRP 인출 제한, 적금 해지 손해는 반영하지 않아요.
        {!allowSell && ' 지금은 \'비중 맞출 때 팔기\'가 꺼져 있어 파는 대신 새 납입금 방향을 바꾸도록 안내해요.'}
      </p>
    </section>
  );
};
