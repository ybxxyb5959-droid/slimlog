import { useEffect, useState } from 'react'

import { dbErrorMessage, isLive } from '@/lib/supabase'
import { loadCommunity, useCommunityStore } from '@/stores/communityStore'

/** 실서비스: 화면에 들어올 때마다 최신 글을 불러온다 (목업은 바로 준비됨) */
export function useCommunityLoad() {
  const loaded = useCommunityStore((s) => s.loaded)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!isLive) return
    loadCommunity().catch((e) => setError(dbErrorMessage(e)))
  }, [tick])
  return {
    loading: isLive && !loaded && !error,
    error,
    retry: () => {
      setError(null)
      setTick((t) => t + 1)
    },
  }
}
