import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth();
    const { searchParams } = req.nextUrl;
    const poste = searchParams.get("poste");

    if (!poste) {
      return NextResponse.json({ error: "Paramètre 'poste' requis" }, { status: 400 });
    }

    const posteConfig = await prisma.posteConfig.findUnique({
      where: { label: poste },
      include: {
        pqsCriteria: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, label: true, amount: true, sortOrder: true },
        },
      },
    });

    if (!posteConfig) {
      return NextResponse.json({ error: "Poste introuvable" }, { status: 404 });
    }

    return NextResponse.json({
      poste: posteConfig.label,
      criteria: posteConfig.pqsCriteria.map((c) => ({
        id: c.id,
        label: c.label,
        amount: Number(c.amount),
        sortOrder: c.sortOrder,
      })),
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
