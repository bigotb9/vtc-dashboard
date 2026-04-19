import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { randomUUID } from "crypto"

// Service role client — bypass RLS entièrement
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_BUCKETS  = new Set(["vehicules", "avatars", "chauffeurs"])
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
