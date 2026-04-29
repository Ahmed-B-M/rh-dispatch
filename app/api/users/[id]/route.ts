import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { hash } from "bcryptjs";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(["ADMIN", "RESPONSABLE"]).optional(),
  siteIds: z.array(z.string()).optional(),
});

export async function PUT(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = await req.json();
    const data = userUpdateSchema.parse(body);

    const { siteIds, password, ...fields } = data;

    const updateData: Record<string, unknown> = { ...fields };
    if (password) {
      updateData.password = await hash(password, 12);
    }

    const user = await prisma.$transaction(async (tx) => {
      if (siteIds !== undefined) {
        await tx.userSite.deleteMany({ where: { userId: id } });
        if (siteIds.length > 0) {
          await tx.userSite.createMany({
            data: siteIds.map((siteId) => ({ userId: id, siteId })),
          });
        }
      }
      return tx.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          sites: { include: { site: { select: { id: true, code: true, label: true } } } },
        },
      });
    });

    return NextResponse.json(user);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Données invalides" }, { status: 422 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    await prisma.user.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
