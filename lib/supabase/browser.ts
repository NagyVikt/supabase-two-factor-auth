/* ─────────── lib/supabase/browser.ts ─────────── */
"use client";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./utils";

let supabase: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (!supabase) {
    supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabase;
}
