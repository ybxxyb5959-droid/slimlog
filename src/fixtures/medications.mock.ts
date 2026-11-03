import type { ApprovalSource, BodyArea, InjectionSite, Medication, MedicationId } from '@/types/domain'

/**
 * 허가 용량·주사 부위 출처 (2026-11-03 확인).
 * status 'secondary' = 보도·안내 자료로 확인, 의약품안전나라 허가사항 원문과 대조 필요.
 * 출처를 확인하지 못한 항목은 null로 두고 임의의 목록을 만들지 않는다.
 */
const SRC = {
  mounjaroDoses: {
    title: '데일리팜 「비만약 마운자로 제형 확대…퀵펜 6개 용량 허가」 (식약처 허가 보도)',
    url: 'https://www.dailypharm.com/user/news/2409',
    checkedAt: '2026-11-03',
    status: 'secondary',
  },
  mounjaroSites: {
    title: '닥터나우 「마운자로 사용법」 (복부·허벅지·위팔 피하주사 안내)',
    url: 'https://doctornow.co.kr/content/magazine/67a66e0c3b9c48f9adceebedace1bc56',
    checkedAt: '2026-11-03',
    status: 'secondary',
  },
  wegovy: {
    title: '코메디닷컴 「위고비프리필드펜 5개 용량 허가」 (식약처 허가 보도)',
    url: 'https://kormedi.com/1586984/',
    checkedAt: '2026-11-03',
    status: 'secondary',
  },
  efpeDoses: {
    title: '식약처 의약품안전나라 「에페오토인젝터주(에페글레나타이드)」 제품정보',
    url: 'https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetailCache?cacheSeq=202603059aupdateTs2026-10-20+08%3A11%3A12.723686b',
    checkedAt: '2026-11-03',
    status: 'secondary',
  },
  efpeSites: {
    title: '마이닥터 「한미약품 에페 허가 대상 투여 방법」 (복부 피하주사 안내)',
    url: 'https://my-doctor.io/healthLab/info/4258',
    checkedAt: '2026-11-03',
    status: 'secondary',
  },
} satisfies Record<string, ApprovalSource>

const ALL_AREAS: BodyArea[] = ['abdomen', 'thigh', 'upper_arm']

/**
 * 약물 메타데이터 (예시).
 * 반감기 수치와 출처는 실제 허가사항 연결 전 화면 예시값이다.
 * 에페는 출처 미등록 상태를 보여주기 위해 halfLifeHours = null.
 */
export const MEDICATIONS: Record<MedicationId, Medication> = {
  mounjaro: {
    id: 'mounjaro',
    name: '마운자로',
    ingredient: '터제파타이드',
    halfLifeHours: 5 * 24,
    halfLifeSource: { label: '제품 허가사항 기준', note: '화면 예시값 · 실제 허가사항 출처 연결 예정' },
    doseOptionsMg: [2.5, 5, 7.5, 10, 12.5, 15],
    approval: { doses: SRC.mounjaroDoses, sites: { areas: ALL_AREAS, source: SRC.mounjaroSites } },
  },
  wegovy: {
    id: 'wegovy',
    name: '위고비',
    ingredient: '세마글루타이드',
    halfLifeHours: 7 * 24,
    halfLifeSource: { label: '제품 허가사항 기준', note: '화면 예시값 · 실제 허가사항 출처 연결 예정' },
    doseOptionsMg: [0.25, 0.5, 1, 1.7, 2.4],
    approval: { doses: SRC.wegovy, sites: { areas: ALL_AREAS, source: SRC.wegovy } },
  },
  efpe: {
    id: 'efpe',
    name: '에페',
    ingredient: '에페글레나타이드',
    halfLifeHours: null,
    halfLifeSource: null,
    doseOptionsMg: [2, 4, 6, 8, 10],
    approval: { doses: SRC.efpeDoses, sites: { areas: ['abdomen'], source: SRC.efpeSites } },
  },
}

export const MEDICATION_LIST = Object.values(MEDICATIONS)

export const INJECTION_SITES: { value: InjectionSite; label: string }[] = [
  { value: 'abdomen_left', label: '배 왼쪽' },
  { value: 'abdomen_right', label: '배 오른쪽' },
  { value: 'thigh', label: '허벅지' },
  { value: 'arm', label: '팔' },
]

/** 좌우는 항상 '내 몸 기준' */
const SITE_LABEL: Record<InjectionSite, string> = {
  abdomen_left: '배 왼쪽',
  abdomen_right: '배 오른쪽',
  thigh_left: '왼쪽 허벅지',
  thigh_right: '오른쪽 허벅지',
  arm_left: '왼쪽 위팔',
  arm_right: '오른쪽 위팔',
  thigh: '허벅지',
  arm: '팔',
}

export const siteLabel = (site: InjectionSite) => SITE_LABEL[site] ?? site

export const SITE_AREA: Record<InjectionSite, BodyArea> = {
  abdomen_left: 'abdomen',
  abdomen_right: 'abdomen',
  thigh_left: 'thigh',
  thigh_right: 'thigh',
  arm_left: 'upper_arm',
  arm_right: 'upper_arm',
  thigh: 'thigh',
  arm: 'upper_arm',
}

export const AREA_LABEL: Record<BodyArea, string> = { abdomen: '복부', thigh: '허벅지', upper_arm: '위팔' }
