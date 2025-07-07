// app/api/mfa/status/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase/utils'

export async function GET() {
  // await cookies() so TS knows it's not a Promise later
  const cookieStore = await cookies()

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // no-op: we don’t need to set cookies here
        },
      },
    }
  )

  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) return NextResponse.error()

  return NextResponse.json({ hasMfa: data.all.length > 0 })
}
