import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

/**
 * Vérifie côté serveur que l'utilisateur courant a la permission demandée.
 * Retourne null + une réponse 403 si refusé, sinon { user, role }.
 *
 * Utilisation dans une route POST :
 *   const auth = await requirePermission(req, "create_chauffeur")
 *   if (!auth.ok) return auth.response
 */
export async function requirePermission(req: NextRequest, action: string): Promise<
  | { ok: true; user: { id: string; email?: string }; role: string }
  | { ok: false; response: NextResponse }
> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) {
    return { ok: false, response: NextResponse.json(
      { success: false, error: "Authentification requise" }, { status: 401 }
    )}
  }

  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) {
    return { ok: false, response: NextResponse.json(
      { success: false, error: "Session invalide" }, { status: 401 }
    )}
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles").select("role").eq("id", user.id).single()

  if (!profile) {
    return { ok: false, response: NextResponse.json(
      { success: false, error: "Profil introuvable" }, { status: 403 }
    )}
  }

  // Le directeur a accès à tout
  if (profile.role === "directeur") {
    return { ok: true, user, role: profile.role }
  }

  // Sinon on regarde la matrice
  const { data: perm } = await supabaseAdmin
    .from("role_permissions")
    .select("allowed")
    .eq("role", profile.role)
    .eq("action", action)
    .single()

  if (!perm?.allowed) {
    return { ok: false, response: NextResponse.json(
      { success: false, error: `Permission refusée : ${action}` }, { status: 403 }
    )}
  }

  return { ok: true, user, role: profile.role }
}
