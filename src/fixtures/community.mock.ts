import { addDays, startOfDay } from '@/lib/date'
import type { SafetyLevel } from '@/lib/communitySafety'

/** 커뮤니티 예시 데이터 — 실제 사용자 글이 아니다 */
export type PostCategory = 'review' | 'meal' | 'exercise' | 'question' | 'free'

export const CATEGORY_LABEL: Record<PostCategory, string> = {
  review: '후기',
  meal: '식단',
  exercise: '운동',
  question: '질문',
  free: '자유',
}

export interface Comment {
  id: string
  author: string
  body: string
  createdAt: string
  mine?: boolean
}

export interface Post {
  id: string
  category: PostCategory
  title: string
  body: string
  author: string
  createdAt: string
  likes: number
  liked?: boolean
  comments: Comment[]
  /** 서버 검사 결과. REVIEW는 작성자에게만 '검토 중'으로 보이고 목록에는 노출되지 않는다 */
  status: SafetyLevel
  mine?: boolean
}

const today = startOfDay(new Date())
const at = (d: number, h: number, m = 0) => {
  const x = addDays(today, d)
  x.setHours(h, m)
  return x.toISOString()
}

export const ME = '산뜻한레몬'

export const MOCK_POSTS: Post[] = [
  {
    id: 'p1',
    category: 'review',
    title: '6주차, 단백질 챙기려고 계란을 늘렸어요',
    body: '식욕이 줄면서 끼니를 거르기 쉬웠는데, 아침마다 삶은 계란 두 개랑 그릭요거트로 바꿨어요. 기록 앱으로 단백질 그래프 보면서 하니까 덜 빼먹게 되네요.',
    author: '아침산책',
    createdAt: at(0, 9, 20),
    likes: 24,
    comments: [
      { id: 'c1', author: '새벽러너', body: '저도 그릭요거트 추천해요. 포만감이 오래가요.', createdAt: at(0, 10, 2) },
      { id: 'c2', author: '물두컵', body: '단백질 그래프 저도 써봐야겠어요!', createdAt: at(0, 11, 40) },
    ],
    status: 'LOW',
  },
  {
    id: 'p2',
    category: 'meal',
    title: '편의점에서 고른 점심 조합 공유',
    body: '닭가슴살 샐러드 + 두유 + 삶은 달걀. 식단 사진 기록하니까 칼로리 확인이 편하네요.',
    author: '샐러드요정',
    createdAt: at(-1, 13, 5),
    likes: 15,
    comments: [],
    status: 'LOW',
  },
  {
    id: 'p3',
    category: 'question',
    title: '주사 맞은 다음 날 컨디션 기록 어떻게 하세요?',
    body: '메스꺼움이 있는 날이랑 없는 날을 비교해보고 싶은데, 증상 기록을 매일 남기시나요? 진료 때 보여드리려고요.',
    author: '기록초보',
    createdAt: at(-1, 21, 30),
    likes: 9,
    comments: [{ id: 'c3', author: '아침산책', body: '저는 증상 있는 날만 남기고 타임라인으로 봐요.', createdAt: at(-1, 22, 10) }],
    status: 'LOW',
  },
  {
    id: 'p4',
    category: 'exercise',
    title: '근육량 줄까 봐 걷기 + 스쿼트 시작했어요',
    body: '인바디 결과 보면서 골격근량 유지하려고 매일 20분 걷고 스쿼트 30개씩 하고 있어요.',
    author: '새벽러너',
    createdAt: at(-2, 7, 45),
    likes: 31,
    comments: [],
    status: 'LOW',
  },
  {
    id: 'p5',
    category: 'free',
    title: '증량 일정 고민돼서 다음 진료 때 물어보려고요',
    body: '선생님께 여쭤볼 내용 정리 중이에요. 상담 준비 화면에 요약해 가면 좋을 것 같아요.',
    author: ME,
    createdAt: at(-2, 20, 0),
    likes: 4,
    comments: [],
    status: 'LOW',
    mine: true,
  },
  {
    id: 'p6',
    category: 'review',
    title: '용량 올리는 시기 경험 공유',
    body: '저는 4주차에 5mg부터 올리세요 라고 들었는데 다들 어떠셨어요?',
    author: ME,
    createdAt: at(-3, 18, 0),
    likes: 0,
    comments: [],
    status: 'LOW',
    mine: true,
  },
]

export interface ModerationItem {
  id: string
  postTitle: string
  excerpt: string
  author: string
  level: Exclude<SafetyLevel, 'LOW'>
  rules: string[]
  reports: number
  createdAt: string
}

export const MOCK_MODERATION: ModerationItem[] = [
  { id: 'm1', postTitle: '용량 올리는 시기 경험 공유', excerpt: '4주차에 5mg부터 올리세요 라고 들었는데…', author: ME, level: 'REVIEW', rules: ['용량·증량 권유'], reports: 0, createdAt: at(-3, 18, 0) },
  { id: 'm2', postTitle: '○○의원 다녀온 후기', excerpt: '○○의원에서 처방받았는데 상담이 친절했어요…', author: '익명A', level: 'REVIEW', rules: ['병원·약국 상호'], reports: 1, createdAt: at(-1, 15, 20) },
  { id: 'm3', postTitle: '남은 펜 처리 고민', excerpt: '남은 펜 양도해요, 쪽지 주세요', author: '익명B', level: 'BLOCKED', rules: ['양도·나눔'], reports: 3, createdAt: at(0, 8, 10) },
]

export interface AuditLog {
  id: string
  at: string
  admin: string
  action: '승인' | '반려' | '숨김'
  target: string
  reason: string
}

export const MOCK_AUDIT: AuditLog[] = [
  { id: 'a1', at: at(-4, 11, 0), admin: '관리자1', action: '반려', target: '펜 정리합니다', reason: '의약품 양도 문구 포함 (약사법 위반 소지)' },
  { id: 'a2', at: at(-5, 16, 30), admin: '관리자1', action: '승인', target: '병원 대기 시간 후기', reason: '상호 언급 없이 일반 후기로 확인' },
]
