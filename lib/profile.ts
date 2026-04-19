import { supabase } from "./supabaseClient"

export type UserRole = "directeur" | "admin" | "dispatcher"

export type Profile = {
  id:         string
  email:      string
  full_name:  string | null
  role:       UserRole
  is_active:  boolean
  created_at: string
}

export type Permission =
  | "create_driver"
  | "create_vehicle"
  | "sync_orders"
  | "view_reports"
  | "export_pdf"
  | "manage_expenses"
  | "manage_recettes"

// Récupère le profil de l'utilisateur connecté
export async function getMyProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()
  return data as Profile | null
}

// Récupère toutes les permissions d'un rôle
export async function getRolePermissions(role: UserRole): Promise<Record<Permission, boolean>> {
  if (role === "directeur") {
    // Le directeur a tout
    return {
      create_driver:   true,
      create_vehicle:  true,
      sync_orders:     true,
      view_reports:    true,
      export_pdf:      true,
      manage_expenses: true,
      manage_recettes: true,
    }
  }
  const { data } = await supabase
    .from("role_permissions")
    .select("action, allowed")
    .eq("role", role)

  const perms: Record<string, boolean> = {}
  for (const row of data || []) perms[row.action] = row.allowed
  return perms as Record<Permission, boolean>
}

// Log une action utilisateur
export async function logAction(params: {
  userId:   string
  userName: string
  userRole: string
  action:   string
  entity?:  string
  details?: Record<string, unknown>
}) {
  await supabase.from("activity_logs").insert({
    user_id:   params.userId,
    user_name: params.userName,
    user_role: params.userRole,
    action:    params.action,
    entity:    params.entity || null,
    details:   params.details || null,
  })
}
