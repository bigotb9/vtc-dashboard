/**
 * GET /api/clients/[id]/releve/[mois]
 *
 * Genere le PDF "Releve du mois" pour le Client et le mois donnes (QW1).
 * Le PDF ne contient PAS les recettes brutes (info propre a Boyah) :
 * uniquement le decompte du loyer dû et le detail des charges decomptees.
 *
 * Reponse : application/pdf (telechargement direct).
 *
 * Ajoute le 23/05/2026.
 */

import { NextRequest, NextResponse } from "next/server"
import { genererReleveDuMois } from "@/lib/clients/genererPdfClient"
import { requirePermission } from "@/lib/requirePermission"

// Auth restauree le 26/05/2026 (Lot A securite) : requirePermission("manage_clients").
// Le front (app/clients/page.tsx) doit recuperer le PDF via authFetch puis
// l'ouvrir via URL.createObjectURL(blob) (pas window.open direct sur l'URL).

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MOIS_RE = /^\d{4}-\d{2}$/

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; mois: string }> }) {
  const auth = await requirePermission(req, "view_clients")
  if (!auth.ok) return auth.response

  const { id, mois } = await ctx.params
  const idNum = Number(id)
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "ID invalide" }, { status: 400 })
  }
  if (!MOIS_RE.test(mois)) {
    return NextResponse.json({ ok: false, error: "Mois invalide (attendu YYYY-MM)" }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin

  try {
    const pdf = await genererReleveDuMois({ id_client: idNum, mois, appUrl })
    const u8 = new Uint8Array(pdf)
    return new NextResponse(u8 as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `inline; filename="Releve-${idNum}-${mois}.pdf"`,
        "Cache-Control":       "no-store",
      },
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
