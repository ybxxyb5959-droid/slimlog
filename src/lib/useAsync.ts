import { useCallback, useEffect, useState } from 'react'

/**
 * 아주 작은 데이터 로딩 훅.
 * 지금은 services의 목업 Promise를, 나중에는 실제 API Promise를 그대로 받는다.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: Error | null }>({
    data: null,
    loading: true,
    error: null,
  })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let alive = true
    fn().then(
      (data) => alive && setState({ data, loading: false, error: null }),
      (error: Error) => alive && setState({ data: null, loading: false, error }),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }))
    setNonce((n) => n + 1)
  }, [])
  return { ...state, reload }
}
