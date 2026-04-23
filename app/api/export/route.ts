import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getAllowedSiteIds } from "@/lib/auth";
import { generateExcel } from "@/lib/excel-export";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth();
    const { searchParams } = req.nextUrl;

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const siteId = searchParams.get("siteId");
    const format = (searchParams.get("format") ?? "synthesis") as
      | "synthesis"
      | "site"
      | "employee"
      | "month";

    const allowedSites = getAllowedSiteIds(session);

    const where: Record<string, unknown> = {};
    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, unknown>).gte = new Date(from);
      if (to) (where.date as Record<string, unknown>).lte = new Date(to);
    }
    if (siteId) {
      where.employee = { sites: { some: { siteId } } };
    } else if (allowedSites) {
      where.employee = { sites: { some: { siteId: { in: allowedSites } } } };
    }

    const entries = await prisma.workEntry.findMany({
      where,
      include: {
        absenceCode: { select: { code: true } },
        vehicle: { select: { registration: true } },
      },
      orderBy: [{ date: "asc" }, { nomConducteur: "asc" }],
    });

    const rows = entries.map((e) => ({
      weekNumber: e.weekNumber,
      date: e.date.toISOString().split("T")[0],
      dayName: e.dayName,
      affectation: e.affectation,
      typeContrat: e.typeContrat,
      matricule: e.matricule,
      nomConducteur: e.nomConducteur,
      motifAbsence: e.absenceCode?.code ?? null,
      posteOccupe: e.posteOccupe,
      heureDebut: e.heureDebut,
      heureFin: e.heureFin,
      tempsTravail: e.tempsTravail,
      heuresDecimales: e.heuresDecimales ? Number(e.heuresDecimales) : null,
      vehicule: e.vehicle?.registration ?? null,
      typeRoute: e.typeRoute,
      nbKm: e.nbKm ? Number(e.nbKm) : null,
    }));

    const buffer = await generateExcel(rows, format);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="rh-dispatch-export-${new Date().toISOString().split("T")[0]}.xlsx"`,
      },
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
