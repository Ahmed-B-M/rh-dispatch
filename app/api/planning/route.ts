import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getAllowedSiteIds } from "@/lib/auth";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
} from "date-fns";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth();
    const { searchParams } = req.nextUrl;

    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
    const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);
    const siteId = searchParams.get("siteId");
    const categorie = searchParams.get("categorie");

    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(monthStart);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd }).map((d) =>
      format(d, "yyyy-MM-dd"),
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
      },
      orderBy: { nom: "asc" },
    });

    const entries = await prisma.workEntry.findMany({
      where: {
        employeeId: { in: employees.map((e) => e.id) },
        date: { gte: monthStart, lte: monthEnd },
      },
      include: {
        absenceCode: { select: { code: true, color: true } },
        vehicle: { select: { registration: true } },
      },
    });

    const entryMap = new Map<string, typeof entries[number]>();
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
          absenceCode: entry?.absenceCode?.code ?? null,
          absenceColor: entry?.absenceCode?.color ?? null,
          heureDebut: entry?.heureDebut ?? null,
          heureFin: entry?.heureFin ?? null,
          heuresDecimales: entry?.heuresDecimales ? Number(entry.heuresDecimales) : null,
          vehicule: entry?.vehicle?.registration ?? null,
          nbKm: entry?.nbKm ? Number(entry.nbKm) : null,
        };
      }),
    }));

    return NextResponse.json({ year, month, days, matrix });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
