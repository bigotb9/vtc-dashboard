import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy() {
  return NextResponse.next()
}

export const config = {
  matcher: [
    "/dashboard",
    "/vehicules",
    "/chauffeurs",
    "/recettes",
    "/depenses",
    "/ai-insights",
    "/parametres"
  ]
}