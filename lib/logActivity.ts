import { supabaseAdmin } from "@/lib/supabaseAdmin"

/**
 * Enregistre une action dans activity_logs.
 * À appeler depuis les API routes après toute opération significative.
 */
export async function logActivity({
  token,
  action,
  entity,
  details,
}: {
  token: string
  action: string
  entity?: string | null
  details?: Record<string, unknown> | null
}) {
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user) return

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("name, role")
      .eq("id", user.id)
      .single()

    await supabaseAdmin.from("activity_logs").insert({
      user_id:   user.id,
      user_name: profile?.name || user.email || user.id,
      user_role: profile?.role || "user",
      action,
      entity:  entity  ?? null,
      details: details ?? null,
    })
  } catch {
    // Non-bloquant — on ne fait pas échouer la requête si le log rate
  }
}
