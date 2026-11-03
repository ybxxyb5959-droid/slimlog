import { addDays, startOfDay } from '@/lib/date'
import type {
  BodyLog,
  DailyCheck,
  Dose,
  Meal,
  Symptom,
  SymptomType,
  TimelineDay,
  UserProfile,
} from '@/types/domain'

/** 화면 확인용 예시 데이터 — 모든 날짜는 오늘 기준 상대값 */
const today = startOfDay(new Date())
const at = (dayOffset: number, hour: number, minute = 0) => {
  const d = addDays(today, dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const MOCK_PROFILE: UserProfile = {
  name: '김지원',
  nickname: '산뜻한레몬',
  startWeightKg: 90.0,
  goalWeightKg: 75.0,
  medicationId: 'mounjaro',
  startedAt: at(-41, 21),
}

/** 주 1회, 마지막 투약 6일 전 → 다음 예정일은 내일 */
export const MOCK_DOSES: Dose[] = [
  { id: 'd1', medicationId: 'mounjaro', doseMg: 2.5, administeredAt: at(-41, 21), site: 'abdomen_left' },
  { id: 'd2', medicationId: 'mounjaro', doseMg: 2.5, administeredAt: at(-34, 21), site: 'abdomen_right' },
  { id: 'd3', medicationId: 'mounjaro', doseMg: 2.5, administeredAt: at(-27, 21), site: 'thigh' },
  { id: 'd4', medicationId: 'mounjaro', doseMg: 2.5, administeredAt: at(-20, 21), site: 'abdomen_right' },
  { id: 'd5', medicationId: 'mounjaro', doseMg: 5, administeredAt: at(-13, 21), site: 'thigh' },
  { id: 'd6', medicationId: 'mounjaro', doseMg: 5, administeredAt: at(-6, 21), site: 'abdomen_left' },
]

/** 체중: 90.0 → 84.6kg 근처로 완만하게 감소하는 예시 곡선 */
const WEIGHT_NOISE = [0, 0.2, -0.1, 0.15, -0.2, 0.1, 0, -0.15, 0.2, 0.05]
export const MOCK_BODY_LOGS: BodyLog[] = Array.from({ length: 21 }, (_, i) => {
  const dayOffset = -40 + i * 2
  const progress = i / 20
  const weight = 90 - 5.4 * (1 - Math.pow(1 - progress, 1.6)) + WEIGHT_NOISE[i % WEIGHT_NOISE.length] * (i === 20 ? 0 : 1)
  const hasComposition = i % 5 === 0
  const w = Math.round(weight * 10) / 10
  return {
    id: `b${i}`,
    measuredAt: at(dayOffset, 7, 30),
    weightKg: w,
    ...(hasComposition && {
      skeletalMuscleKg: Math.round((31.2 - progress * 0.6) * 10) / 10,
      bodyFatKg: Math.round((w * (0.36 - progress * 0.025)) * 10) / 10,
      bodyFatPct: Math.round((36 - progress * 2.5) * 10) / 10,
    }),
    source: hasComposition ? 'INBODY_OCR' : 'MANUAL',
    isVerified: true,
  }
})

export const MOCK_TODAY_MEALS: Meal[] = [
  { id: 'm1', mealType: 'breakfast', eatenAt: at(0, 8, 10), foodName: '그릭요거트', servings: 1, kcal: 150, proteinG: 15, carbG: 12, fatG: 5, sodiumMg: 60 },
  { id: 'm2', mealType: 'lunch', eatenAt: at(0, 12, 40), foodName: '김치찌개', servings: 1, kcal: 420, proteinG: 22, carbG: 18, fatG: 28, sodiumMg: 1450 },
  { id: 'm3', mealType: 'snack', eatenAt: at(0, 16, 0), foodName: '삶은 달걀', servings: 2, kcal: 150, proteinG: 12, carbG: 1, fatG: 10, sodiumMg: 130 },
]

export const MOCK_TODAY_CHECK: DailyCheck = {
  date: ymd(today),
  waterCups: 6,
  waterGoalCups: 8,
  proteinG: 49,
  proteinGoalG: 80,
  supplementTaken: true,
  condition: 3,
}

export const SYMPTOM_LABEL: Record<SymptomType, string> = {
  nausea: '메스꺼움',
  fatigue: '피로감',
  constipation: '변비',
  headache: '두통',
  heartburn: '속쓰림',
  low_appetite: '식욕 저하',
}

export const MOCK_SYMPTOMS: Symptom[] = [
  { id: 's1', recordedAt: at(-6, 23), type: 'nausea', severity: 2 },
  { id: 's2', recordedAt: at(-5, 9), type: 'nausea', severity: 2 },
  { id: 's3', recordedAt: at(-5, 14), type: 'fatigue', severity: 1 },
  { id: 's4', recordedAt: at(-5, 20), type: 'low_appetite', severity: 2 },
  { id: 's5', recordedAt: at(-4, 10), type: 'constipation', severity: 1 },
  { id: 's6', recordedAt: at(-1, 15), type: 'fatigue', severity: 1 },
]

/** 최근 14일 타임라인 */
const KCAL = [1320, 1180, 1250, 1100, 1210, 1050, 1150, 1240, 980, 860, 1020, 1130, 1190, 720]
export const MOCK_TIMELINE: TimelineDay[] = KCAL.map((kcal, i) => {
  const offset = i - 13
  const date = addDays(today, offset)
  const doses = MOCK_DOSES.filter((d) => startOfDay(new Date(d.administeredAt)).getTime() === date.getTime()).map(
    (d) => ({ medicationId: d.medicationId, doseMg: d.doseMg }),
  )
  const symptomCount = MOCK_SYMPTOMS.filter(
    (s) => startOfDay(new Date(s.recordedAt)).getTime() === date.getTime(),
  ).length
  const body = MOCK_BODY_LOGS.find((b) => startOfDay(new Date(b.measuredAt)).getTime() === date.getTime())
  return { date: ymd(date), kcal: offset === 0 ? MOCK_TODAY_MEALS.reduce((a, m) => a + m.kcal, 0) : kcal, doses, symptomCount, weightKg: body?.weightKg ?? null }
})

/** 최근 7일 기록 현황 (기록한 항목 수 / 5개 항목) */
export const MOCK_WEEKLY_STATUS = MOCK_TIMELINE.slice(-7).map((d, i) => ({
  date: d.date,
  recorded: [4, 5, 3, 5, 4, 5, 3][i],
  total: 5,
}))
