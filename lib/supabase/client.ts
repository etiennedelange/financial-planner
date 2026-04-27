import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/supabase"

export const SUPABASE_ENABLED = !!process.env.NEXT_PUBLIC_SUPABASE_URL

export function createClient() {
  if (!SUPABASE_ENABLED) return null
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
