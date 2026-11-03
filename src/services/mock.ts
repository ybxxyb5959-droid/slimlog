/** 목업 지연 — 로딩 상태를 실제처럼 확인하기 위함. API 연결 시 제거 */
export function mockResponse<T>(data: T, delayMs = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(data)), delayMs))
}
