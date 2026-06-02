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
  // view_fleet : listes consolidees vehicules + chauffeurs (selects "Liens metier"
  //   du formulaire d'operation, /api/vehicules/list + /api/chauffeurs/list).
  // manage_maintenance : fiches d'entretien vehicule (/api/entretiens).
  // Ajoutees 02/06/2026 : exigees par le code (Lot Z) mais absentes du type +
  //   de l'UI /parametres -> invisibles pour le directeur (cf. correctif perms fantomes).
  | "view_fleet"      | "manage_maintenance"
  // manage_drivers : affectations chauffeur <-> vehicule (/api/affectations).
  // manage_tasks   : taches de suivi vehicule (/api/taches).
  // Ajoutees 02/06/2026 : memes cles fantomes Lot Z (absentes type + UI), desormais
  //   pilotables dans /parametres. Valeurs deja semees en base (admin/dispatcher).
  | "manage_drivers"  | "manage_tasks"
  // Clients (sous-gestion, asset management) - permissions granulaires depuis le 27/05/2026
  // (ex-manage_clients splitee en 4 verbes : voir / creer / modifier / supprimer)
  | "view_clients"    | "create_client"    | "edit_client"    | "delete_client"
  // Comptabilite (Phase 4.x - ajoute 24/05/2026)
  // view_comptabilite : voir le module (Dashboard compta, Comptes & Caisses, Categories, Tiers, etats)
  // manage_comptabilite : saisir/modifier les operations comptables
  // manage_exercices : cloturer un exercice (action irreversible)
  // manage_societe : modifier les parametres societe (RCCM, logo, etc.)
  | "view_comptabilite" | "manage_comptabilite"
  | "manage_exercices"  | "manage_societe"
  // Boyah Transport
  | "view_boyah_dashboard" | "view_orders" | "sync_orders" | "create_driver"
  // Système
  | "view_cockpit"     | "view_journal"     | "manage_users"
  | "view_reports"
  // Finances Cockpit (lecture seule donnees sensibles : marge, arriere,
  // rentabilite par vehicule) - ajoute 01/06/2026, distincte de view_cockpit
  | "view_finances_cockpit"

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
