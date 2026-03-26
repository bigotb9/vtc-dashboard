import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("commandes_yango")
      .select("raw")
      .order("created_at", { ascending: false })
      .limit(5000)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const orders = (data ?? []).map((row) => row.raw)

    return NextResponse.json({ orders, total: orders.length })
  } catch (err) {
    console.error("Erreur lecture orders:", err)
    return NextResponse.json({ error: "Erreur API orders" }, { status: 500 })
  }
}
