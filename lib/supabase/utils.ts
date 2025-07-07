// lib/supabase/utils.ts
// Shared utilities for Supabase helpers

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

export const SUPABASE_URL = url
export const SUPABASE_ANON_KEY = anonKey
export const SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey

export const hasSupabaseEnv = Boolean(url) && Boolean(anonKey)
export const hasServiceRoleEnv = Boolean(url) && Boolean(serviceRoleKey)

export function assertSupabaseEnv() {
  if (!hasSupabaseEnv) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY',
    )
  }
}

export function assertServiceRoleEnv() {
  if (!hasServiceRoleEnv) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
}

