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
  // Dashboard
  | "view_dashboard"
  // Finances
  | "view_recettes" | "manage_recettes"
  | "view_depenses" | "manage_depenses" | "manage_expenses"  // expenses = rétrocompat
  | "export_pdf"
  // Flotte
  | "view_chauffeurs" | "create_chauffeur" | "edit_chauffeur" | "delete_chauffeur"
  | "view_vehicules"  | "create_vehicle"   | "edit_vehicle"   | "delete_vehicle"
  | "manage_clients"
  // Boyah Transport
  | "view_boyah_dashboard" | "view_orders" | "sync_orders" | "create_driver"
  // Système
  | "view_ai_insights" | "generate_ai_insights"
  | "view_journal"     | "manage_users"
  | "view_reports"

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

// Récupère toutes les permissions d'un rôle (le directeur a tout par défaut)
export async function getRolePermissions(role: UserRole): Promise<Record<string, boolean>> {
  if (role === "directeur") {
    return new Proxy({}, { get: () => true }) as Record<string, boolean>
  }
  const { data } = await supabase
    .from("role_permissions")
    .select("action, allowed")
    .eq("role", role)

  const perms: Record<string, boolean> = {}
  for (const row of data || []) perms[row.action] = row.allowed
  return perms
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
