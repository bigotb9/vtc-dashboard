/**
 * GET /api/completude?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Thin wrapper autour du helper lib/completude/calculCompletude.ts
 * (factorisé le 27/05/2026 pour partage avec le helper Cockpit Boyah).
 *
 * Réponse identique à l'API historique pour préserver la compatibilité
 * avec SuiviVersementsWidget + page /recettes/suivi.
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin as sb } from "@/lib/supabaseAdmin"
import {
  getCompletude,
  type CaseStatut as _CaseStatut,
  type CaseData as _CaseData,
} from "@/lib/completude/calculCompletude"

// Réexport pour rétro-compat des consommateurs qui importent depuis ici
// (cf. app/recettes/suivi/page.tsx → import type { CaseStatut } from "@/app/api/completude/route")
export type CaseStatut = _CaseStatut
export type CaseData   = _CaseData

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const dateFrom = searchParams.get("from")
      || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const dateTo = searchParams.get("to")
      || new Date().toISOString().slice(0, 10)

    const result = await getCompletude(sb, { from: dateFrom, to: dateTo })

    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch (e) {
    console.error("[completude]", e)
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
