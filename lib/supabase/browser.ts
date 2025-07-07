// ─────────  lib/supabase/browser.ts  ─────────
'use client'                                              // browser-only
import { createBrowserClient } from '@supabase/ssr'       // new SSR package  :contentReference[oaicite:0]{index=0}
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './utils' // your env loader

// ✨ singleton – reused everywhere
const supabase = createBrowserClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
)                                                         // one instance = fewer websockets :contentReference[oaicite:1]{index=1}

export function createClient() {
  // tiny wrapper so legacy code (`createClient()`) still works
  return supabase
}

export { supabase }       // named export for new code
export default supabase   // default export for brevity
