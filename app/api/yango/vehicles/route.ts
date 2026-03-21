import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(process.env.YANGO_CARS_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.YANGO_CARS_API_KEY!,
        "X-Client-ID": process.env.CLID!,
      },
      body: JSON.stringify({
        limit: 500,
        offset: 0,
        query: {
          park: {
            id: process.env.ID_DU_PARTENAIRE,
          },
        },
        fields: {
          car: [
            "id",
            "brand",
            "model",
            "number",
            "status",
            "year",
          ],
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur API Yango vehicles" },
      { status: 500 }
    );
  }
}

