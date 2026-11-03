/** 동의 항목 정의 — 가입 동의 화면과 마이 > 동의 관리에서 함께 쓴다 (문구는 초안, 법률 검토 전) */
export type ConsentId = 'terms' | 'privacy' | 'sensitive' | 'photo_improve' | 'marketing'

export interface ConsentItem {
  id: ConsentId
  title: string
  required: boolean
  summary: string
  detail: string[]
  withdrawWarning?: string
}

export const CONSENT_ITEMS: ConsentItem[] = [
  {
    id: 'terms',
    title: '서비스 이용약관',
    required: true,
    summary: '슬림로그 이용 조건',
    detail: ['슬림로그는 기록·정보 정리 서비스이며 진단·처방·용량 결정을 하지 않아요.', '커뮤니티 운영 정책(의약품 거래·용량 권유 금지)을 따라야 해요.'],
    withdrawWarning: '이용약관 동의를 철회하면 회원 탈퇴로 처리돼요.',
  },
  {
    id: 'privacy',
    title: '개인정보 수집·이용',
    required: true,
    summary: '이메일, 닉네임, 로그인 정보',
    detail: ['수집 항목: 이메일, 닉네임, 소셜 로그인 식별자', '목적: 회원 식별, 서비스 제공', '보유 기간: 탈퇴 시까지'],
    withdrawWarning: '개인정보 수집·이용 동의를 철회하면 회원 탈퇴로 처리돼요.',
  },
  {
    id: 'sensitive',
    title: '민감정보(건강정보) 처리',
    required: true,
    summary: '투약·증상·체중·체성분 기록',
    detail: [
      '수집 항목: 투약 기록, 증상·컨디션, 체중·체성분, 식단',
      '목적: 기록 저장과 타임라인·참고 곡선 표시',
      '보유 기간: 탈퇴 또는 동의 철회 시까지 (철회 시 삭제)',
      '눈바디 사진은 서버로 보내지 않고 이 기기에만 저장해요.',
    ],
    withdrawWarning: '철회하면 저장된 투약·증상·체성분 기록이 삭제되고, 기록 기능을 쓸 수 없어요.',
  },
  {
    id: 'photo_improve',
    title: '식단 사진 수정 기록 활용',
    required: false,
    summary: 'AI가 틀렸을 때 고른 결과로 모델 성능 점검',
    detail: ['식단 사진에서 사용자가 고친 음식명을 모델 정확도 측정에 써요.', '동의하지 않아도 식단 기록은 그대로 쓸 수 있어요.'],
  },
  {
    id: 'marketing',
    title: '이벤트·소식 알림',
    required: false,
    summary: '새 기능, 이벤트 안내',
    detail: ['앱 알림으로 새 기능 소식을 보내요. 언제든 끌 수 있어요.'],
  },
]
