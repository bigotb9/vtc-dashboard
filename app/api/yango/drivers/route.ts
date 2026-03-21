import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(
      process.env.YANGO_DRIVERS_URL!,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.YANGO_DRIVERS_API_KEY!,
          "X-Client-ID": process.env.CLID!,
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
      }
    );

    const data = await response.json();

    // 🔴 DEBUG IMPORTANT (à enlever après test)
    console.log("YANGO RESPONSE:", data);

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.message || "Erreur Yango API" },
        { status: response.status }
      );
    }

    const drivers = data.driver_profiles?.map((d: any) => ({
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

