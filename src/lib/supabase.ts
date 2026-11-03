import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

/**
 * 데이터 모드 스위치
 * - live: VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY 가 있으면 실제 Supabase(Auth·DB)를 쓴다.
 * - mock: 없으면 기존 목업(브라우저 메모리)으로 동작한다. 미리보기·기존 화면 테스트용.
 */
// Vite 밖(단위 테스트 등)에서는 import.meta.env 가 없을 수 있다 → 목업 모드
const env: Partial<ImportMetaEnv> & { DEV?: boolean } = import.meta.env ?? {}
const url = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY

export const DATA_MODE: 'live' | 'mock' = url && anonKey ? 'live' : 'mock'
export const isLive = DATA_MODE === 'live'

/** 개발용 이메일 로그인 — 개발 서버에서 VITE_DEV_LOGIN=1 일 때만 (운영 빌드에서는 항상 꺼짐) */
export const devLoginEnabled = isLive && !!env.DEV && env.VITE_DEV_LOGIN === '1'

export const supabase: SupabaseClient<Database> | null = isLive
  ? createClient<Database>(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    })
  : null

/** live 모드에서만 부르는 코드용 — mock 모드에서 부르면 버그이므로 바로 알린다 */
export function sb(): SupabaseClient<Database> {
  if (!supabase) throw new Error('Supabase 가 설정되지 않았어요 (목업 모드)')
  return supabase
}

/** Supabase/PostgREST 오류를 사용자 문구로 */
export function dbErrorMessage(e: unknown): string {
  const err = e as { code?: string; message?: string } | null
  if (!err) return '알 수 없는 오류가 났어요.'
  if (err.code === '23505') return '이미 있는 값이에요.'
  if (err.code === '42501' || /row-level security/i.test(err.message ?? '')) return '권한이 없어요. 다시 로그인해 주세요.'
  if (/fetch|network/i.test(err.message ?? '')) return '인터넷 연결을 확인해 주세요.'
  return err.message ?? '저장하지 못했어요.'
}
