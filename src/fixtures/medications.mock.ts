import type { InjectionSite, Medication, MedicationId } from '@/types/domain'

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
  },
  wegovy: {
    id: 'wegovy',
    name: '위고비',
    ingredient: '세마글루타이드',
    halfLifeHours: 7 * 24,
    halfLifeSource: { label: '제품 허가사항 기준', note: '화면 예시값 · 실제 허가사항 출처 연결 예정' },
    doseOptionsMg: [0.25, 0.5, 1, 1.7, 2.4],
  },
  efpe: {
    id: 'efpe',
    name: '에페',
    ingredient: '에페글레나타이드',
    halfLifeHours: null,
    halfLifeSource: null,
    doseOptionsMg: null,
  },
}

export const MEDICATION_LIST = Object.values(MEDICATIONS)

export const INJECTION_SITES: { value: InjectionSite; label: string }[] = [
  { value: 'abdomen_left', label: '배 왼쪽' },
  { value: 'abdomen_right', label: '배 오른쪽' },
  { value: 'thigh', label: '허벅지' },
  { value: 'arm', label: '팔' },
]

export const siteLabel = (site: InjectionSite) => INJECTION_SITES.find((s) => s.value === site)?.label ?? site
