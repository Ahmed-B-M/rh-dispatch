import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const transferSchema = z.object({
  newSiteId: z.string().min(1),
  newPoste: z.string().optional(),
  effectiveDate: z.string().min(1),
});

export async function POST(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    await requireAuth();
    const { id } = await ctx.params;
    const body = await req.json();
    const { newSiteId, newPoste, effectiveDate } = transferSchema.parse(body);

    const date = new Date(effectiveDate);

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { sites: { where: { endDate: null } } },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employé non trouvé" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      for (const site of employee.sites) {
        await tx.employeeSite.update({
          where: { id: site.id },
          data: { endDate: date },
        });
      }

      await tx.employeeSite.create({
        data: {
          employeeId: id,
          siteId: newSiteId,
          isPrimary: true,
          startDate: date,
        },
      });

      const updateData: Record<string, unknown> = {};
      if (newPoste) updateData.poste = newPoste;
      if (Object.keys(updateData).length > 0) {
        await tx.employee.update({
          where: { id },
          data: updateData,
        });
      }
    });

    const updated = await prisma.employee.findUnique({
      where: { id },
      include: { sites: { include: { site: true }, orderBy: { startDate: "desc" } } },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Données invalides" }, { status: 422 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
