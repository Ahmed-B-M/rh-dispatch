import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getAllowedSiteIds } from "@/lib/auth";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
} from "date-fns";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth();
    const { searchParams } = req.nextUrl;

    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const siteId = searchParams.get("siteId");
    const categorie = searchParams.get("categorie");

    const baseDate = fromParam ? new Date(fromParam) : new Date();
    const periodStart = fromParam
      ? new Date(fromParam)
      : startOfWeek(baseDate, { weekStartsOn: 1 });
    const periodEnd = toParam
      ? new Date(toParam)
      : endOfWeek(baseDate, { weekStartsOn: 1 });

    const days = eachDayOfInterval({ start: periodStart, end: periodEnd }).map(
      (d) => format(d, "yyyy-MM-dd"),
    );

    const allowedSites = getAllowedSiteIds(session);

    const employeeWhere: Record<string, unknown> = { isActive: true };
    if (categorie) employeeWhere.categorie = categorie;
    if (siteId) {
      employeeWhere.sites = { some: { siteId } };
    } else if (allowedSites) {
      employeeWhere.sites = { some: { siteId: { in: allowedSites } } };
    }

    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      select: {
        id: true,
        matricule: true,
        nom: true,
        prenom: true,
        categorie: true,
        typeContrat: true,
        poste: true,
      },
      orderBy: { nom: "asc" },
    });

    const entries = await prisma.workEntry.findMany({
      where: {
        employeeId: { in: employees.map((e) => e.id) },
        date: { gte: periodStart, lte: periodEnd },
      },
      include: {
        absenceCode: { select: { id: true, code: true, color: true } },
        vehicle: { select: { id: true, registration: true } },
      },
    });

    const entryMap = new Map<string, (typeof entries)[number]>();
    for (const entry of entries) {
      const key = `${entry.employeeId}_${format(entry.date, "yyyy-MM-dd")}`;
      entryMap.set(key, entry);
    }

    const matrix = employees.map((emp) => ({
      employee: emp,
      cells: days.map((day) => {
        const entry = entryMap.get(`${emp.id}_${day}`);
        return {
          date: day,
          entryId: entry?.id ?? null,
          absenceCodeId: entry?.absenceCode?.id ?? null,
          absenceCode: entry?.absenceCode?.code ?? null,
          absenceColor: entry?.absenceCode?.color ?? null,
          heureDebut: entry?.heureDebut ?? null,
          heureFin: entry?.heureFin ?? null,
          heuresDecimales: entry?.heuresDecimales
            ? Number(entry.heuresDecimales)
            : null,
          vehicleId: entry?.vehicle?.id ?? null,
          vehicule: entry?.vehicle?.registration ?? null,
          nbKm: entry?.nbKm ? Number(entry.nbKm) : null,
          typeRoute: entry?.typeRoute ?? null,
        };
      }),
    }));

    return NextResponse.json({
      from: format(periodStart, "yyyy-MM-dd"),
      to: format(periodEnd, "yyyy-MM-dd"),
      days,
      matrix,
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
