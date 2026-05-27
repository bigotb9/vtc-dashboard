/**
 * GET  /api/clients/[id]/documents          - Liste les documents d'un Client
 * POST /api/clients/[id]/documents          - Upload un document (FormData)
 *
 * E1 - Module Documents par Client.
 * Stockage physique : bucket Supabase Storage 'clients-docs'.
 *
 * Ajoute le 23/05/2026.
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { logActivity } from "@/lib/logActivity"
import { requirePermission } from "@/lib/requirePermission"

// Auth restauree le 26/05/2026 (Lot A securite) : requirePermission("manage_clients").
// Les documents (contrats, CNI, cartes grises) sont expressement sensibles.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TYPES_AUTORISES = new Set(["contrat", "cni", "carte_grise", "assurance", "justificatif", "etat_comptes_sortie", "autre"])
const TAILLE_MAX_OCTETS = 10 * 1024 * 1024 // 10 Mo
const MIMES_AUTORISES = new Set([
  "application/pdf",
  "image/jpeg", "image/png", "image/webp",
])

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "manage_clients")
  if (!auth.ok) return auth.response

  const { id } = await ctx.params
  const idNum = Number(id)
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "ID invalide" }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from("clients_documents")
    .select("id, type, nom_fichier, storage_path, taille, mime_type, auto_genere, uploaded_at, notes")
    .eq("id_client", idNum)
    .order("uploaded_at", { ascending: false })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  // Genere des URLs signees temporaires pour chaque document (telechargement)
  const docs = await Promise.all((data || []).map(async d => {
    const { data: urlData } = await supabaseAdmin.storage
      .from("clients-docs")
      .createSignedUrl(d.storage_path, 3600) // 1h
    return {
      ...d,
      download_url: urlData?.signedUrl || null,
    }
  }))

  return NextResponse.json({ ok: true, documents: docs })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "manage_clients")
  if (!auth.ok) return auth.response

  const token = req.headers.get("authorization")?.replace("Bearer ", "") || ""

  const { id } = await ctx.params
  const idNum = Number(id)
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "ID invalide" }, { status: 400 })
  }

  // FormData : { file: File, type: string, notes?: string }
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, error: "Body FormData invalide" }, { status: 400 })
  }

  const file = formData.get("file")
  const type = String(formData.get("type") || "autre")
  const notes = formData.get("notes") ? String(formData.get("notes")) : null

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Fichier manquant" }, { status: 400 })
  }
  if (!TYPES_AUTORISES.has(type)) {
    return NextResponse.json({ ok: false, error: "Type de document invalide" }, { status: 400 })
  }
  if (file.size > TAILLE_MAX_OCTETS) {
    return NextResponse.json({ ok: false, error: "Fichier trop volumineux (max 10 Mo)" }, { status: 400 })
  }
  if (!MIMES_AUTORISES.has(file.type)) {
    return NextResponse.json({ ok: false, error: "Format non autorise (PDF, JPG, PNG, WebP uniquement)" }, { status: 400 })
  }

  // Upload dans le bucket
  const ext = file.name.split(".").pop() || "bin"
  const storagePath = `${idNum}/${type}-${Date.now()}.${ext}`
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: upErr } = await supabaseAdmin.storage
    .from("clients-docs")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })
  if (upErr) {
    return NextResponse.json({ ok: false, error: "Erreur upload : " + upErr.message }, { status: 500 })
  }

  // Reference dans la table
  const { data: doc, error: insErr } = await supabaseAdmin
    .from("clients_documents")
    .insert({
      id_client:    idNum,
      type,
      nom_fichier:  file.name.slice(0, 255),
      storage_path: storagePath,
      taille:       file.size,
      mime_type:    file.type,
      auto_genere:  false,
      notes,
    })
    .select("id, type, nom_fichier, taille, mime_type, uploaded_at")
    .single()

  if (insErr) {
    // Rollback : supprimer le fichier du bucket
    await supabaseAdmin.storage.from("clients-docs").remove([storagePath])
    return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })
  }

  await logActivity({
    token,
    action: "client.document.upload",
    entity: String(idNum),
    details: { id_client: idNum, type, taille: file.size, nom: file.name },
  })

  return NextResponse.json({ ok: true, document: doc })
}
