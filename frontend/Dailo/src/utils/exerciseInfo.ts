// 기본 종목 상세 정보 + 동작 이미지
// 1순위 일러스트: Everkinetic (CC BY-SA 4.0) https://github.com/everkinetic/data
//   → 라인 드로잉 SVG, 종목마다 relaxation(시작)/tension(수축) 2장 — 배경 투명이라 다크모드는 CSS invert로 흰 선 처리
//   → 라이선스상 저작자 표기 필수: 상세 시트 하단 캡션(ART_CREDIT) 지우지 말 것
// 2순위 사진: free-exercise-db (Unlicense) https://github.com/yuhonas/free-exercise-db — Everkinetic에 없는 종목만
// 두 저장소 모두 jsDelivr 커밋 고정 URL — main/master로 바꾸면 원본 변경 시 경로가 깨질 수 있음
const ART_BASE = 'https://cdn.jsdelivr.net/gh/everkinetic/data@6f3ce86eb79b17e7bbaf588b7960149725bc8fc7/dist/svg';
const PHOTO_BASE = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises';
export const ART_CREDIT = '일러스트: Everkinetic · CC BY-SA 4.0';
export const PHOTO_CREDIT = '사진: free-exercise-db · Public Domain';

export interface ExerciseInfo {
  art?: string;    // Everkinetic id_num (예: '0042')
  photo?: string;  // free-exercise-db id
  equipment: string;
  primary: string[];
  secondary: string[];
  tips: string[];
}

const M: Record<string, string> = {
  abdominals: '복근', abductors: '외전근', adductors: '내전근', biceps: '이두', calves: '종아리', chest: '가슴',
  forearms: '전완', glutes: '둔근', hamstrings: '햄스트링', lats: '광배', 'lower back': '허리', 'middle back': '등 중부',
  neck: '목', quadriceps: '대퇴사두', shoulders: '어깨', traps: '승모', triceps: '삼두',
};
const m = (list: string) => (list ? list.split(',').map(s => M[s.trim()] || s.trim()) : []);
// 일러스트 있는 종목
const A = (art: string, equipment: string, primary: string, secondary: string, tips: string[]): ExerciseInfo =>
  ({ art, equipment, primary: m(primary), secondary: m(secondary), tips });
// 일러스트 없어서 사진으로 대체하는 종목
const P = (photo: string, equipment: string, primary: string, secondary: string, tips: string[]): ExerciseInfo =>
  ({ photo, equipment, primary: m(primary), secondary: m(secondary), tips });

export const EXERCISE_INFO: Record<string, ExerciseInfo> = {
  // 가슴
  '벤치프레스': A('0042', '바벨', 'chest', 'shoulders,triceps', ['견갑을 모으고 가슴을 들어 아치를 만들어요', '바는 명치 쪽으로 천천히 내리고', '발로 바닥을 밀며 수직으로 밀어 올려요']),
  '인클라인 벤치프레스': A('0043', '바벨', 'chest', 'shoulders,triceps', ['벤치 각도는 30~45도', '바는 쇄골 아래 윗가슴으로 내려요', '팔꿈치가 너무 벌어지지 않게 45도 정도 유지']),
  '디클라인 벤치프레스': A('0051', '바벨', 'chest', 'triceps', ['발을 단단히 고정하고 누워요', '바는 가슴 아래쪽으로 내려요', '아랫가슴을 쥐어짜듯 밀어 올려요']),
  '클로즈그립 벤치프레스': A('0049', '바벨', 'triceps', 'chest,shoulders', ['손 간격은 어깨너비보다 좁게', '팔꿈치를 옆구리에 붙여 내려요', '삼두로 밀어 올린다는 느낌']),
  '덤벨 프레스': A('0055', '덤벨', 'chest', 'shoulders,triceps', ['덤벨을 가슴 옆까지 깊게 내려 스트레치', '올릴 때 덤벨끼리 부딪히지 않게', '손목은 꺾지 말고 일직선으로']),
  '인클라인 덤벨 프레스': A('0080', '덤벨', 'chest', 'shoulders,triceps', ['30도 정도 벤치에서 윗가슴을 노려요', '내릴 때 2~3초 버티며 천천히', '정점에서 가슴을 짜듯이 모아요']),
  '덤벨 플라이': A('0056', '덤벨', 'chest', '', ['팔꿈치를 살짝 굽힌 채 고정', '가슴이 늘어나는 느낌까지만 벌려요', '큰 원을 그리듯 모아 올려요']),
  '케이블 크로스오버': A('0048', '케이블', 'chest', 'shoulders', ['상체를 살짝 숙이고 한 발 앞으로', '손을 몸 앞 아래쪽으로 모아요', '돌아갈 때 반동 없이 천천히']),
  '체스트 프레스': A('0066', '머신', 'chest', 'shoulders,triceps', ['손잡이가 가슴 중앙 높이에 오게 의자 조절', '등을 등받이에 붙이고 밀어요', '팔을 끝까지 잠그지 않아요']),
  '덤벨 풀오버': A('0046', '덤벨', 'chest', 'lats,triceps', ['벤치에 등을 대고 덤벨 하나를 두 손으로', '팔꿈치를 살짝 굽힌 채 머리 뒤로 내려요', '가슴과 광배가 늘어나는 걸 느끼며 올려요']),
  '딥스': A('0054', '맨몸', 'chest', 'shoulders,triceps', ['상체를 앞으로 기울이면 가슴에 집중', '어깨가 아프지 않은 깊이까지만', '올라올 때 팔꿈치를 완전히 펴지 않아요']),
  '푸시업': A('0077', '맨몸', 'chest', 'shoulders,triceps', ['머리부터 발끝까지 일직선', '가슴이 바닥에 닿을 듯 내려가요', '손은 어깨보다 조금 넓게']),
  // 등
  '데드리프트': A('0099', '바벨', 'lower back', 'glutes,hamstrings,lats,traps,quadriceps', ['바는 정강이에 붙이고 시작', '허리를 곧게 편 채 바닥을 밀어 일어나요', '내릴 때도 바가 몸에서 멀어지지 않게']),
  '바벨 로우': A('0026', '바벨', 'middle back', 'lats,biceps,shoulders', ['상체를 45도 정도 숙이고 허리 고정', '바를 배꼽 쪽으로 당겨요', '팔이 아니라 팔꿈치로 당긴다는 느낌']),
  '랫풀다운': A('0096', '케이블', 'lats', 'biceps,middle back', ['가슴을 들고 살짝 뒤로 기대요', '바를 쇄골 쪽으로 당기며 견갑을 내려요', '올라갈 때 광배가 늘어나는 걸 느껴요']),
  '풀업': A('0087', '맨몸', 'lats', 'biceps,middle back', ['어깨를 귀에서 멀리 내리며 시작', '턱이 바를 넘을 때까지 당겨요', '반동 없이 천천히 내려와요']),
  '친업': A('0090', '맨몸', 'lats', 'biceps', ['손바닥이 나를 보게 잡아요', '가슴을 바 쪽으로 끌어올려요', '이두와 광배를 같이 써요']),
  '시티드 케이블 로우': A('0025', '케이블', 'middle back', 'lats,biceps', ['허리를 세우고 상체 고정', '손잡이를 배꼽으로 당기며 견갑을 모아요', '돌아갈 때 어깨가 앞으로 말리지 않게']),
  '원암 덤벨 로우': P('One-Arm_Dumbbell_Row', '덤벨', 'middle back', 'lats,biceps', ['벤치에 한 손·한 무릎을 대고 등은 평평하게', '덤벨을 골반 쪽으로 당겨요', '몸통이 돌아가지 않게 버텨요']),
  '티바 로우': A('0029', '바벨', 'middle back', 'lats,biceps', ['무릎을 살짝 굽히고 허리 고정', '손잡이를 가슴 아래로 당겨요', '정점에서 1초 쥐어짜요']),
  '백 익스텐션': A('0103', '맨몸', 'lower back', 'glutes,hamstrings', ['골반을 패드에 걸치고 발을 고정', '허리를 둥글게 말지 말고 엉덩이로 접어요', '몸이 일직선이 될 때까지만 올라와요']),
  // 하체
  '스쿼트': A('0122', '바벨', 'quadriceps', 'glutes,hamstrings,lower back', ['발은 어깨너비, 발끝은 살짝 바깥', '엉덩이를 뒤로 빼며 허벅지가 평행할 때까지', '무릎은 발끝 방향으로, 발 전체로 밀어 올라와요']),
  '해크 스쿼트': A('0123', '머신', 'quadriceps', 'glutes,hamstrings', ['등을 패드에 붙이고 발은 어깨너비', '무릎이 90도보다 깊게 내려가요', '뒤꿈치로 밀며 올라와요']),
  '레그 프레스': A('0127', '머신', 'quadriceps', 'glutes,hamstrings', ['허리와 엉덩이를 등받이에서 떼지 않아요', '무릎이 가슴 쪽으로 올 만큼 내려요', '무릎을 완전히 잠그지 않아요']),
  '런지': A('0115', '덤벨', 'quadriceps', 'glutes,hamstrings', ['보폭은 넓게, 상체는 곧게', '뒷무릎이 바닥에 닿을 듯 내려가요', '앞발 뒤꿈치로 밀며 일어나요']),
  '스텝업': A('0137', '덤벨', 'quadriceps', 'glutes,hamstrings', ['무릎 높이 박스에 한 발을 올려요', '올린 발 뒤꿈치로 밀어 올라가요', '뒷발로 튕기지 않아요']),
  '루마니안 데드리프트': A('0118', '바벨', 'hamstrings', 'glutes,lower back', ['무릎은 살짝만 굽히고 고정', '엉덩이를 뒤로 빼며 바를 허벅지 따라 내려요', '햄스트링이 당기면 엉덩이를 밀며 올라와요']),
  '굿모닝': A('0101', '바벨', 'hamstrings', 'glutes,lower back', ['바를 어깨에 메고 무릎은 살짝 굽혀요', '허리를 편 채 인사하듯 상체를 숙여요', '가벼운 무게로 시작해요']),
  '레그 익스텐션': A('0142', '머신', 'quadriceps', '', ['무릎 관절이 머신 축과 맞게 조절', '정점에서 1초 멈춰 허벅지를 쥐어짜요', '내릴 때 천천히 버텨요']),
  '레그 컬': A('0117', '머신', 'hamstrings', '', ['골반을 패드에 붙여 들리지 않게', '뒤꿈치를 엉덩이 쪽으로 끝까지', '반동 없이 천천히 내려요']),
  '시티드 레그 컬': A('0119', '머신', 'hamstrings', '', ['허벅지 패드로 다리를 단단히 고정', '발목을 의자 아래로 끝까지 당겨요', '돌아갈 때 천천히']),
  '힙 쓰러스트': P('Barbell_Hip_Thrust', '바벨', 'glutes', 'hamstrings', ['등 윗부분을 벤치에 걸치고 시작', '턱을 당기고 골반을 끝까지 밀어 올려요', '정점에서 엉덩이를 1초 쥐어짜요']),
  '카프 레이즈': A('0282', '머신', 'calves', '', ['발 앞쪽만 발판에 올려요', '뒤꿈치를 최대한 내렸다가 끝까지 올려요', '정점에서 잠깐 멈춰요']),
  // 어깨
  '오버헤드 프레스': A('0004', '바벨', 'shoulders', 'triceps', ['엉덩이와 복부에 힘을 주고 버텨요', '바를 머리 위로 수직으로 밀어 올려요', '바가 지나갈 때 머리를 살짝 뒤로']),
  '덤벨 숄더 프레스': A('0031', '덤벨', 'shoulders', 'triceps', ['덤벨을 귀 높이에서 시작', '머리 위에서 살짝 모이게 밀어요', '허리가 과하게 꺾이지 않게']),
  '사이드 레터럴 레이즈': A('0018', '덤벨', 'shoulders', '', ['팔꿈치를 살짝 굽히고 옆으로 들어요', '어깨 높이까지만, 승모가 들리지 않게', '내릴 때 천천히 버텨요']),
  '프론트 레이즈': A('0033', '덤벨', 'shoulders', '', ['팔을 앞으로 어깨 높이까지', '몸을 흔들어 반동 쓰지 않아요', '한 팔씩 번갈아 해도 좋아요']),
  '리어 델트 플라이': A('0032', '덤벨', 'shoulders', '', ['상체를 깊게 숙이고 등은 평평하게', '새끼손가락이 위로 가듯 옆으로 벌려요', '견갑이 아니라 어깨 뒤로 들어요']),
  '업라이트 로우': A('0014', '바벨', 'shoulders', 'traps', ['손 간격은 어깨너비', '팔꿈치가 손보다 높게 가슴 높이까지 당겨요', '어깨가 불편하면 높이를 낮춰요']),
  '슈러그': A('0005', '덤벨', 'traps', '', ['팔은 편 채로 어깨만 귀 쪽으로', '정점에서 1~2초 멈춰요', '어깨를 돌리지 말고 수직으로']),
  '페이스 풀': P('Face_Pull', '케이블', 'shoulders', 'middle back', ['로프를 얼굴 높이로 당겨요', '손이 귀 옆으로 벌어지며 바깥으로 회전', '정점에서 1초 멈춰요']),
  // 팔
  '바벨 컬': A('0211', '바벨', 'biceps', 'forearms', ['팔꿈치를 옆구리에 고정', '상체 반동 없이 말아 올려요', '내릴 때 끝까지 천천히']),
  '덤벨 컬': A('0224', '덤벨', 'biceps', 'forearms', ['올리면서 손바닥이 위를 보게 돌려요', '팔꿈치가 앞으로 나오지 않게', '한 팔씩 번갈아 해도 좋아요']),
  '해머 컬': A('0227', '덤벨', 'biceps', 'forearms', ['손바닥이 서로 마주 보게 잡아요', '팔꿈치를 고정하고 들어 올려요', '전완과 상완근까지 같이 자극돼요']),
  '프리처 컬': A('0239', '바벨', 'biceps', '', ['겨드랑이를 패드 위에 밀착', '팔을 끝까지 펴지 말고 살짝 남겨요', '정점에서 이두를 쥐어짜요']),
  '컨센트레이션 컬': A('0220', '덤벨', 'biceps', '', ['앉아서 팔꿈치를 허벅지 안쪽에 대요', '어깨는 움직이지 말고 팔만 말아요', '천천히 내려 이두를 늘려요']),
  '케이블 푸시다운': A('0205', '케이블', 'triceps', '', ['팔꿈치를 옆구리에 붙이고 고정', '팔을 끝까지 펴며 삼두를 쥐어짜요', '올라갈 때 팔꿈치가 들리지 않게']),
  '라잉 트라이셉스 익스텐션': A('0183', '바벨', 'triceps', '', ['누워서 팔을 수직으로 들고 시작', '팔꿈치만 굽혀 바를 이마 쪽으로', '팔꿈치가 벌어지지 않게 유지']),
  '오버헤드 트라이셉스 익스텐션': A('0201', '바벨', 'triceps', '', ['머리 뒤로 바를 내리며 시작', '팔꿈치를 앞으로 고정하고 펴요', '삼두 장두가 늘어나는 걸 느껴요']),
  '트라이셉스 킥백': A('0204', '덤벨', 'triceps', '', ['상체를 숙이고 상완을 몸통과 나란히', '팔꿈치 아래만 뒤로 펴요', '정점에서 1초 멈춰요']),
  // 복근
  '크런치': A('0291', '맨몸', 'abdominals', '', ['허리는 바닥에 붙인 채', '갈비뼈를 골반 쪽으로 말아 올려요', '목을 당기지 않아요']),
  '케이블 크런치': A('0288', '케이블', 'abdominals', '', ['로프를 머리 옆에 두고 시작', '엉덩이는 고정하고 복근으로 몸을 말아요', '천천히 돌아와요']),
  '레그 레이즈': A('0021', '맨몸', 'abdominals', '', ['벤치나 바닥에 누워 허리를 붙여요', '다리를 붙인 채 수직까지 들어요', '내릴 때 바닥에 닿기 직전까지만']),
  '행잉 레그 레이즈': P('Hanging_Leg_Raise', '맨몸', 'abdominals', '', ['몸이 흔들리지 않게 매달려요', '골반을 말아 올리듯 다리를 들어요', '내릴 때 천천히 버텨요']),
  '플랭크': P('Plank', '맨몸', 'abdominals', '', ['팔꿈치는 어깨 바로 아래', '머리부터 발끝까지 일직선', '엉덩이가 처지거나 들리지 않게 — 세트는 회 대신 초로 기록']),
  '사이드 플랭크': A('0113', '맨몸', 'abdominals', '', ['팔꿈치를 어깨 아래에 두고 옆으로 버텨요', '골반이 처지지 않게 들어 올려요', '양쪽 같은 시간 — 회 대신 초로 기록']),
  'AB 롤아웃': A('0285', '바벨', 'abdominals', 'shoulders', ['무릎을 꿇고 시작해도 충분해요', '허리가 꺾이지 않는 곳까지만 굴려요', '복근 힘으로 끌어와요']),
};

export const getExerciseInfo = (name: string): ExerciseInfo | null => {
  const key = name.replace(/\s/g, '');
  return Object.entries(EXERCISE_INFO).find(([k]) => k.replace(/\s/g, '') === key)?.[1] ?? null;
};

// [시작 자세, 수축 자세] + 종류 — art는 라인 드로잉(다크모드 invert 대상), photo는 실사
export const exerciseImages = (info: ExerciseInfo): { kind: 'art' | 'photo'; frames: [string, string] } =>
  info.art
    ? { kind: 'art', frames: [`${ART_BASE}/${info.art}-relaxation.svg`, `${ART_BASE}/${info.art}-tension.svg`] }
    : { kind: 'photo', frames: [`${PHOTO_BASE}/${info.photo}/0.jpg`, `${PHOTO_BASE}/${info.photo}/1.jpg`] };
