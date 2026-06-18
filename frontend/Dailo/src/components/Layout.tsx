import React, { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { logout } from '../api/axios';

interface LayoutProps {
  children: ReactNode;
}

const NAV_GROUPS = [
  {
    label: 'Money',
    items: [
      { path: '/',               label: '대시보드',    icon: '📊' },
      { path: '/expenses',       label: '지출 / 수입', icon: '💳' },
      { path: '/fixed-costs',    label: '고정비',      icon: '📌' },
      { path: '/report',         label: '리포트',      icon: '📈' },
      { path: '/emergency',      label: '비상금',      icon: '🛡️' },
      { path: '/invest',         label: '투자 현황',   icon: '💹' },
      { path: '/invest/diary',   label: '투자일기',    icon: '📖' },
      { path: '/invest/settings',label: '투자 설정',   icon: '⚙️' },
    ],
  },
  {
    label: 'Daily',
    items: [
      { path: '/planner-board', label: '플래너 보드',   icon: '🗓️' },
      { path: '/todo',          label: '오늘의 플래너', icon: '📅' },
      { path: '/running',       label: '운동 기록',     icon: '🏃' },
      { path: '/habits',        label: '습관 트래커',   icon: '✅' },
    ],
  },
];

export const Layout = ({ children }: LayoutProps) => {
  const [isDark, setIsDark] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  useEffect(() => {
    const saved = localStorage.getItem('darkMode');
    const isDarkMode = saved === null ? true : saved === 'true';
    setIsDark(isDarkMode);
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, []);

  const toggleDarkMode = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('darkMode', String(next));
    document.documentElement.classList.toggle('dark', next);
  };

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

  const Sidebar = ({ collapsed = false }: { collapsed?: boolean }) => (
    <aside className={`flex flex-col h-full bg-white dark:bg-dark-card border-r border-slate-100 dark:border-dark-border transition-all duration-300 ${collapsed ? 'w-14' : 'w-56'}`}>
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
        <button
          onClick={toggleSidebar}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors flex-shrink-0"
          title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        >
          <svg className={`w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto py-3">
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
                        className={`flex items-center gap-3 py-2 transition-all border-l-[3px] ${
                          collapsed ? 'justify-center px-0 border-l-0 mx-1 rounded-lg' : 'pr-4 pl-5'
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
                        {!collapsed && <span className="text-sm">{item.label}</span>}
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

        {/* 설정 링크 */}
        <Link
          to="/settings"
          title={collapsed ? '설정' : undefined}
          className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm transition-colors ${
            isActive('/settings')
              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          } ${collapsed ? 'justify-center' : ''}`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {!collapsed && <span>설정</span>}
        </Link>

        {/* 다크모드 토글 */}
        <button
          onClick={toggleDarkMode}
          title={collapsed ? (isDark ? '라이트 모드' : '다크 모드') : undefined}
          className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          {isDark ? (
            <svg className="w-4 h-4 text-yellow-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          )}
          {!collapsed && <span>{isDark ? '라이트 모드' : '다크 모드'}</span>}
        </button>

        {/* 로그아웃 */}
        <button
          onClick={logout}
          title={collapsed ? '로그아웃' : undefined}
          className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 dark:hover:text-red-400 transition-colors ${collapsed ? 'justify-center' : ''}`}
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
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-dark-bg text-slate-900 dark:text-dark-text">
      {/* 데스크탑 사이드바 */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar collapsed={sidebarCollapsed} />
      </div>

      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full z-50">
            <Sidebar collapsed={false} />
          </div>
        </div>
      )}

      {/* 본문 */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* 모바일 상단 바 */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-slate-100 dark:border-dark-border bg-white dark:bg-dark-card flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
            <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <img src="/dailo_logo_nobg.png" alt="Dailo" className="h-7 w-auto object-contain"
            style={isDark ? { filter: 'brightness(2)' } : undefined} />
          <button onClick={toggleDarkMode} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
            {isDark
              ? <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" /></svg>
              : <svg className="w-5 h-5 text-slate-500" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
            }
          </button>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};