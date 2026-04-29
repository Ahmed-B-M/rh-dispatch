import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { employeeUpdateSchema } from "@/lib/validations";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    await requireAuth();
    const { id } = await ctx.params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        sites: { include: { site: true } },
        entries: {
          orderBy: { date: "desc" },
          take: 50,
          include: { absenceCode: true },
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employé non trouvé" }, { status: 404 });
    }

    return NextResponse.json(employee);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    await requireAuth();
    const { id } = await ctx.params;
    const body = await req.json();
    const data = employeeUpdateSchema.parse(body);

    const { siteIds, ...employeeData } = data;

    const updateData: Record<string, unknown> = { ...employeeData };
    if (employeeData.dateEntree) updateData.dateEntree = new Date(employeeData.dateEntree);
    if (employeeData.dateSortie !== undefined) updateData.dateSortie = employeeData.dateSortie ? new Date(employeeData.dateSortie) : null;

    const employee = await prisma.$transaction(async (tx) => {
      if (siteIds !== undefined) {
        await tx.employeeSite.deleteMany({ where: { employeeId: id } });
        if (siteIds.length > 0) {
          await tx.employeeSite.createMany({
            data: siteIds.map((siteId, i) => ({
              employeeId: id,
              siteId,
              isPrimary: i === 0,
              startDate: new Date(),
            })),
          });
        }
      }
      return tx.employee.update({
        where: { id },
        data: updateData,
        include: { sites: { include: { site: true } } },
      });
    });

    return NextResponse.json(employee);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Données invalides", details: err }, { status: 422 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    await requireAdmin();
    const { id } = await ctx.params;

    await prisma.employee.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
