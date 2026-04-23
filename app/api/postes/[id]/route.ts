import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    await requireAuth();
    const { id } = await ctx.params;
    const body = await req.json();

    const poste = await prisma.posteConfig.update({
      where: { id },
      data: {
        ...(body.label != null && { label: body.label.trim() }),
        ...(body.mealAllowance != null && { mealAllowance: body.mealAllowance }),
        ...(body.pauseMinutes != null && { pauseMinutes: body.pauseMinutes }),
        ...(body.isActive != null && { isActive: body.isActive }),
      },
    });
    return NextResponse.json(poste);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    await requireAuth();
    const { id } = await ctx.params;
    await prisma.posteConfig.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
