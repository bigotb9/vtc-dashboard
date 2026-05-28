/**
 * DELETE /api/clients/[id]/documents/[doc_id]
 *
 * Supprime un document (Storage + table). Refuse si le document est
 * auto_genere = TRUE (justificatif, etat des comptes auto - on garde
 * la trace comptable).
 *
 * Ajoute le 23/05/2026 (E1).
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { logActivity } from "@/lib/logActivity"
import { requirePermission } from "@/lib/requirePermission"

// Auth restauree le 26/05/2026 (Lot A securite) : requirePermission("manage_clients").

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; doc_id: string }> }) {
  const auth = await requirePermission(req, "edit_client")
  if (!auth.ok) return auth.response

  const token = req.headers.get("authorization")?.replace("Bearer ", "") || ""

  const { id, doc_id } = await ctx.params

  const { data: doc, error: fErr } = await supabaseAdmin
    .from("clients_documents")
    .select("id, id_client, storage_path, auto_genere, type")
    .eq("id", doc_id)
    .maybeSingle()

  if (fErr || !doc) {
    return NextResponse.json({ ok: false, error: "Document introuvable" }, { status: 404 })
  }
  if (String(doc.id_client) !== String(id)) {
    return NextResponse.json({ ok: false, error: "Document n'appartient pas a ce Client" }, { status: 403 })
  }
  if (doc.auto_genere) {
    return NextResponse.json({
      ok: false,
      error: "Impossible de supprimer un document auto-genere (justificatif, etat des comptes). Trace comptable conservee.",
      code: "AUTO_GENERATED",
    }, { status: 409 })
  }

  // 1. Suppression dans le bucket
  const { error: rmErr } = await supabaseAdmin.storage
    .from("clients-docs")
    .remove([doc.storage_path])
  if (rmErr) {
    // On loggue mais on continue : l'orphan storage est moins grave que la BD desync
    await logActivity({ token, action: "client.document.delete.storage_failed", entity: id, details: { storage_path: doc.storage_path } })
  }

  // 2. Suppression dans la table
  const { error: dErr } = await supabaseAdmin
    .from("clients_documents")
    .delete()
    .eq("id", doc_id)
  if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 })

  await logActivity({ token, action: "client.document.delete", entity: id, details: { doc_id, type: doc.type } })

  return NextResponse.json({ ok: true })
}
