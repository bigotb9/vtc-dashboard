import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requirePermission } from "@/lib/requirePermission"

const ALLOWED_BUCKETS  = new Set(["vehicules", "avatars", "chauffeurs"])

// Permission requise par bucket (anti upload anonyme). avatars = avatar perso :
// on exige seulement une session authentifiee valide (pas de permission dediee).
const PERM_BY_BUCKET: Record<string, string> = {
  vehicules:  "edit_vehicle",
  chauffeurs: "edit_chauffeur",
}
const MAX_FILE_SIZE    = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES    = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file     = formData.get("file") as File | null
    const bucket   = (formData.get("bucket") as string) || "vehicules"

    if (!file) return NextResponse.json({ ok: false, error: "Fichier manquant" }, { status: 400 })

    // Validation du bucket
    if (!ALLOWED_BUCKETS.has(bucket)) {
      return NextResponse.json({ ok: false, error: "Bucket non autorisé" }, { status: 400 })
    }

    // Auth : permission d'edition du domaine pour vehicules/chauffeurs ;
    // simple session authentifiee pour les avatars (photo de profil perso).
    const needed = PERM_BY_BUCKET[bucket]
    if (needed) {
      const auth = await requirePermission(req, needed)
      if (!auth.ok) return auth.response
    } else {
      const token = req.headers.get("authorization")?.replace("Bearer ", "")
      const { data: { user } } = token
        ? await supabaseAdmin.auth.getUser(token)
        : { data: { user: null } }
      if (!user) {
        return NextResponse.json({ ok: false, error: "Authentification requise" }, { status: 401 })
      }
    }

    // Validation de la taille
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ ok: false, error: "Fichier trop volumineux (max 10 Mo)" }, { status: 400 })
    }

    // Validation du type MIME
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ ok: false, error: "Type de fichier non autorisé (JPEG, PNG, WebP, GIF uniquement)" }, { status: 400 })
    }

    const ext  = file.name.split(".").pop()?.toLowerCase() || "jpg"
    const name = `${randomUUID()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer      = Buffer.from(arrayBuffer)

    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(name, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(name)

    return NextResponse.json({ ok: true, url: data.publicUrl })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
