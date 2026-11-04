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
  efpeHalfLife: {
    title: 'Yoon et al. 2020, Diabetes Obes Metab 「Efpeglenatide 2상 약동학」 — 반감기 135~180시간',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7383501',
    checkedAt: '2026-11-04',
    status: 'secondary',
  },
  mounjaroLabelPk: {
    title: 'Mounjaro 미국 허가사항(Prescribing Information) 12.3 약동학 — medlibrary 전재본',
    url: 'https://medlibrary.org/lib/rx/meds/mounjaro/page/4/',
    checkedAt: '2026-11-03',
    status: 'secondary',
  },
  mounjaroHalfLife: {
    title: 'Lilly Medical 「What is the half-life of Mounjaro (tirzepatide)?」',
    url: 'https://medical.lilly.com/us/products/answers/what-is-the-half-life-of-mounjaro-tirzepatide-311137',
    checkedAt: '2026-11-03',
    status: 'secondary',
  },
  wegovyLabelPk: {
    title: 'Wegovy 미국 허가사항 12.3 약동학 — medlibrary 전재본',
    url: 'https://medlibrary.org/lib/rx/meds/wegovy/page/7/',
    checkedAt: '2026-11-03',
    status: 'secondary',
  },
  wegovyHalfLife: {
    title: 'Wegovy 미국 허가사항 전재본 (medpath) — 제거 반감기 약 1주',
    url: 'https://trial.medpath.com/drug/approvals/fda/712ad53e4899f372',
    checkedAt: '2026-11-03',
    status: 'secondary',
  },
} satisfies Record<string, ApprovalSource>

const ALL_AREAS: BodyArea[] = ['abdomen', 'thigh', 'upper_arm']

/**
 * 약물 메타데이터.
 * pk: 허가자료(라벨)에서 확인한 값만 넣는다. 확인 못 한 항목은 null — 임의 값 금지.
 * 에페: 허가자료에서 반감기를 못 찾아 2상 약동학 논문 값(135~180시간)의 중간값 157.5시간을 쓴다.
 */
export const MEDICATIONS: Record<MedicationId, Medication> = {
  mounjaro: {
    id: 'mounjaro',
    name: '마운자로',
    ingredient: '터제파타이드',
    pk: {
      halfLifeHours: { value: 5 * 24, text: '약 5일', source: SRC.mounjaroHalfLife },
      bioavailability: { value: 0.8, text: '80%', source: SRC.mounjaroLabelPk },
      tmaxHours: { value: [8, 72], text: '8~72시간', source: SRC.mounjaroLabelPk },
      absorptionRateKa: null,
    },
    doseOptionsMg: [2.5, 5, 7.5, 10, 12.5, 15],
    approval: { doses: SRC.mounjaroDoses, sites: { areas: ALL_AREAS, source: SRC.mounjaroSites } },
  },
  wegovy: {
    id: 'wegovy',
    name: '위고비',
    ingredient: '세마글루타이드',
    pk: {
      halfLifeHours: { value: 7 * 24, text: '약 1주', source: SRC.wegovyHalfLife },
      bioavailability: { value: 0.89, text: '89%', source: SRC.wegovyLabelPk },
      tmaxHours: { value: [24, 72], text: '1~3일', source: SRC.wegovyLabelPk },
      absorptionRateKa: null,
    },
    doseOptionsMg: [0.25, 0.5, 1, 1.7, 2.4],
    approval: { doses: SRC.wegovy, sites: { areas: ALL_AREAS, source: SRC.wegovy } },
  },
  efpe: {
    id: 'efpe',
    name: '에페',
    ingredient: '에페글레나타이드',
    pk: {
      halfLifeHours: { value: 157.5, text: '약 6~7일 (135~180시간)', source: SRC.efpeHalfLife },
      bioavailability: null,
      // 항정상태 기준 0~95시간(중앙값 48시간) — 단회 투여 값이 아니므로 모델에는 쓰지 않음
      tmaxHours: { value: [0, 95], text: '항정상태 0~95시간(중앙값 48시간)', source: SRC.efpeDoses },
      absorptionRateKa: null,
    },
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
