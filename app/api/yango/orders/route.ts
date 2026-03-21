import { NextResponse } from "next/server";

export async function GET() {
  try {
    const body = {
      limit: 100,

      query: {
        park: {
          id: process.env.ID_DU_PARTENAIRE,

          order: {
            ended_at: {
              from: "2024-01-01T00:00:00Z",
              to: new Date().toISOString(),
            },
          },
        },
      },
    };

    console.log("BODY SENT:", JSON.stringify(body, null, 2));

    const response = await fetch(process.env.YANGO_ORDERS_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.YANGO_ORDERS_API_KEY!,
        "X-Client-ID": process.env.CLID!,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();

    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch {
      return NextResponse.json({ error: text }, { status: 500 });
    }

  } catch (error) {
    return NextResponse.json(
      { error: "Erreur API orders" },
      { status: 500 }
    );
  }
}