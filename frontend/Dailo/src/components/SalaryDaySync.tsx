import { useEffect } from 'react';
import api, { getStoredMemberId } from '../api/axios';

// 월급일(정산월 기준)은 로그인 때 localStorage에 저장하고 getCurrentSettleMonth가 그 값을 씀
//  다른 기기에서 월급일을 바꾸면 이 기기 정산월이 서버와 어긋났음 → 앱을 열 때 서버 값으로 맞추고, 바뀌었으면 한 번 새로고침
//  (페이지들이 마운트 때 정산월을 계산해 두기 때문). 탭마다 한 번만 (sessionStorage) — 새로고침 반복 방지
const FLAG = 'salaryDaySynced';

export const SalaryDaySync = () => {
  useEffect(() => {
    if (sessionStorage.getItem(FLAG)) return;
    const memberId = getStoredMemberId();
    if (!memberId) return;
    api.get(`/members/${memberId}`).then(res => {
      sessionStorage.setItem(FLAG, '1');
      const day = res.data?.data?.salaryDay;
      if (typeof day !== 'number' || day < 1 || day > 31) return;
      if (localStorage.getItem('salaryDay') !== String(day)) {
        localStorage.setItem('salaryDay', String(day));
        window.location.reload();
      }
    }).catch(() => { /* 실패하면 기존 값 유지 */ });
  }, []);
  return null;
};
