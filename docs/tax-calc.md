# 세액공제 최적화 계산기 상세 스펙 (참고자료)

## 파일 구조
- **계산 로직**: `frontend/Dailo/src/utils/taxCalc.ts` — 순수 함수, 두 페이지에서 공유
- **계산기 UI**: `src/pages/BudgetSettingsPage.tsx` 하단 — 실수령액 자동 연동, 결과 읽기 전용
- **요약 카드**: `src/pages/InvestSettingsPage.tsx` 상단 — localStorage에서 결과 읽어 표시

## localStorage 키 (`taxCalc.ts` 상수)
- `taxCalcInputs`: `{ isProbation, probEndMonth, joinMonth }` — 입력값 유지
- `taxCalcResult`: `TaxCalcResult` 전체 객체 — 투자설정 요약 카드가 읽음

## 입력값 (BudgetSettingsPage)
- 실수령액: 이미 입력된 `netSalary` 상태 자동 사용 (중복 입력 없음)
- 입사월, 수습 여부, 수습 종료 예정월 → lazy useState로 localStorage 복원

## 역산: 실수령액 → 세전 월급 (`calcGrossFromNet`)
4대보험 공제율 (직원 부담분):
- 국민연금 4.5% / 건강보험 3.545% / 장기요양 = 건강보험×12.81% / 고용보험 0.9%
- 소득세+지방소득세 = `calcAnnualTax(gross×12) / 12`
- 위 5항목 합산이 (gross - net)에 수렴할 때까지 반복 (최대 80회, 허용오차 10원)

수습 체크 시: `probGross = calcGrossFromNet(net)` → `regGross = probGross / 0.8`
수습 없음: `regGross = calcGrossFromNet(net)`

## 연간 소득세 (`calcAnnualTax`)
1. **근로소득공제** (소득세법 §47):
   - ≤500만: ×70% / 500~1,500만: 350만+초과×40% / 1,500~4,500만: 750만+초과×15%
   - 4,500~1억: 1,200만+초과×5% / >1억: 1,475만 (한도)
2. **과세표준** = 총급여 − 근로소득공제 − 기본인적공제 150만
3. **누진세율** (소득세법 §55):
   ≤1,400만 6% / ~5,000만 15% / ~8,800만 24% / ~1.5억 35% / ~3억 38% / ~5억 40% / ~10억 42% / 초과 45%
   (누진공제: 0/84만/624만/1,536만/3,706만/9,406만/17,406만/38,406만)
4. **근로소득세액공제** (소득세법 §59): 산출세액 ≤50만→×55%, 초과→27.5만+초과×30%
   한도 (간소화): 총급여 ≤3,300만=74만 / ≤7,000만=66만 / 초과=50만
   ※ 3,300만~4,300만 구간은 실제 법 기준 슬라이딩 스케일이 있으나 간소화 적용 — 최대 8.8만원 과대추정 허용 오차
5. **반환값** = (산출세액 − 세액공제) × 1.1 — 지방소득세 10% 포함 (세액공제율 16.5%=15%×1.1과 정합)

## 세액공제율
- 총급여(=regGross×12) ≤5,500만 → **16.5%** / 초과 → **13.2%**

## 연금저축 추천납입액
- `pensionAnnual = min(annualTax / creditRate, 600만)` (만원 단위 반올림)
- `pensionRefund = pensionAnnual × creditRate`
- `pensionMonthly = pensionAnnual / remainMonths` (remainMonths = 13 − 입사월)

## IRP 추천납입액
- `remainTax = annualTax − pensionRefund`
- remainTax ≤ 0 → **IRP 불필요** (연금저축 600만으로 소득세 전액 상계)
- remainTax > 0 → `irpAnnual = min(remainTax / creditRate, 300만)`, `irpMonthly = irpAnnual / remainMonths`

ISA는 세액공제 없으므로 안내 문구만 표시.