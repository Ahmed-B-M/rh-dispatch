import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getAllowedSiteIds } from "@/lib/auth";
import { startOfMonth, endOfMonth } from "date-fns";
import { nightHoursOverlap } from "@/lib/time-utils";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth();
    const { searchParams } = req.nextUrl;

    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
    const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);
    const siteId = searchParams.get("siteId") || undefined;
    const categorie = searchParams.get("categorie") || undefined;

    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(monthStart);

    const allowedSites = getAllowedSiteIds(session);

    const employeeWhere: Record<string, unknown> = { isActive: true };
    if (siteId) {
      employeeWhere.sites = { some: { siteId, endDate: null } };
    } else if (allowedSites) {
      employeeWhere.sites = { some: { siteId: { in: allowedSites }, endDate: null } };
    }
    if (categorie) {
      employeeWhere.categorie = categorie;
    }

    // Performance note: this endpoint intentionally keeps a nested `entries`
    // include rather than a `workEntry.groupBy` aggregation.
    //
    // Reason: per-row night-hours calculation requires `nightHoursOverlap` over
    // the pair (heureDebut, heureFin), which cannot be expressed in SQL without
    // pushing a custom function. A groupBy would therefore still need a second
    // pass fetching the raw heureDebut/heureFin pairs, negating the savings and
    // adding complexity. Prisma issues a single JOIN for this query (no N+1 at
    // the SQL layer), so the current shape is acceptable.
    //
    // If this endpoint becomes a bottleneck, consider:
    //   1. A persisted `heuresNuit` column computed at write-time.
    //   2. A raw SQL query with a stored procedure or CTE doing the overlap math.
    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
      select: {
        id: true,
        matricule: true,
        nom: true,
        prenom: true,
        poste: true,
        categorie: true,
        typeContrat: true,
        entries: {
          where: {
            date: { gte: monthStart, lte: monthEnd },
          },
          select: {
            date: true,
            heureDebut: true,
            heureFin: true,
            heuresDecimales: true,
            absenceCode: { select: { isWork: true } },
          },
        },
      },
    });

    const posteConfigs = await prisma.posteConfig.findMany({
      where: { isActive: true },
      include: {
        pqsCriteria: {
          where: { isActive: true },
          select: { id: true, amount: true },
        },
      },
    });
    const posteMap = new Map(posteConfigs.map((p) => [p.label.toLowerCase(), Number(p.mealAllowance)]));
    const postePqsCriteriaMap = new Map(
      posteConfigs.map((p) => [p.label.toLowerCase(), p.pqsCriteria]),
    );

    // Fetch all PQS evaluations for this month in a single query
    const employeeIds = employees.map((e) => e.id);
    const pqsEvaluations = await prisma.pqsEvaluation.findMany({
      where: { employeeId: { in: employeeIds }, year, month },
      select: {
        employeeId: true,
        items: { select: { criteriaId: true, achieved: true } },
      },
    });
    const pqsMap = new Map(pqsEvaluations.map((ev) => [ev.employeeId, ev]));

    const rows = employees.map((emp) => {
      let joursTravailles = 0;
      let heuresTotales = 0;
      let heuresNuit = 0;
      let joursDimanche = 0;

      for (const entry of emp.entries) {
        const isWork = entry.absenceCode?.isWork === true;
        if (isWork) {
          joursTravailles++;
          heuresTotales += entry.heuresDecimales ? Number(entry.heuresDecimales) : 0;

          if (entry.heureDebut && entry.heureFin) {
            heuresNuit += nightHoursOverlap(entry.heureDebut, entry.heureFin);
          }

          if (new Date(entry.date).getDay() === 0) {
            joursDimanche++;
          }
        }
      }

      const mealRate = posteMap.get(emp.poste.toLowerCase()) ?? 0;
      const montantPanier = Math.round(joursTravailles * mealRate * 100) / 100;

      const pqsEval = pqsMap.get(emp.id);
      const achievedIds = new Set(
        pqsEval?.items.filter((i) => i.achieved).map((i) => i.criteriaId) ?? [],
      );
      const pqsCriteria = postePqsCriteriaMap.get(emp.poste.toLowerCase()) ?? [];
      const montantPqs = Math.round(
        pqsCriteria.filter((c) => achievedIds.has(c.id)).reduce((s, c) => s + Number(c.amount), 0) * 100,
      ) / 100;

      return {
        employeeId: emp.id,
        matricule: emp.matricule,
        nom: emp.nom,
        prenom: emp.prenom,
        poste: emp.poste,
        categorie: emp.categorie,
        typeContrat: emp.typeContrat,
        joursTravailles,
        joursDimanche,
        heuresTotales: Math.round(heuresTotales * 100) / 100,
        heuresNuit: Math.round(heuresNuit * 100) / 100,
        nbPanierRepas: joursTravailles,
        tarifPanier: mealRate,
        montantPanier,
        montantPqs,
        pqsEvalue: pqsEval !== undefined,
      };
    });

    return NextResponse.json({
      year,
      month,
      rows,
      totals: {
        joursTravailles: rows.reduce((s, r) => s + r.joursTravailles, 0),
        joursDimanche: rows.reduce((s, r) => s + r.joursDimanche, 0),
        heuresTotales: Math.round(rows.reduce((s, r) => s + r.heuresTotales, 0) * 100) / 100,
        heuresNuit: Math.round(rows.reduce((s, r) => s + r.heuresNuit, 0) * 100) / 100,
        montantPanier: Math.round(rows.reduce((s, r) => s + r.montantPanier, 0) * 100) / 100,
        montantPqs: Math.round(rows.reduce((s, r) => s + r.montantPqs, 0) * 100) / 100,
      },
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
