import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../api/axios';

// ── 타입 ──────────────────────────────────────────────
interface LatLng { lat: number; lng: number; }

interface RunningGoal {
  id?: number;
  year: number;
  month: number;
  targetCount: number;
  targetDistanceKm?: number;
  achievedCount: number;
  achievedDistanceKm: number;
  streak: number;
}

interface RunningRecord {
  id?: number;
  runDate: string;
  ran: boolean;
  title?: string;
  distanceKm?: number;
  durationSeconds?: number;
  pace?: string;
  calories?: number;
  elevationGain?: number;
  avgHeartRate?: number;
  cadence?: number;
  memo?: string;
  routeJson?: string;
}

// ── 유틸 ──────────────────────────────────────────────
const haversine = (a: LatLng, b: LatLng) => {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sin2 = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2));
};

const calcTotalDistance = (path: LatLng[]) => {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += haversine(path[i - 1], path[i]);
  return total;
};

const calcKmMarkers = (path: LatLng[]) => {
  const markers: { km: number; pos: LatLng }[] = [];
  if (path.length < 2) return markers;
  let cumDist = 0;
  let nextKm = 1;
  for (let i = 1; i < path.length; i++) {
    const segDist = haversine(path[i - 1], path[i]);
    while (cumDist + segDist >= nextKm) {
      const ratio = (nextKm - cumDist) / segDist;
      markers.push({
        km: nextKm,
        pos: {
          lat: path[i - 1].lat + ratio * (path[i].lat - path[i - 1].lat),
          lng: path[i - 1].lng + ratio * (path[i].lng - path[i - 1].lng),
        },
      });
      nextKm++;
    }
    cumDist += segDist;
  }
  return markers;
};

const formatDuration = (secs?: number) => {
  if (!secs) return '--:--';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
};

const getDayLabel = (dateStr: string) => {
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  return days[new Date(dateStr).getDay()];
};

const todayStr = new Date().toISOString().split('T')[0];

// ── 탭 타입 ───────────────────────────────────────────
type Tab = '주' | '월' | '년';

// ── 메인 컴포넌트 ─────────────────────────────────────
export const RunningPage = () => {
  const now = new Date();
  const [tab, setTab] = useState<Tab>('월');
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const { year, month } = ym;

  const [goal, setGoal] = useState<RunningGoal | null>(null);
  const [records, setRecords] = useState<RunningRecord[]>([]);
  const [weekRecords, setWeekRecords] = useState<RunningRecord[]>([]);
  const [yearRecords, setYearRecords] = useState<RunningRecord[]>([]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalForm, setGoalForm] = useState({ targetCount: 12, targetDistanceKm: '' });

  // 주 탭 상태
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    return monday;
  });

  // 년 탭 상태
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // 기록 모달
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [recForm, setRecForm] = useState<{
    ran: boolean; title: string; distanceKm: string; duration: string;
    calories: string; elevationGain: string; avgHeartRate: string; cadence: string;
    memo: string; path: LatLng[];
  }>({ ran: true, title: '', distanceKm: '', duration: '',
      calories: '', elevationGain: '', avgHeartRate: '', cadence: '', memo: '', path: [] });

  // 상세 모달
  const [detailRecord, setDetailRecord] = useState<RunningRecord | null>(null);

  // 카카오맵 refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const detailMapRef = useRef<HTMLDivElement>(null);
  const kakaoMapRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const pathRef = useRef<LatLng[]>([]);

  const toDateStr = (d: Date) => d.toISOString().split('T')[0];

  const getWeekOfMonth = (d: Date) => {
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
    return Math.ceil((d.getDate() + firstDay) / 7);
  };

  const fetchData = useCallback(async (y: number, m: number) => {
    const [goalRes, recsRes] = await Promise.allSettled([
      api.get(`/running/goal?year=${y}&month=${m}`),
      api.get(`/running/records?year=${y}&month=${m}`),
    ]);
    if (goalRes.status === 'fulfilled' && goalRes.value.data.data) setGoal(goalRes.value.data.data);
    else setGoal(null);
    if (recsRes.status === 'fulfilled') setRecords(recsRes.value.data.data || []);
  }, []);

  const fetchWeekData = useCallback(async (start: Date) => {
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const startStr = toDateStr(start);
    const endStr = toDateStr(end);
    const y1 = start.getFullYear(), m1 = start.getMonth() + 1;
    const y2 = end.getFullYear(), m2 = end.getMonth() + 1;

    if (y1 === y2 && m1 === m2) {
      const res = await api.get(`/running/records?year=${y1}&month=${m1}`).catch(() => null);
      const all: RunningRecord[] = res?.data?.data || [];
      setWeekRecords(all.filter(r => r.runDate >= startStr && r.runDate <= endStr));
    } else {
      const [res1, res2] = await Promise.allSettled([
        api.get(`/running/records?year=${y1}&month=${m1}`),
        api.get(`/running/records?year=${y2}&month=${m2}`),
      ]);
      const all: RunningRecord[] = [
        ...(res1.status === 'fulfilled' ? res1.value.data.data || [] : []),
        ...(res2.status === 'fulfilled' ? res2.value.data.data || [] : []),
      ];
      setWeekRecords(all.filter(r => r.runDate >= startStr && r.runDate <= endStr));
    }
  }, []);

  const fetchYearData = useCallback(async (y: number) => {
    const res = await api.get(`/running/records/year?year=${y}`).catch(() => null);
    setYearRecords(res?.data?.data || []);
  }, []);

  useEffect(() => { if (tab === '월') fetchData(year, month); }, [tab, year, month, fetchData]);
  useEffect(() => { if (tab === '주') fetchWeekData(weekStart); }, [tab, weekStart, fetchWeekData]);
  useEffect(() => { if (tab === '년') fetchYearData(selectedYear); }, [tab, selectedYear, fetchYearData]);

  // ── 탭별 활성 records ────────────────────────────
  const activeRecords = tab === '주' ? weekRecords : tab === '년' ? yearRecords : records;
  const ranRecords = activeRecords.filter(r => r.ran);
  const totalDist = ranRecords.reduce((s, r) => s + (r.distanceKm || 0), 0);
  const totalSecs = ranRecords.reduce((s, r) => s + (r.durationSeconds || 0), 0);
  const avgPace = totalDist > 0 && totalSecs > 0
    ? (() => {
        const pSec = totalSecs / totalDist;
        return `${Math.floor(pSec / 60)}'${String(Math.round(pSec % 60)).padStart(2, '0')}''`;
      })()
    : '--';

  // 바 차트 데이터 (탭별)
  const daysInMonth = new Date(year, month, 0).getDate();
  const chartData = tab === '주'
    ? Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const ds = toDateStr(d);
        const rec = weekRecords.find(r => r.runDate === ds);
        const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
        return { day: dayLabels[d.getDay()], dist: rec?.ran ? (rec.distanceKm || 0) : 0 };
      })
    : tab === '년'
    ? Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const dist = yearRecords
          .filter(r => r.ran && parseInt(r.runDate.split('-')[1]) === m)
          .reduce((s, r) => s + (r.distanceKm || 0), 0);
        return { day: `${m}월`, dist: Math.round(dist * 10) / 10 };
      })
    : Array.from({ length: daysInMonth }, (_, i) => {
        const ds = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
        const rec = records.find(r => r.runDate === ds);
        return { day: i + 1, dist: rec?.ran ? (rec.distanceKm || 0) : 0 };
      });

  // 최근 활동 (ran=true, 최신순)
  const recentActivities = [...ranRecords].sort((a, b) => b.runDate.localeCompare(a.runDate));

  // ── 기록 모달 초기화 ──────────────────────────────
  const parseDurationToSecs = (dur: string): number | undefined => {
    const parts = dur.split(':');
    if (parts.length !== 2) return undefined;
    const m = parseInt(parts[0]);
    const s = parseInt(parts[1]);
    if (isNaN(m) || isNaN(s)) return undefined;
    return m * 60 + s;
  };

  const calcLivePace = (): string => {
    const dist = parseFloat(recForm.distanceKm);
    const secs = parseDurationToSecs(recForm.duration);
    if (!dist || !secs || dist === 0) return '--';
    const paceSec = secs / dist;
    return `${Math.floor(paceSec / 60)}'${String(Math.round(paceSec % 60)).padStart(2, '0')}''`;
  };

  const openRecord = (ds: string) => {
    const rec = records.find(r => r.runDate === ds);
    const dur = rec?.durationSeconds
      ? `${Math.floor(rec.durationSeconds / 60)}:${String(rec.durationSeconds % 60).padStart(2, '0')}`
      : '';
    setRecForm({
      ran: rec?.ran ?? true,
      title: rec?.title || '',
      distanceKm: rec?.distanceKm != null ? String(rec.distanceKm) : '',
      duration: dur,
      calories: rec?.calories != null ? String(rec.calories) : '',
      elevationGain: rec?.elevationGain != null ? String(rec.elevationGain) : '',
      avgHeartRate: rec?.avgHeartRate != null ? String(rec.avgHeartRate) : '',
      cadence: rec?.cadence != null ? String(rec.cadence) : '',
      memo: rec?.memo || '',
      path: rec?.routeJson ? JSON.parse(rec.routeJson) : [],
    });
    setSelectedDate(ds);
  };

  const saveRecord = async () => {
    if (!selectedDate) return;
    const path = recForm.path;
    const dist = recForm.distanceKm ? parseFloat(recForm.distanceKm) : undefined;
    const dSecs = parseDurationToSecs(recForm.duration);

    await api.post('/running/record', {
      runDate: selectedDate,
      ran: recForm.ran,
      title: recForm.title || `${getDayLabel(selectedDate)} 러닝`,
      distanceKm: dist,
      durationSeconds: dSecs,
      calories: recForm.calories ? parseInt(recForm.calories) : null,
      elevationGain: recForm.elevationGain ? parseInt(recForm.elevationGain) : null,
      avgHeartRate: recForm.avgHeartRate ? parseInt(recForm.avgHeartRate) : null,
      cadence: recForm.cadence ? parseInt(recForm.cadence) : null,
      memo: recForm.memo,
      routeJson: path.length > 0 ? JSON.stringify(path) : null,
    });
    setSelectedDate(null);
    fetchData(year, month);
  };

  // ── 경로 그리기 함수 (지도 초기화 후 / path 변경 시 공용) ──
  const drawPath = useCallback((path: LatLng[]) => {
    const kakao = (window as any).kakao;
    if (!kakaoMapRef.current || !kakao) return;
    if (polylineRef.current) polylineRef.current.setMap(null);
    overlaysRef.current.forEach(o => o.setMap(null));
    overlaysRef.current = [];

    if (path.length === 0) return;

    const startOverlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(path[0].lat, path[0].lng),
      content: '<div style="display:flex;flex-direction:column;align-items:center"><div style="font-size:28px;line-height:1">🚩</div><div style="background:#22c55e;color:white;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;margin-top:2px;box-shadow:0 2px 4px rgba(0,0,0,0.2)">출발</div></div>',
      yAnchor: 1.8,
    });
    startOverlay.setMap(kakaoMapRef.current);
    overlaysRef.current.push(startOverlay);

    if (path.length < 2) return;

    const linePath = path.map((p: LatLng) => new kakao.maps.LatLng(p.lat, p.lng));
    polylineRef.current = new kakao.maps.Polyline({
      path: linePath, strokeWeight: 5, strokeColor: '#f97316', strokeOpacity: 0.9, strokeStyle: 'solid',
    });
    polylineRef.current.setMap(kakaoMapRef.current);

    const endOverlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(path[path.length - 1].lat, path[path.length - 1].lng),
      content: '<div style="display:flex;flex-direction:column;align-items:center"><div style="font-size:28px;line-height:1">🏁</div><div style="background:#ef4444;color:white;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;margin-top:2px;box-shadow:0 2px 4px rgba(0,0,0,0.2)">종료</div></div>',
      yAnchor: 1.8,
    });
    endOverlay.setMap(kakaoMapRef.current);
    overlaysRef.current.push(endOverlay);

    calcKmMarkers(path).forEach(m => {
      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(m.pos.lat, m.pos.lng),
        content: `<div style="background:#f97316;color:white;font-size:10px;font-weight:700;padding:3px 8px;border-radius:12px;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid white;white-space:nowrap">${m.km}km</div>`,
        yAnchor: 1.5,
      });
      overlay.setMap(kakaoMapRef.current);
      overlaysRef.current.push(overlay);
    });

    // 기존 경로가 있을 경우 지도 범위 자동 조정
    if (path.length >= 2) {
      const bounds = new kakao.maps.LatLngBounds();
      linePath.forEach((p: any) => bounds.extend(p));
      kakaoMapRef.current.setBounds(bounds);
    }
  }, []);

  // ── 기록 모달 지도 초기화 ─────────────────────────
  useEffect(() => {
    if (!selectedDate || !recForm.ran) return;
    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;
      const kakao = (window as any).kakao;
      if (!kakao) return;

      const initMap = (lat: number, lng: number) => {
        const map = new kakao.maps.Map(mapContainerRef.current, {
          center: new kakao.maps.LatLng(lat, lng),
          level: 4,
        });
        kakaoMapRef.current = map;

        const currentOverlay = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(lat, lng),
          content: '<div style="background:#3b82f6;color:white;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;box-shadow:0 2px 6px rgba(0,0,0,0.3)">📍 현재 위치</div>',
          yAnchor: 2,
        });
        currentOverlay.setMap(map);

        // 지도 초기화 완료 후 기존 경로 복원
        drawPath(pathRef.current);

        let isDragging = false;
        let lastPos: LatLng | null = null;
        const MIN_DIST = 0.005;

        kakao.maps.event.addListener(map, 'mousedown', () => { isDragging = true; });
        kakao.maps.event.addListener(map, 'mouseup', () => { isDragging = false; lastPos = null; });
        kakao.maps.event.addListener(map, 'mousemove', (e: any) => {
          if (!isDragging) return;
          const pos: LatLng = { lat: e.latLng.getLat(), lng: e.latLng.getLng() };
          if (lastPos && haversine(lastPos, pos) < MIN_DIST) return;
          lastPos = pos;
          setRecForm(p => ({ ...p, path: [...p.path, pos] }));
        });
        kakao.maps.event.addListener(map, 'touchstart', () => { isDragging = true; });
        kakao.maps.event.addListener(map, 'touchend', () => { isDragging = false; lastPos = null; });
        kakao.maps.event.addListener(map, 'touchmove', (e: any) => {
          if (!isDragging) return;
          const pos: LatLng = { lat: e.latLng.getLat(), lng: e.latLng.getLng() };
          if (lastPos && haversine(lastPos, pos) < MIN_DIST) return;
          lastPos = pos;
          setRecForm(p => ({ ...p, path: [...p.path, pos] }));
        });
      };

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => initMap(pos.coords.latitude, pos.coords.longitude),
          () => initMap(37.5665, 126.9780)
        );
      } else {
        initMap(37.5665, 126.9780);
      }
    }, 100);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, recForm.ran]);

  // pathRef 동기화 + 경로 변경 시 다시 그리기
  useEffect(() => {
    pathRef.current = recForm.path;
    drawPath(recForm.path);
  }, [recForm.path, drawPath]);

  useEffect(() => {
    if (!selectedDate) { kakaoMapRef.current = null; polylineRef.current = null; overlaysRef.current = []; }
  }, [selectedDate]);

  // ── 상세 모달 지도 ────────────────────────────────
  useEffect(() => {
    if (!detailRecord?.routeJson || !detailMapRef.current) return;
    const timer = setTimeout(() => {
      const kakao = (window as any).kakao;
      if (!kakao || !detailMapRef.current) return;
      const path: LatLng[] = JSON.parse(detailRecord.routeJson!);
      if (path.length === 0) return;

      const center = path[Math.floor(path.length / 2)];
      const map = new kakao.maps.Map(detailMapRef.current, {
        center: new kakao.maps.LatLng(center.lat, center.lng),
        level: 5,
      });

      // 경로
      const linePath = path.map(p => new kakao.maps.LatLng(p.lat, p.lng));
      new kakao.maps.Polyline({
        path: linePath, strokeWeight: 5, strokeColor: '#f97316', strokeOpacity: 0.9, strokeStyle: 'solid',
      }).setMap(map);

      // 출발/종료
      new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(path[0].lat, path[0].lng),
        content: '<div style="font-size:22px">🚩</div>',
        yAnchor: 1.5,
      }).setMap(map);
      new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(path[path.length - 1].lat, path[path.length - 1].lng),
        content: '<div style="font-size:22px">🏁</div>',
        yAnchor: 1.5,
      }).setMap(map);

      // 1km 마커
      calcKmMarkers(path).forEach(m => {
        new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(m.pos.lat, m.pos.lng),
          content: `<div style="background:#f97316;color:white;font-size:10px;font-weight:700;padding:2px 7px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.3);border:2px solid white">${m.km}km</div>`,
          yAnchor: 1.5,
        }).setMap(map);
      });

      // 지도 범위 자동 조정
      const bounds = new kakao.maps.LatLngBounds();
      linePath.forEach(p => bounds.extend(p));
      map.setBounds(bounds);
    }, 100);
    return () => clearTimeout(timer);
  }, [detailRecord]);

  const moveMonth = (delta: number) => {
    setYm(prev => {
      let m = prev.month + delta;
      let y = prev.year;
      if (m > 12) { m = 1; y++; }
      if (m < 1) { m = 12; y--; }
      return { year: y, month: m };
    });
  };

  const moveWeek = (delta: number) => {
    setWeekStart(prev => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + delta * 7);
      return next;
    });
  };

  const moveYear = (delta: number) => setSelectedYear(prev => prev + delta);

  const navLabel = tab === '주'
    ? `${weekStart.getMonth() + 1}월 ${getWeekOfMonth(weekStart)}주차`
    : tab === '년'
    ? `${selectedYear}년`
    : `${year}년 ${month}월`;

  const onNavPrev = tab === '주' ? () => moveWeek(-1) : tab === '년' ? () => moveYear(-1) : () => moveMonth(-1);
  const onNavNext = tab === '주' ? () => moveWeek(1) : tab === '년' ? () => moveYear(1) : () => moveMonth(1);

  const totalDist2 = Math.round(totalDist * 10) / 10;

  return (
    <div className="flex flex-col gap-0 bg-slate-50 dark:bg-dark-bg min-h-full">

      {/* ── 탭 ── */}
      <div className="bg-white dark:bg-dark-card border-b border-slate-200 dark:border-dark-border px-4 pt-4 pb-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold dark:text-dark-text">활동</h1>
          <button
            onClick={() => { setGoalForm({ targetCount: goal?.targetCount ?? 12, targetDistanceKm: goal?.targetDistanceKm != null ? String(goal.targetDistanceKm) : '' }); setShowGoalModal(true); }}
            className="text-sm text-primary-500 font-semibold"
          >
            목표 설정
          </button>
        </div>
        <div className="flex gap-1">
          {(['주', '월', '년'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                tab === t ? 'bg-orange-500 text-white' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── 네비게이션 ── */}
      <div className="bg-white dark:bg-dark-card px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <button onClick={onNavPrev} className="text-slate-400 text-lg">‹</button>
          <span className="text-base font-semibold dark:text-dark-text">{navLabel}</span>
          <button onClick={onNavNext} className="text-slate-400 text-lg">›</button>
        </div>
      </div>

      {/* ── 총 거리 + 통계 ── */}
      <div className="bg-white dark:bg-dark-card px-4 pb-4">
        <div className="mb-3">
          <span className="text-6xl font-black text-slate-900 dark:text-dark-text tracking-tight">{totalDist2}</span>
          <span className="text-slate-400 dark:text-slate-500 text-sm ml-2">킬로미터</span>
        </div>
        <div className="flex gap-8">
          <div>
            <p className="text-xl font-bold dark:text-dark-text">{ranRecords.length}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">러닝</p>
          </div>
          <div>
            <p className="text-xl font-bold dark:text-dark-text">{avgPace}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">평균 페이스</p>
          </div>
          <div>
            <p className="text-xl font-bold dark:text-dark-text">{formatDuration(totalSecs || undefined)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">시간</p>
          </div>
        </div>
      </div>

      {/* ── 바 차트 ── */}
      <div className="bg-white dark:bg-dark-card px-2 pb-4 mt-0.5">
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={chartData} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
              ticks={[1, 5, 10, 15, 20, 25, 30]} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(v: any) => [`${v}km`, '거리']}
              contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Bar dataKey="dist" radius={[3, 3, 0, 0]} maxBarSize={20}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.dist > 0 ? '#f97316' : '#e2e8f0'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── 목표 달성률 ── */}
      {goal && (
        <div className="bg-white dark:bg-dark-card px-4 py-4 mt-0.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold dark:text-dark-text">이번 달 목표</span>
            <span className="text-sm text-slate-400">{goal.achievedCount} / {goal.targetCount}회</span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-1">
            <div className="h-2 rounded-full bg-orange-500 transition-all"
              style={{ width: `${Math.min(100, (goal.achievedCount / goal.targetCount) * 100)}%` }} />
          </div>
          {goal.streak > 0 && (
            <p className="text-sm text-orange-500 font-semibold mt-2">🔥 {goal.streak}일 연속 달성 중</p>
          )}
        </div>
      )}

      {/* ── 달력 (월 탭에서만 표시) ── */}
      {tab === '월' && <div className="bg-white dark:bg-dark-card px-4 py-4 mt-0.5">
        <p className="text-sm font-semibold dark:text-dark-text mb-3">날짜별 기록</p>
        <div className="grid grid-cols-7 gap-1 text-center max-w-sm mx-auto w-full">
          {['일','월','화','수','목','금','토'].map((d, i) => (
            <div key={d} className={`text-xs font-bold py-1 ${i===0?'text-red-400':i===6?'text-blue-400':'text-slate-400'}`}>{d}</div>
          ))}
          {(() => {
            const firstDay = new Date(year, month - 1, 1).getDay();
            const daysInM = new Date(year, month, 0).getDate();
            const cells: (number|null)[] = [...Array(firstDay).fill(null), ...Array.from({length:daysInM},(_,i)=>i+1)];
            while (cells.length % 7 !== 0) cells.push(null);
            return cells.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} />;
              const ds = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const rec = records.find(r => r.runDate === ds);
              const isFuture = ds > todayStr;
              const isToday = ds === todayStr;
              return (
                <button key={ds} onClick={() => !isFuture && openRecord(ds)}
                  disabled={isFuture}
                  className={`aspect-square rounded-full flex items-center justify-center text-xs font-semibold transition-colors
                    ${isToday ? 'ring-2 ring-orange-500' : ''}
                    ${rec?.ran ? 'bg-orange-500 text-white' : rec?.ran === false ? 'bg-slate-200 dark:bg-slate-700 text-slate-400' : 'text-slate-700 dark:text-dark-text hover:bg-slate-100 dark:hover:bg-slate-800'}
                    ${isFuture ? 'opacity-30' : ''}
                  `}>
                  {day}
                </button>
              );
            });
          })()}
        </div>
      </div>}

      {/* ── 최근 활동 ── */}
      {recentActivities.length > 0 && (
        <div className="bg-white dark:bg-dark-card px-4 py-4 mt-0.5">
          <p className="text-sm font-semibold dark:text-dark-text mb-3">최근 활동</p>
          <div className="flex flex-col divide-y divide-slate-100 dark:divide-dark-border">
            {recentActivities.map(rec => (
              <button key={rec.id} onClick={() => setDetailRecord(rec)}
                className="flex items-center gap-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors -mx-4 px-4">
                {/* 썸네일 */}
                <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {rec.routeJson
                    ? <span className="text-2xl">🗺️</span>
                    : <span className="text-2xl">🏃</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold dark:text-dark-text truncate">{rec.title || `${getDayLabel(rec.runDate)} 러닝`}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{rec.runDate} · {getDayLabel(rec.runDate)}</p>
                  <div className="flex gap-3 mt-1">
                    {rec.distanceKm && <span className="text-xs text-slate-500 dark:text-slate-400">{rec.distanceKm}km</span>}
                    {rec.pace && <span className="text-xs text-slate-500 dark:text-slate-400">{rec.pace}/km</span>}
                    {rec.durationSeconds && <span className="text-xs text-slate-500 dark:text-slate-400">{formatDuration(rec.durationSeconds)}</span>}
                  </div>
                </div>
                <span className="text-slate-300 dark:text-slate-600">›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="h-6" />

      {/* ── 기록 모달 ── */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-dark-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-5 border-b border-slate-200 dark:border-dark-border flex items-center justify-between">
              <h2 className="text-base font-bold dark:text-dark-text">{selectedDate} 운동 기록</h2>
              <button onClick={() => setSelectedDate(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="p-5 flex flex-col gap-4">

              {/* 뛰었는지 */}
              <div className="flex gap-3">
                <button onClick={() => setRecForm(p => ({ ...p, ran: true }))}
                  className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${recForm.ran ? 'bg-orange-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                  ✅ 뛰었어요
                </button>
                <button onClick={() => setRecForm(p => ({ ...p, ran: false, path: [] }))}
                  className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${!recForm.ran ? 'bg-red-400 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                  ❌ 쉬었어요
                </button>
              </div>

              {recForm.ran && (
                <>
                  {/* 제목 */}
                  <input type="text" value={recForm.title}
                    onChange={e => setRecForm(p => ({ ...p, title: e.target.value }))}
                    placeholder={`${getDayLabel(selectedDate)} 러닝`}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 bg-transparent dark:text-dark-text focus:outline-none focus:border-orange-400 text-base font-semibold" />

                  {/* 지도 — 현재 위치 표시 */}
                  <div>
                    <p className="text-sm font-semibold dark:text-dark-text mb-2">현재 위치</p>
                    <div ref={mapContainerRef} className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700" style={{ width: '100%', height: '200px' }} />
                  </div>

                  {/* 스탯 입력 그리드 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 dark:text-slate-500 mb-1 block">거리 (km)</label>
                      <input type="number" step="0.01" value={recForm.distanceKm}
                        onChange={e => setRecForm(p => ({ ...p, distanceKm: e.target.value }))}
                        placeholder="5.13"
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-transparent dark:text-dark-text focus:outline-none focus:border-orange-400 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 dark:text-slate-500 mb-1 block">시간 (분:초)</label>
                      <input type="text" value={recForm.duration}
                        onChange={e => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                          const formatted = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
                          setRecForm(p => ({ ...p, duration: formatted }));
                        }}
                        placeholder="36:22"
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-transparent dark:text-dark-text focus:outline-none focus:border-orange-400 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-slate-400 dark:text-slate-500 mb-1 block">평균 페이스 (자동계산)</label>
                      <div className="w-full border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-orange-500">
                        {calcLivePace()} <span className="text-xs font-normal text-slate-400">/km</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 dark:text-slate-500 mb-1 block">칼로리 (kcal)</label>
                      <input type="number" value={recForm.calories}
                        onChange={e => setRecForm(p => ({ ...p, calories: e.target.value }))}
                        placeholder="368"
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-transparent dark:text-dark-text focus:outline-none focus:border-orange-400 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 dark:text-slate-500 mb-1 block">고도 상승 (m)</label>
                      <input type="number" value={recForm.elevationGain}
                        onChange={e => setRecForm(p => ({ ...p, elevationGain: e.target.value }))}
                        placeholder="18"
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-transparent dark:text-dark-text focus:outline-none focus:border-orange-400 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 dark:text-slate-500 mb-1 block">평균 심박수 (bpm)</label>
                      <input type="number" value={recForm.avgHeartRate}
                        onChange={e => setRecForm(p => ({ ...p, avgHeartRate: e.target.value }))}
                        placeholder="155"
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-transparent dark:text-dark-text focus:outline-none focus:border-orange-400 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 dark:text-slate-500 mb-1 block">케이던스 (spm)</label>
                      <input type="number" value={recForm.cadence}
                        onChange={e => setRecForm(p => ({ ...p, cadence: e.target.value }))}
                        placeholder="170"
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-transparent dark:text-dark-text focus:outline-none focus:border-orange-400 text-sm" />
                    </div>
                  </div>
                </>
              )}

              {/* 메모 */}
              <div>
                <label className="text-xs text-slate-400 dark:text-slate-500 mb-1 block">메모</label>
                <textarea value={recForm.memo} onChange={e => setRecForm(p => ({ ...p, memo: e.target.value }))}
                  placeholder="오늘 운동 기록..." rows={2}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-transparent dark:text-dark-text focus:outline-none focus:border-orange-400 resize-none text-sm" />
              </div>

              <button onClick={saveRecord}
                className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors">
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 상세 모달 (NRC 스타일) ── */}
      {detailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-dark-card rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* 헤더 */}
            <div className="p-5 flex items-center justify-between">
              <button onClick={() => setDetailRecord(null)} className="text-slate-400 hover:text-slate-600 text-xl">‹</button>
              <button onClick={() => { setDetailRecord(null); openRecord(detailRecord.runDate); }}
                className="text-slate-400 hover:text-slate-600 text-sm">✏️ 수정</button>
            </div>

            <div className="px-5 pb-6">
              {/* 날짜 + 제목 */}
              <p className="text-xs text-slate-400 mb-1">{getDayLabel(detailRecord.runDate)} · {detailRecord.runDate}</p>
              <p className="text-xl font-bold dark:text-dark-text mb-4">{detailRecord.title || `${getDayLabel(detailRecord.runDate)} 러닝`}</p>

              {/* 거리 큰 숫자 */}
              <div className="mb-4">
                <span className="text-6xl font-black text-slate-900 dark:text-dark-text tracking-tight">{detailRecord.distanceKm ?? '--'}</span>
                <span className="text-slate-400 text-sm ml-2">킬로미터</span>
              </div>

              {/* 스탯 그리드 */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: '평균 페이스', value: detailRecord.pace || '--', unit: '/km' },
                  { label: '시간', value: formatDuration(detailRecord.durationSeconds), unit: '' },
                  { label: '칼로리', value: detailRecord.calories ?? '--', unit: 'kcal' },
                  { label: '고도 상승', value: detailRecord.elevationGain != null ? `${detailRecord.elevationGain}m` : '--', unit: '' },
                  { label: '평균 심박수', value: detailRecord.avgHeartRate ?? '--', unit: detailRecord.avgHeartRate ? 'bpm' : '' },
                  { label: '케이던스', value: detailRecord.cadence ?? '--', unit: detailRecord.cadence ? 'spm' : '' },
                ].map(stat => (
                  <div key={stat.label}>
                    <p className="text-lg font-bold dark:text-dark-text">{stat.value}<span className="text-xs font-normal text-slate-400 ml-0.5">{stat.unit}</span></p>
                    <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* 지도 */}
              {detailRecord.routeJson && (
                <div ref={detailMapRef} className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700" style={{ width: '100%', height: '240px' }} />
              )}

              {/* 메모 */}
              {detailRecord.memo && (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">{detailRecord.memo}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 목표 설정 모달 ── */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-dark-card rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-5 border-b border-slate-200 dark:border-dark-border flex items-center justify-between">
              <h2 className="text-base font-bold dark:text-dark-text">{year}년 {month}월 목표</h2>
              <button onClick={() => setShowGoalModal(false)} className="text-slate-400 text-xl">✕</button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">목표 횟수 (회)</label>
                <input type="number" value={goalForm.targetCount}
                  onChange={e => setGoalForm(p => ({ ...p, targetCount: parseInt(e.target.value) || 0 }))}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 bg-transparent dark:text-dark-text focus:outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">목표 거리 (km, 선택)</label>
                <input type="number" step="0.1" value={goalForm.targetDistanceKm}
                  onChange={e => setGoalForm(p => ({ ...p, targetDistanceKm: e.target.value }))}
                  placeholder="50"
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 bg-transparent dark:text-dark-text focus:outline-none focus:border-orange-400" />
              </div>
              <button onClick={async () => {
                await api.post('/running/goal', { year, month, targetCount: goalForm.targetCount, targetDistanceKm: goalForm.targetDistanceKm ? parseFloat(goalForm.targetDistanceKm) : null });
                setShowGoalModal(false); fetchData(year, month);
              }} className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors">
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
