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

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        registration: body.registration,
        isActive: body.isActive,
      },
    });
    return NextResponse.json(vehicle);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    await requireAuth();
    const { id } = await ctx.params;
    await prisma.vehicle.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
