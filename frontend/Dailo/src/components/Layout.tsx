import React, { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { logout } from '../api/axios';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { InstallPrompt } from './InstallPrompt';
import { SessionTimeout } from './SessionTimeout';
import { SalaryDaySync } from './SalaryDaySync';
import { useTheme } from '../utils/theme';

interface LayoutProps {
  children: ReactNode;
}

const NAV_GROUPS = [
  {
    label: '가계부',
    items: [
      { path: '/',               label: '대시보드',    icon: '📊' },
      { path: '/expenses',       label: '지출 / 수입', icon: '💳' },
      { path: '/fixed-costs',    label: '고정비',      icon: '📌' },
      { path: '/report',         label: '리포트',      icon: '📈' },
      { path: '/settings',       label: '예산 설정',    icon: '⚙️' },
    ],
  },
  {
    // 가계부 = 돈의 흐름, 자산 = 쌓인 돈 (보는 곳). 등록·수정은 하단 '내 계좌'
    label: '자산',
    items: [
      { path: '/assets',         label: '자산 현황',   icon: '🧭' },
      { path: '/cash',           label: '현금 자산',    icon: '💰' },
      { path: '/savings',        label: '적금 · 청약',  icon: '🏦' },
      { path: '/invest',         label: '투자 현황',   icon: '💹' },
      { path: '/invest/diary',   label: '투자일기',    icon: '📖' },
    ],
  },
  {
    label: 'Daily',
    items: [
      { path: '/planner-board', label: '월간 플래너',   icon: '🗓️' },
      { path: '/todo',          label: '오늘 플래너',   icon: '📅' },
      { path: '/running',       label: '운동 기록',     icon: '🏃' },
      { path: '/habits',        label: '습관 트래커',   icon: '✅' },
    ],
  },
];

// 모바일(폴드 커버 화면 포함) 하단 탭 — 자주 쓰는 4개 + 전체 메뉴(드로어)
const BOTTOM_TABS = [
  { path: '/',         label: '홈',     icon: '📊' },
  { path: '/expenses', label: '지출',   icon: '💳' },
  { path: '/todo',     label: '플래너', icon: '📅' },
  { path: '/running',  label: '운동',   icon: '🏃' },
];

const PaletteIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
  </svg>
);

export const Layout = ({ children }: LayoutProps) => {
  const { isDark } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEscapeKey(sidebarOpen, () => setSidebarOpen(false));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    localStorage.getItem('sidebarCollapsed') === 'true'
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('collapsedGroups');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const location = useLocation();

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('sidebarCollapsed', String(next));
  };

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      localStorage.setItem('collapsedGroups', JSON.stringify([...next]));
      return next;
    });
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/invest') return location.pathname === '/invest';
    return location.pathname.startsWith(path);
  };

  // rail: 태블릿·폴드 펼친 화면(md~lg) 고정 레일 — 접기 토글 없이 아이콘+작은 라벨
  const Sidebar = ({ collapsed = false, rail = false, drawer = false }: { collapsed?: boolean; rail?: boolean; drawer?: boolean }) => (
    <aside className={`flex flex-col h-full bg-sidebar border-r border-slate-100 dark:border-dark-border transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-56'}`}>
      {/* 로고 + 접기 버튼 */}
      <div className={`flex items-center h-14 flex-shrink-0 border-b border-slate-100 dark:border-dark-border ${collapsed ? 'justify-center px-0' : 'px-4 justify-between'}`}>
        {!collapsed && (
          <Link to="/" onClick={() => setSidebarOpen(false)}>
            <img
              src="/dailo_logo_nobg.png"
              alt="Dailo"
              className="h-7 w-auto object-contain"
              style={isDark ? { filter: 'brightness(2)' } : undefined}
            />
          </Link>
        )}
        {rail ? (
          <Link to="/" aria-label="대시보드">
            <img src="/dailo_logo_nobg.png" alt="Dailo" className="h-6 w-auto object-contain"
              style={isDark ? { filter: 'brightness(2)' } : undefined} />
          </Link>
        ) : drawer ? (
          <button onClick={() => setSidebarOpen(false)} aria-label="메뉴 닫기"
            className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : (
        <button
          onClick={toggleSidebar}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors flex-shrink-0"
          title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        >
          <svg className={`w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
        )}
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto no-scrollbar py-3">
        {NAV_GROUPS.map((group, gi) => {
          const isCollapsed = collapsedGroups.has(group.label);
          return (
            <div key={group.label} className={gi > 0 ? 'mt-2' : ''}>
              {/* 그룹 헤더 */}
              {!collapsed && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-5 py-1 mb-1 group"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-500 transition-colors">
                    {group.label}
                  </span>
                  <svg
                    className={`w-3 h-3 text-slate-300 dark:text-slate-600 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}

              {/* 그룹 아이템 */}
              {(!isCollapsed || collapsed) && (
                <div className={collapsed ? '' : ''}>
                  {group.items.map(item => {
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        title={collapsed ? item.label : undefined}
                        className={`flex transition-all border-l-[3px] ${
                          collapsed ? 'flex-col items-center justify-center gap-0.5 min-h-[52px] px-0 border-l-0 mx-1.5 rounded-xl' : 'items-center gap-3 min-h-[40px] py-2 pr-4 pl-5'
                        } ${
                          active
                            ? collapsed
                              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                              : 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-semibold'
                            : collapsed
                              ? 'border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-700 dark:hover:text-slate-200'
                              : 'border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
                        }`}
                      >
                        <span className="text-base leading-none flex-shrink-0">{item.icon}</span>
                        {collapsed
                          ? <span className="text-[10px] leading-tight max-w-full px-0.5 truncate">{item.label}</span>
                          : <span className="text-sm">{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* 하단 버튼 영역 */}
      <div className={`border-t border-slate-100 dark:border-dark-border py-3 space-y-0.5 flex-shrink-0 ${collapsed ? 'px-1' : 'px-3'}`}>
        {/* 사용자 이름 */}
        {!collapsed && (
          <p className="px-3 py-1 text-xs text-slate-400 dark:text-slate-500 truncate">
            {localStorage.getItem('memberName') || '사용자'}
          </p>
        )}

        {/* 내 계좌 — 현금·적금/청약·투자 계좌 등록·관리 한곳 */}
        <Link
          to="/accounts"
          title={collapsed ? '내 계좌' : undefined}
          className={`flex items-center gap-2.5 w-full px-3 min-h-[40px] rounded-xl text-sm transition-colors ${
            isActive('/accounts')
              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          } ${collapsed ? 'justify-center' : ''}`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M5 10V8l7-4 7 4v2M6 10v7m4-7v7m4-7v7m4-7v7M4 20h16" />
          </svg>
          {!collapsed && <span>내 계좌</span>}
        </Link>

        {/* 화면 설정 (모드·색 테마) */}
        <Link
          to="/preferences"
          title={collapsed ? '화면 설정' : undefined}
          className={`flex items-center gap-2.5 w-full px-3 min-h-[40px] rounded-xl text-sm transition-colors ${
            isActive('/preferences')
              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          } ${collapsed ? 'justify-center' : ''}`}
        >
          <PaletteIcon className="w-4 h-4 shrink-0" />
          {!collapsed && <span>화면 설정</span>}
        </Link>

        {/* 로그아웃 */}
        <button
          onClick={logout}
          title={collapsed ? '로그아웃' : undefined}
          className={`flex items-center gap-2.5 w-full px-3 min-h-[40px] rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 dark:hover:text-red-400 transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && <span>로그아웃</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen h-[100dvh] overflow-hidden bg-slate-50 dark:bg-dark-bg text-slate-900 dark:text-dark-text">
      {/* 태블릿·폴드 펼친 화면(768~1023px): 아이콘 레일 고정 — 전체 사이드바(224px)는 본문을 600px대로 줄여 표가 깨짐 */}
      <div className="hidden md:flex lg:hidden flex-shrink-0">
        <Sidebar collapsed rail />
      </div>
      {/* 데스크탑 사이드바 */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar collapsed={sidebarCollapsed} />
      </div>

      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full z-50 animate-slide-in pt-[env(safe-area-inset-top)] bg-sidebar">
            <Sidebar collapsed={false} drawer />
          </div>
        </div>
      )}

      {/* 본문 */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* 모바일 상단 바 */}
        <header className="md:hidden flex items-center justify-between pl-4 pr-2 h-12 pt-[env(safe-area-inset-top)] box-content border-b border-slate-100 dark:border-dark-border bg-white/90 dark:bg-dark-card/90 backdrop-blur flex-shrink-0">
          <Link to="/" aria-label="대시보드">
            <img src="/dailo_logo_nobg.png" alt="Dailo" className="h-6 w-auto object-contain"
              style={isDark ? { filter: 'brightness(2)' } : undefined} />
          </Link>
          <Link to="/preferences" aria-label="화면 설정"
            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400">
            <PaletteIcon className="w-5 h-5" />
          </Link>
        </header>

        <main className="flex-1 overflow-auto px-4 pt-4 pb-6 sm:p-6 lg:p-8">
          {children}
        </main>

        {/* 모바일 하단 탭 바 — 엄지로 닿는 위치, 홈 인디케이터 영역(safe-area)만큼 패딩 */}
        <nav className="md:hidden flex-shrink-0 border-t border-slate-100 dark:border-dark-border bg-white/95 dark:bg-dark-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-5 h-14">
            {BOTTOM_TABS.map(tab => {
              const active = isActive(tab.path);
              return (
                <Link key={tab.path} to={tab.path} aria-current={active ? 'page' : undefined}
                  className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                    active ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500'
                  }`}>
                  <span className={`text-lg leading-none transition-transform ${active ? 'scale-110' : 'grayscale opacity-70'}`}>{tab.icon}</span>
                  {tab.label}
                </Link>
              );
            })}
            {/* 하단 탭에 없는 페이지에 있으면 '전체'를 활성으로 표시 */}
            {(() => {
              const inMore = !BOTTOM_TABS.some(t => isActive(t.path));
              return (
                <button onClick={() => setSidebarOpen(true)} aria-label="전체 메뉴"
                  className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                    inMore ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500'
                  }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  전체
                </button>
              );
            })()}
          </div>
        </nav>
      </div>
      <InstallPrompt />
      <SessionTimeout />
      <SalaryDaySync />
    </div>
  );
};