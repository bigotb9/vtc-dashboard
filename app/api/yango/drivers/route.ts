import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url = process.env.YANGO_DRIVERS_URL!;
    const apiKey = process.env.YANGO_DRIVERS_API_KEY!;

    console.log("URL:", url);
    console.log("API KEY EXISTS:", !!apiKey);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`, // ✅ FIX ICI
        "Accept-Language": "fr",
      },
      body: JSON.stringify({
        query: {
          park: {
            id: process.env.ID_DU_PARTENAIRE,
          },
        },
        limit: 1000,
        offset: 0,
      }),
      cache: "no-store", // 🔥 important en prod
    });

    const data = await response.json();

    console.log("YANGO RESPONSE:", data);

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.message || "Erreur Yango API", raw: data },
        { status: response.status }
      );
    }

    const drivers =
      data.driver_profiles?.map((d: any) => ({
        id: d.driver_profile?.id,
        nom: d.driver_profile?.last_name,
        prenom: d.driver_profile?.first_name,
        telephone: d.driver_profile?.phones?.[0] || "N/A",

        statut: d.current_status?.status,
        work_status: d.driver_profile?.work_status,

        vehicle: d.car
          ? `${d.car.brand} ${d.car.model}`
          : "Aucun véhicule",

        plaque: d.car?.number || "-",
        solde: d.accounts?.[0]?.balance || "0",
      })) || [];

    return NextResponse.json({ drivers });
  } catch (error) {
    console.error("ERREUR SERVEUR:", error);

    return NextResponse.json(
      { error: "Erreur serveur interne" },
      { status: 500 }
    );
  }
}