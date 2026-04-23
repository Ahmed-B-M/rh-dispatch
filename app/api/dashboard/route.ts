import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getAllowedSiteIds } from "@/lib/auth";
import { startOfMonth, endOfMonth } from "date-fns";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth();
    const { searchParams } = req.nextUrl;

    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
    const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);

    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(monthStart);

    const allowedSites = getAllowedSiteIds(session);

    const employeeWhere: Record<string, unknown> = { isActive: true };
    if (allowedSites) {
      employeeWhere.sites = { some: { siteId: { in: allowedSites } } };
    }

    const activeEmployees = await prisma.employee.count({ where: employeeWhere });

    const entryWhere: Record<string, unknown> = {
      date: { gte: monthStart, lte: monthEnd },
    };
    if (allowedSites) {
      entryWhere.employee = { sites: { some: { siteId: { in: allowedSites } } } };
    }

    const entries = await prisma.workEntry.findMany({
      where: entryWhere,
      select: {
        heuresDecimales: true,
        absenceCode: { select: { code: true, color: true, isWork: true } },
        affectation: true,
      },
    });

    const NON_ABSENCE_CODES = new Set([
      "Repos",
      "Conges payes",
      "Congés sans solde",
      "Repos compensateur",
      "Paternité",
      "Congés naissance",
    ]);

    let totalHours = 0;
    let workDays = 0;
    let absenceDays = 0;
    const hoursBySiteMap = new Map<string, number>();
    const absenceCountMap = new Map<string, { count: number; color: string }>();

    for (const entry of entries) {
      const hours = entry.heuresDecimales ? Number(entry.heuresDecimales) : 0;
      totalHours += hours;

      if (entry.absenceCode?.isWork) {
        workDays++;
      } else if (entry.absenceCode && !NON_ABSENCE_CODES.has(entry.absenceCode.code)) {
        absenceDays++;
        const key = entry.absenceCode.code;
        const existing = absenceCountMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          absenceCountMap.set(key, { count: 1, color: entry.absenceCode.color });
        }
      }

      if (entry.affectation) {
        hoursBySiteMap.set(
          entry.affectation,
          (hoursBySiteMap.get(entry.affectation) ?? 0) + hours,
        );
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
