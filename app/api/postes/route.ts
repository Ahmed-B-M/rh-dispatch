import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(): Promise<NextResponse> {
  try {
    await requireAuth();
    const postes = await prisma.posteConfig.findMany({
      orderBy: { label: "asc" },
    });
    return NextResponse.json(postes);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth();
    const body = await req.json();

    if (!body.label?.trim()) {
      return NextResponse.json({ error: "Libellé requis" }, { status: 422 });
    }

    const poste = await prisma.posteConfig.create({
      data: {
        label: body.label.trim(),
        mealAllowance: body.mealAllowance ?? 0,
        pauseMinutes: body.pauseMinutes ?? 0,
      },
    });
    return NextResponse.json(poste, { status: 201 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint failed")
    ) {
      return NextResponse.json(
        { error: "Ce poste existe déjà" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
