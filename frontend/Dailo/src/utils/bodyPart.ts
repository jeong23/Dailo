// 종목명 → 운동 부위 분류 (번핏식 부위별 분석용)
// DB에 부위 컬럼이 없어서 프론트에서 기본 종목 목록 → 키워드 순으로 추정한다.
export type BodyPart = '가슴' | '등' | '하체' | '어깨' | '팔' | '복근' | '기타';

export const BODY_PARTS: BodyPart[] = ['가슴', '등', '하체', '어깨', '팔', '복근', '기타'];

export const BODY_PART_COLOR: Record<BodyPart, string> = {
  가슴: '#f43f5e', 등: '#3b82f6', 하체: '#10b981', 어깨: '#f59e0b', 팔: '#8b5cf6', 복근: '#06b6d4', 기타: '#94a3b8',
};

// 종목 추가 시트에 보여줄 기본 종목
export const EXERCISE_LIBRARY: Record<Exclude<BodyPart, '기타'>, string[]> = {
  가슴: ['벤치프레스', '인클라인 벤치프레스', '디클라인 벤치프레스', '클로즈그립 벤치프레스', '덤벨 프레스', '인클라인 덤벨 프레스', '덤벨 플라이', '케이블 크로스오버', '체스트 프레스', '덤벨 풀오버', '딥스', '푸시업'],
  등: ['데드리프트', '바벨 로우', '랫풀다운', '풀업', '친업', '시티드 케이블 로우', '원암 덤벨 로우', '티바 로우', '백 익스텐션'],
  하체: ['스쿼트', '해크 스쿼트', '레그 프레스', '런지', '스텝업', '루마니안 데드리프트', '굿모닝', '레그 익스텐션', '레그 컬', '시티드 레그 컬', '힙 쓰러스트', '카프 레이즈'],
  어깨: ['오버헤드 프레스', '덤벨 숄더 프레스', '사이드 레터럴 레이즈', '프론트 레이즈', '리어 델트 플라이', '업라이트 로우', '슈러그', '페이스 풀'],
  팔: ['바벨 컬', '덤벨 컬', '해머 컬', '프리처 컬', '컨센트레이션 컬', '케이블 푸시다운', '라잉 트라이셉스 익스텐션', '오버헤드 트라이셉스 익스텐션', '트라이셉스 킥백'],
  복근: ['크런치', '케이블 크런치', '레그 레이즈', '행잉 레그 레이즈', '플랭크', '사이드 플랭크', 'AB 롤아웃'],
};

const LIBRARY_INDEX: Record<string, BodyPart> = Object.fromEntries(
  Object.entries(EXERCISE_LIBRARY).flatMap(([part, names]) => names.map(n => [n.replace(/\s/g, ''), part as BodyPart]))
);

// 순서가 중요: '레그 레이즈'(복근) → '레그'(하체) → '트라이셉스'(팔) → '오버헤드'(어깨) ...
const KEYWORDS: [BodyPart, RegExp][] = [
  ['복근', /크런치|레그레이즈|플랭크|싯업|복근|롤아웃|crunch|plank|situp/i],
  ['하체', /스쿼트|레그|런지|힙|카프|둔근|squat|leg|lunge|hip|calf/i],
  ['팔', /트라이셉스|삼두|이두|바이셉|컬|푸시다운|킥백|curl|tricep|bicep|pushdown/i],
  ['어깨', /숄더|오버헤드|밀리터리|레터럴|레이즈|델트|페이스풀|shoulder|overhead|lateral|delt/i],
  ['가슴', /벤치|체스트|플라이|크로스오버|딥스|푸시업|인클라인|디클라인|펙덱|bench|chest|fly|dip|push ?up/i],
  ['등', /데드|로우|풀업|턱걸이|친업|랫|풀다운|dead|row|pull ?up|chin|lat/i],
];

export const getBodyPart = (name: string): BodyPart => {
  const key = name.replace(/\s/g, '');
  if (!key) return '기타';
  if (LIBRARY_INDEX[key]) return LIBRARY_INDEX[key];
  for (const [part, re] of KEYWORDS) if (re.test(key)) return part;
  return '기타';
};

// Epley 공식 추정 1RM
export const estimate1RM = (weightKg?: number, reps?: number) => {
  if (!weightKg || !reps) return 0;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
};
