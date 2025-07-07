/* ─────────── lib/supabase/browser.ts ─────────── */
'use client'                                         // browser bundle only
import { createBrowserClient } from '@supabase/ssr'  // new     SDK
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './utils'

const supabase = createBrowserClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
)                                                   // one socket, many hooks

export default supabase
export function createClient() { return supabase }  // ⬅ legacy wrapper if you like
