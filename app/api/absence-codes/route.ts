import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(): Promise<NextResponse> {
  try {
    await requireAuth();
    const codes = await prisma.absenceCode.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(codes);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
