import { expect, test } from '@playwright/test'

import { parseInbody } from '../../src/lib/inbodyParser'

// 아래 글자는 테스트용으로 만든 가짜 결과지 텍스트 (실제 결과지 아님)
test('한글 결과지: 라벨 옆 숫자를 찾고 교차 검증 통과', () => {
  const r = parseInbody(['체성분분석', '체중 72.4 kg', '골격근량 30.1', '체지방량 18.3 kg', '체지방률 (%) 25.3'].join('\n'))
  expect(r.values).toEqual({ weightKg: 72.4, skeletalMuscleKg: 30.1, bodyFatKg: 18.3, bodyFatPct: 25.3 })
  expect(r.problems).toEqual([])
  expect(r.manualRecommended).toBe(false)
})

test('영문 라벨·다음 줄 숫자·OCR 오인식(O→0, 쉼표) 보정', () => {
  const r = parseInbody(['Weight', '8O,5', 'Skeletal Muscle Mass 33.2', 'PBF 24.1'].join('\n'))
  expect(r.values.weightKg).toBe(80.5)
  expect(r.values.skeletalMuscleKg).toBe(33.2)
  expect(r.values.bodyFatPct).toBe(24.1)
})

test('체중 조절(목표) 줄은 체중으로 읽지 않는다', () => {
  const r = parseInbody(['체중조절 -5.2', '체중 70.0'].join('\n'))
  expect(r.values.weightKg).toBe(70)
})

test('체중을 못 찾거나 교차 검증 2개 이상 실패 → 수동 입력 권장', () => {
  expect(parseInbody('골격근량 30').manualRecommended).toBe(true)
  const bad = parseInbody(['체중 60', '골격근량 65', '체지방량 70', '체지방률 10'].join('\n'))
  expect(bad.problems.filter((p) => p.field === 'cross').length).toBeGreaterThanOrEqual(2)
  expect(bad.manualRecommended).toBe(true)
})

// 인바디 앱 '인바디검사 요약' 화면을 OCR 했을 때 나올 수 있는 글자 (사용자 캡처를 보고 옮긴 테스트용 텍스트)
test('인바디 앱 화면: 나란한 3칸(라벨 한 줄·숫자 한 줄) + 측정 시각', () => {
  const text = [
    'InBody 5031님 TOUCH',
    '대시보드 상세 변화 랭킹',
    '인바디검사 요약 표시항목설정',
    '체중 (kg) 골격근량 (kg) 체지방률 (%)',
    '79.2 33.9 24.6',
    '표준이상 표준 표준이상',
    '24.09.03 09:56 79.2kg',
    '80.0',
    '79.0',
    '78.0',
    '09.03',
  ].join('\n')
  const r = parseInbody(text)
  expect(r.values).toEqual({ weightKg: 79.2, skeletalMuscleKg: 33.9, bodyFatPct: 24.6 })
  expect(r.measuredAt?.getFullYear()).toBe(2024)
  expect([r.measuredAt?.getMonth(), r.measuredAt?.getDate(), r.measuredAt?.getHours(), r.measuredAt?.getMinutes()]).toEqual([8, 3, 9, 56])
  expect(r.problems).toEqual([])
})

test('인바디 앱 화면: 칸마다 세로로 읽히고 소수점이 띄어진 경우 (79 .2)', () => {
  const r = parseInbody(['체중 (kg)', '79 .2', '표준이상', '골격근량 (kg)', '33 .9', '표준', '체지방률 (%)', '24 .6', '표준이상'].join('\n'))
  expect(r.values).toEqual({ weightKg: 79.2, skeletalMuscleKg: 33.9, bodyFatPct: 24.6 })
})
