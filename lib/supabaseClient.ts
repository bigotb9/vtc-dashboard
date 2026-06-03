import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Verrou d'auth EN MÉMOIRE (remplace le verrou navigator.locks par défaut).
 *
 * Le verrou navigateur par défaut de @supabase/auth-js déclenche l'erreur
 * "Lock broken by another request with the 'steal' option" lorsque plusieurs
 * appels getSession()/getUser() s'exécutent en concurrence au montage d'une
 * page (AuthGuard + Sidebar + useProfile + authFetch tirent tous l'auth en
 * même temps ; amplifié par React Strict Mode / HMR en dev). Quand un verrou
 * est jugé « bloqué » trop longtemps, auth-js le re-demande avec { steal:true },
 * ce qui rejette la promesse du détenteur précédent avec ce message.
 *
 * On sérialise les sections critiques d'auth via une simple chaîne de promesses :
 *   - pas de mécanisme « steal » → plus d'erreur ;
 *   - pas de coordination cross-tab (inutile pour un dashboard interne
 *     mono-session ; autoRefreshToken/persistSession restent inchangés).
 */
let authLockChain: Promise<unknown> = Promise.resolve()
function inMemoryLock<R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  const run = authLockChain.then(() => fn())
  // La chaîne ne doit jamais casser : on absorbe succès et échec pour le suivant.
  authLockChain = run.then(() => undefined, () => undefined)
  return run
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { lock: inMemoryLock },
})
