/**
 * GET /api/compta/plan-comptable/[code]
 *
 * Détail d'un compte SYSCOHADA avec la liste enrichie des entités qui
 * l'utilisent (Écran 10 §5.2). Utilisé par la modal de détail.
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { getSoldeCaisse, getSoldeCompte } from "@/lib/compta/soldes"

export const dynamic     = "force-dynamic"
export const maxDuration = 15

type RouteCtx = { params: Promise<{ code: string }> }

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireComptaPermission(req, "view_comptabilite")
  if (!auth.ok) return auth.response

  const { code } = await ctx.params

  try {
    // 1. Compte SYSCOHADA
    const { data: cs, error: csErr } = await supabaseAdmin
      .from("comptes_syscohada")
      .select("code, libelle, classe, parent_code, ordre, type, actif")
      .eq("code", code)
      .maybeSingle()
    if (csErr) return comptaError("DB_ERROR", { hint: csErr.message })
    if (!cs)   return comptaError("NOT_FOUND")

    // 2. Caisses + comptes + catégories qui utilisent ce code (en parallèle)
    const [caissesRows, comptesRows, catsRows] = await Promise.all([
      supabaseAdmin
        .from("caisses")
        .select("id, libelle, code, type, operateur, actif")
        .eq("compte_syscohada_code", code),
      supabaseAdmin
        .from("comptes")
        .select("id, libelle, code, banque, actif")
        .eq("compte_syscohada_code", code),
      supabaseAdmin
        .from("categories_operations")
        .select("id, libelle, type, sens, actif")
        .eq("compte_syscohada_code", code),
    ])

    // 3. Pour chaque caisse/compte : récupérer le solde courant
    const caisses = await Promise.all(
      (caissesRows.data ?? []).map(async c => ({
        id:        String(c.id),
        libelle:   c.libelle,
        code:      c.code ?? null,
        type:      c.type ?? null,
        operateur: c.operateur ?? null,
        actif:     !!c.actif,
        solde:     await getSoldeCaisse(c.id).catch(() => 0),
      })),
    )
    const comptes = await Promise.all(
      (comptesRows.data ?? []).map(async c => ({
        id:      String(c.id),
        libelle: c.libelle,
        code:    c.code ?? null,
        banque:  c.banque ?? null,
        actif:   !!c.actif,
        solde:   await getSoldeCompte(c.id).catch(() => 0),
      })),
    )

    // 4. Pour chaque catégorie : compter les opérations valides + sum montant
    const categories = await Promise.all(
      (catsRows.data ?? []).map(async c => {
        const { data: ops } = await supabaseAdmin
          .from("operations")
          .select("montant")
          .eq("categorie_id", c.id)
          .eq("statut", "valide")
        const list = ops ?? []
        const volume_total = list.reduce((s, o) => s + Number(o.montant || 0), 0)
        return {
          id:            String(c.id),
          libelle:       c.libelle,
          type:          c.type ?? null,
          sens:          c.sens ?? null,
          actif:         !!c.actif,
          nb_operations: list.length,
          volume_total,
        }
      }),
    )

    return comptaOk({
      code:        cs.code,
      libelle:     cs.libelle,
      classe:      cs.classe,
      parent:      cs.parent_code ?? null,
      ordre:       cs.ordre ?? 0,
      type_compte: cs.type ?? null,
      actif:       !!cs.actif,
      usage: {
        caisses,
        comptes,
        categories,
      },
    })
  } catch (e) {
    return comptaError("DB_ERROR", { hint: (e as Error).message })
  }
}
