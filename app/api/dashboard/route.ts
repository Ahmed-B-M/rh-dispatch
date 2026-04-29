import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getEffectiveAllowedSiteIds } from "@/lib/auth";
import { startOfMonth, endOfMonth } from "date-fns";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth();
    const { searchParams } = req.nextUrl;

    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
    const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);

    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(monthStart);

    const allowedSites = await getEffectiveAllowedSiteIds(session);

    const employeeWhere: Record<string, unknown> = { isActive: true };
    if (allowedSites) {
      if (allowedSites.length === 0) {
        return NextResponse.json({ activeEmployees: 0, totalHours: 0, totalPaniers: 0, joursTravailles: 0 });
      }
      employeeWhere.sites = { some: { siteId: { in: allowedSites }, endDate: null } };
    }

    const activeEmployees = await prisma.employee.count({ where: employeeWhere });

    const entryWhere: Record<string, unknown> = {
      date: { gte: monthStart, lte: monthEnd },
    };
    if (allowedSites) {
      entryWhere.employee = { isActive: true, sites: { some: { siteId: { in: allowedSites }, endDate: null } } };
    }

    const NON_ABSENCE_CODES = new Set([
      "Repos",
      "Conges payes",
      "Congés sans solde",
      "Repos compensateur",
      "Paternité",
      "Congés naissance",
    ]);

    // Move heavy aggregation into the database using groupBy. This replaces
    // a full findMany (~6600 rows/month) + JS loop with two indexed aggregate
    // queries executed in parallel, plus one lookup on AbsenceCode.
    const [hoursByAffectation, absenceGroups] = await Promise.all([
      prisma.workEntry.groupBy({
        by: ["affectation"],
        where: { ...entryWhere, heuresDecimales: { not: null } },
        _sum: { heuresDecimales: true },
      }),
      prisma.workEntry.groupBy({
        by: ["absenceCodeId"],
        where: entryWhere,
        _count: { _all: true },
      }),
    ]);

    // Load AbsenceCode metadata only for codes actually present in the groupings.
    const absenceCodeIds = absenceGroups
      .map((g) => g.absenceCodeId)
      .filter((id): id is string => id !== null);
    const absenceCodes = absenceCodeIds.length
      ? await prisma.absenceCode.findMany({
          where: { id: { in: absenceCodeIds } },
          select: { id: true, code: true, color: true, isWork: true },
        })
      : [];
    const absenceCodeMap = new Map(absenceCodes.map((a) => [a.id, a]));

    // Total hours = sum of per-affectation sums. Decimal -> Number conversion.
    let totalHours = 0;
    const hoursBySiteMap = new Map<string, number>();
    for (const row of hoursByAffectation) {
      const hours = row._sum.heuresDecimales ? Number(row._sum.heuresDecimales) : 0;
      totalHours += hours;
      if (row.affectation) {
        hoursBySiteMap.set(
          row.affectation,
          (hoursBySiteMap.get(row.affectation) ?? 0) + hours,
        );
      }
    }

    // Work days vs absence days: count rows with isWork=true, and count rows
    // whose absenceCode is a real absence (not in NON_ABSENCE_CODES).
    let workDays = 0;
    let absenceDays = 0;
    const absenceCountMap = new Map<string, { count: number; color: string }>();

    for (const g of absenceGroups) {
      const count = g._count._all;
      if (g.absenceCodeId === null) continue;
      const code = absenceCodeMap.get(g.absenceCodeId);
      if (!code) continue;

      if (code.isWork) {
        workDays += count;
      } else if (!NON_ABSENCE_CODES.has(code.code)) {
        absenceDays += count;
        absenceCountMap.set(code.code, { count, color: code.color });
      }
    }

    const totalDays = workDays + absenceDays;
    const absenceRate = totalDays > 0 ? (absenceDays / totalDays) * 100 : 0;
    const avgHoursPerDay = workDays > 0 ? totalHours / workDays : 0;

    return NextResponse.json({
      totalHours: Math.round(totalHours * 100) / 100,
      absenceRate: Math.round(absenceRate * 10) / 10,
      activeEmployees,
      avgHoursPerDay: Math.round(avgHoursPerDay * 100) / 100,
      hoursBySite: Array.from(hoursBySiteMap.entries())
        .map(([site, hours]) => ({ site, hours: Math.round(hours * 100) / 100 }))
        .sort((a, b) => b.hours - a.hours),
      absenceDistribution: Array.from(absenceCountMap.entries())
        .map(([code, { count, color }]) => ({ code, count, color }))
        .sort((a, b) => b.count - a.count),
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
