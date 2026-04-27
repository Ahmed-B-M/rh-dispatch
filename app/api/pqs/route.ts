import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getAllowedSiteIds } from "@/lib/auth";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth();
    const { searchParams } = req.nextUrl;

    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
    const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);
    const siteId = searchParams.get("siteId") || undefined;
    const categorie = searchParams.get("categorie") || undefined;

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
        pqsEvaluations: {
          where: { year, month },
          select: {
            id: true,
            validatedBy: true,
            comment: true,
            items: {
              select: {
                criteriaId: true,
                achieved: true,
              },
            },
          },
        },
      },
    });

    // Build a map of poste → criteria
    const posteLabels = [...new Set(employees.map((e) => e.poste))];
    const posteConfigs = await prisma.posteConfig.findMany({
      where: { label: { in: posteLabels }, isActive: true },
      include: {
        pqsCriteria: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, label: true, amount: true, sortOrder: true },
        },
      },
    });
    const posteMap = new Map(posteConfigs.map((p) => [p.label, p.pqsCriteria]));

    const employeesResult = employees.map((emp) => {
      const criteria = (posteMap.get(emp.poste) ?? []).map((c) => ({
        id: c.id,
        label: c.label,
        amount: Number(c.amount),
        sortOrder: c.sortOrder,
      }));

      const evaluation = emp.pqsEvaluations[0] ?? null;

      const achievedCriteriaIds = new Set(
        evaluation?.items.filter((i) => i.achieved).map((i) => i.criteriaId) ?? [],
      );

      const totalAchieved = criteria
        .filter((c) => achievedCriteriaIds.has(c.id))
        .reduce((sum, c) => sum + c.amount, 0);

      const totalPossible = criteria.reduce((sum, c) => sum + c.amount, 0);

      return {
        employeeId: emp.id,
        matricule: emp.matricule,
        nom: emp.nom,
        prenom: emp.prenom,
        poste: emp.poste,
        categorie: emp.categorie,
        criteria,
        evaluation: evaluation
          ? {
              id: evaluation.id,
              items: evaluation.items,
              validatedBy: evaluation.validatedBy,
              comment: evaluation.comment,
            }
          : null,
        totalAchieved,
        totalPossible,
      };
    });

    return NextResponse.json({ year, month, employees: employeesResult });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth();
    const body = await req.json() as {
      employeeId: string;
      year: number;
      month: number;
      items: { criteriaId: string; achieved: boolean }[];
      comment?: string;
    };

    const { employeeId, year, month, items, comment } = body;

    if (!employeeId || !year || !month || !Array.isArray(items)) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }

    // Upsert evaluation
    const evaluation = await prisma.pqsEvaluation.upsert({
      where: { employeeId_year_month: { employeeId, year, month } },
      update: {
        validatedBy: session.user.name ?? session.user.email ?? "Inconnu",
        comment: comment ?? null,
      },
      create: {
        employeeId,
        year,
        month,
        validatedBy: session.user.name ?? session.user.email ?? "Inconnu",
        comment: comment ?? null,
      },
    });

    // Upsert items
    for (const item of items) {
      await prisma.pqsEvaluationItem.upsert({
        where: { evaluationId_criteriaId: { evaluationId: evaluation.id, criteriaId: item.criteriaId } },
        update: { achieved: item.achieved },
        create: {
          evaluationId: evaluation.id,
          criteriaId: item.criteriaId,
          achieved: item.achieved,
        },
      });
    }

    return NextResponse.json({ id: evaluation.id, success: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
