import { createClient } from "@supabase/supabase-js"

// Client avec service_role key — bypass RLS — à utiliser UNIQUEMENT côté serveur (API routes)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
