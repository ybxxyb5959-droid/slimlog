import { useEffect, useState } from 'react'

import { photoUrl } from '@/lib/eyebodyVault'
import { cn } from '@/lib/utils'

/** 복호화한 썸네일/원본 — 화면을 떠나면 임시 주소를 지운다 (복호화한 사진은 메모리에만) */
export function VaultImage({ id, thumb, alt, className, draggable }: { id: string; thumb?: boolean; alt: string; className?: string; draggable?: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let u: string | null = null
    let alive = true
    photoUrl(id, thumb)
      .then((x) => {
        u = x
        if (alive) setUrl(x)
        else URL.revokeObjectURL(x)
      })
      .catch(() => {})
    return () => {
      alive = false
      if (u) URL.revokeObjectURL(u)
    }
  }, [id, thumb])
  return url ? <img src={url} alt={alt} className={className} draggable={draggable} /> : <div className={cn(className, 'animate-pulse bg-surface-muted')} aria-label={`${alt} 불러오는 중`} />
}
