import { expect, test } from '@playwright/test'

import { givenNameOf } from '../../src/lib/personName'

test('가입 이름에서 성을 뺀다', () => {
  expect(givenNameOf('김지원')).toBe('지원')
  expect(givenNameOf('박서연')).toBe('서연')
  expect(givenNameOf('김 지원')).toBe('지원')
  expect(givenNameOf('남궁민수')).toBe('민수')
  expect(givenNameOf('황보')).toBe('보') // 두 글자 이름은 한 글자 성으로 처리
  expect(givenNameOf('John Smith')).toBe('John')
  expect(givenNameOf('  ')).toBeNull()
  expect(givenNameOf(undefined)).toBeNull()
})
