import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, assertEmployeeInScope } from "@/lib/auth";
import { workEntryUpdateSchema } from "@/lib/validations";
import { computeWorkDuration } from "@/lib/time-utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireAuth();
    const { id } = await ctx.params;
    const body = await req.json();
    const data = workEntryUpdateSchema.parse(body);

    const existing = await prisma.workEntry.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Entrée non trouvée" }, { status: 404 });
    }

    await assertEmployeeInScope(session, existing.employeeId);

    const heureDebut = data.heureDebut !== undefined ? data.heureDebut : existing.heureDebut;
    const heureFin = data.heureFin !== undefined ? data.heureFin : existing.heureFin;

    let tempsTravail = existing.tempsTravail;
    let heuresDecimales = existing.heuresDecimales ? Number(existing.heuresDecimales) : null;

    if (heureDebut && heureFin) {
      const posteConfig = await prisma.posteConfig.findUnique({
        where: { label: existing.posteOccupe ?? "" },
      }).catch(() => null);
      const result = computeWorkDuration(heureDebut, heureFin, posteConfig?.pauseMinutes ?? 0);
      tempsTravail = result.time;
      heuresDecimales = result.decimal;
    } else {
      tempsTravail = null;
      heuresDecimales = null;
    }

    const entry = await prisma.workEntry.update({
      where: { id },
      data: {
        ...data,
        tempsTravail,
        heuresDecimales,
        updatedBy: session.user.id,
      },
    });

    return NextResponse.json(entry);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Données invalides", details: err }, { status: 422 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
