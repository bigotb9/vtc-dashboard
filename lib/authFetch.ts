/**
 * Wrapper fetch qui ajoute automatiquement le Bearer token Supabase.
 * Utiliser à la place de fetch() dans les composants client pour
 * que les API routes puissent identifier l'utilisateur (journal d'activité).
 */
import { supabase } from "@/lib/supabaseClient"

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
  })
}
