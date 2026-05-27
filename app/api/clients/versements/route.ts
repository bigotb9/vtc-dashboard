import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requirePermission } from "@/lib/requirePermission"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/clients/versements?id_client=X
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "manage_clients")
    if (!auth.ok) return auth.response

    const id_client = req.nextUrl.searchParams.get("id_client")
    if (!id_client) return NextResponse.json({ ok: false, error: "id_client manquant" }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from("versements_clients")
      .select("*")
      .eq("id_client", id_client)
      .order("mois", { ascending: false })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, versements: data || [] })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

// POST /api/clients/versements — upsert (marquer payé)
// Patch 23/05/2026 (H1) : generation automatique du justificatif PDF.
// Patch 24/05/2026 (cascade versements) : accepte caisse_id OU compte_id pour
// que le trigger Flux A puisse debiter la bonne caisse/compte source.
// XOR : exactement un des deux doit etre renseigne (la contrainte BD le verifie).
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "manage_clients")
    if (!auth.ok) return auth.response

    const body = await req.json()
    const { id_client, mois, montant, date_versement, notes, caisse_id, compte_id } = body

    if (!id_client || !mois || montant == null) {
      return NextResponse.json({ ok: false, error: "Champs requis : id_client, mois, montant" }, { status: 400 })
    }

    // Validation XOR caisse_id / compte_id
    if (caisse_id && compte_id) {
      return NextResponse.json({ ok: false, error: "Choisir caisse_id OU compte_id, pas les deux" }, { status: 400 })
    }

    const { data: versement, error } = await supabaseAdmin
      .from("versements_clients")
      .upsert(
        {
          id_client,
          mois,
          montant,
          date_versement: date_versement || new Date().toISOString().slice(0, 10),
          notes: notes || null,
          caisse_id: caisse_id || null,
          compte_id: compte_id || null,
        },
        { onConflict: "id_client,mois" }
      )
      .select()
      .single()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    // ─── Generation automatique du justificatif PDF (H1) — non bloquant ───
    let justificatifPath: string | null = null
    let justificatifNumero: string | null = null
    try {
      const { genererJustificatifVersement } = await import("@/lib/clients/genererPdfClient")
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
      const { pdf, numero } = await genererJustificatifVersement({ versement_id: versement.id, appUrl })
      justificatifNumero = numero

      // Upload bucket
      const storagePath = `${id_client}/justificatif-${numero}.pdf`
      const { error: upErr } = await supabaseAdmin.storage
        .from("clients-docs")
        .upload(storagePath, pdf, { contentType: "application/pdf", upsert: true })
      if (!upErr) {
        justificatifPath = storagePath
        // Reference dans clients_documents (dedup par storage_path UNIQUE)
        await supabaseAdmin.from("clients_documents").upsert({
          id_client,
          type:         "justificatif",
          nom_fichier:  `Justificatif-${numero}.pdf`,
          storage_path: storagePath,
          taille:       pdf.length,
          mime_type:    "application/pdf",
          auto_genere:  true,
          notes:        `Versement ${mois} - ${Math.round(Number(montant)).toLocaleString("fr-FR")} F`,
        }, { onConflict: "storage_path" })
      }
    } catch (e) {
      console.error("[versements] Justificatif PDF echoue (non bloquant) :", e)
    }

    return NextResponse.json({
      ok: true,
      versement,
      justificatif: justificatifPath ? { path: justificatifPath, numero: justificatifNumero } : null,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

// DELETE /api/clients/versements?id_client=X&mois=2026-03
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "manage_clients")
    if (!auth.ok) return auth.response

    const id_client = req.nextUrl.searchParams.get("id_client")
    const mois      = req.nextUrl.searchParams.get("mois")
    if (!id_client || !mois) return NextResponse.json({ ok: false, error: "Paramètres manquants" }, { status: 400 })

    const { error } = await supabaseAdmin
      .from("versements_clients")
      .delete()
      .eq("id_client", id_client)
      .eq("mois", mois)

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
