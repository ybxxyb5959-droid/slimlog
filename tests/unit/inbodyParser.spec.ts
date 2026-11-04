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

// InBody970 종이 결과지를 OCR 했을 때 나올 법한 글자 (사용자가 올린 결과지 이미지를 보고 옮김, 이름은 넣지 않음)
const SHEET_970 = [
  'InBody [InBody970] [Yscope]',
  '회원번호 신장 연령 성별 검사일시',
  '183cm 50 남성 2018.10.25. 15:44',
  '체성분분석 Body Composition Analysis',
  '체수분 단백질 무기질 체지방 체중',
  '체수분 Total Body Water (L) 45.0 (41.4~50.6) 45.0 57.7 61.1 89.5',
  '단백질 Protein (kg) 12.0 (11.1~13.5) (53.3~65.0) (56.4~68.9) (62.6~84.0)',
  '무기질 Minerals (kg) 4.14 (3.83~4.69)',
  '체지방 Body Fat Mass (kg) 28.4 (8.9~17.7)',
  '골격근·지방분석 Muscle-Fat Analysis',
  '체중 Weight (kg) 55 70 85 100 115 130 145 160 175 190 205 % 89.5',
  '골격근량 Skeletal Muscle Mass (kg) 70 80 90 100 110 120 130 140 150 160 170 % 34.3',
  '체지방량 Body Fat Mass (kg) 40 60 80 100 160 220 280 340 400 460 520 % 28.4',
  '비만분석 Obesity Analysis',
  'BMI Body Mass Index (kg/m2) 10.0 15.0 18.5 21.0 25.0 30.0 35.0 40.0 45.0 50.0 55.0 26.7',
  '체지방률 Percent Body Fat (%) 8.0 13.0 18.0 23.0 28.0 33.0 38.0 43.0 48.0 53.0 58.0 31.7',
  '인바디점수 61/100점',
  '체중조절 -15.8 kg 지방조절 -17.3 kg 근육조절 +1.5 kg',
  '신체변화 Body Composition History',
  '체중 Weight (kg) 96.0 95.5 95.0 95.3 95.0 93.2 93.2 89.5',
  '골격근량 (kg) 33.6 33.8 33.9 33.8 34.0 34.1 34.7 34.3',
  '체지방률 (%) 37.2 36.7 36.2 36.5 36.0 34.5 33.7 31.7',
].join('\n')

test('InBody970 종이 결과지: 눈금·표준범위·이력표를 건너뛰고 값만', () => {
  const r = parseInbody(SHEET_970)
  expect(r.values).toEqual({ weightKg: 89.5, skeletalMuscleKg: 34.3, bodyFatKg: 28.4, bodyFatPct: 31.7 })
  expect(r.problems).toEqual([])
  expect(r.manualRecommended).toBe(false)
  const d = r.measuredAt!
  expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2018, 9, 25, 15, 44])
})

// 실제 인바디 앱 '인바디검사 요약' 캡처를 Tesseract(kor+eng)로 읽은 글자 모양 그대로 — 숫자·닉네임은 바꿈
// 라벨 3개가 한 줄, 값은 다음 줄. '(kg)' 가 '(8)' 로, 작은 소수 '24.6' 이 '24 6' 으로 읽힘
test('인바디 앱 캡처(실제 OCR 모양): 한 줄 라벨 3개 ↔ 다음 줄 값, (kg)→(8)·24 6 오인식 보정', () => {
  const text =
    'InBody  0000 TOUCH [= 0)\n대시보드\n인바디검사 요약                        09) 표시항목설정\n체중 (kg)               골격근량 (8)             체지방률 (%)\n81.5    32.7    26 3\n  «=»\n24.09.03 09:56 81.5kg\n[ ]\n[J\n09.03\nMh 공유하기            + 검사기록\n헬스리포트\n'
  const r = parseInbody(text)
  expect(r.values).toEqual({ weightKg: 81.5, skeletalMuscleKg: 32.7, bodyFatPct: 26.3 })
  expect(r.problems).toEqual([])
  expect(r.measuredAt?.getFullYear()).toBe(2024)
})

test('단위 괄호를 숫자로 잘못 읽어도 값으로 쓰지 않는다', () => {
  const r = parseInbody(['체중 (8) 70.4', '골격근량 (8)', '30.2'].join('\n'))
  expect(r.values.weightKg).toBe(70.4)
  expect(r.values.skeletalMuscleKg).toBe(30.2)
})
