import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getAllowedSiteIds, assertEmployeeInScope } from "@/lib/auth";
import { workEntryCreateSchema } from "@/lib/validations";
import { computeWorkDuration, getDayNameFr, getWeekNumber } from "@/lib/time-utils";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth();
    const { searchParams } = req.nextUrl;

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const employeeId = searchParams.get("employeeId");
    const siteId = searchParams.get("siteId");
    const categorie = searchParams.get("categorie");
    const absenceCode = searchParams.get("absenceCode");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "1000", 10);
    const sortField = searchParams.get("sortField") ?? "date";
    const sortDir = searchParams.get("sortDir") ?? "desc";

    const allowedSites = getAllowedSiteIds(session);

    const where: Record<string, unknown> = {};

    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, unknown>).gte = new Date(from);
      if (to) (where.date as Record<string, unknown>).lte = new Date(to);
    }
    if (employeeId) where.employeeId = employeeId;
    if (absenceCode) where.absenceCodeId = absenceCode;
    if (search) {
      where.OR = [
        { nomConducteur: { contains: search, mode: "insensitive" } },
        { matricule: { contains: search, mode: "insensitive" } },
        { affectation: { contains: search, mode: "insensitive" } },
      ];
    }

    const employeeFilter: Record<string, unknown> = {};
    if (siteId) {
      employeeFilter.sites = { some: { siteId, endDate: null } };
    } else if (allowedSites) {
      if (allowedSites.length === 0) {
        return NextResponse.json({ rows: [], total: 0, page, limit });
      }
      employeeFilter.sites = { some: { siteId: { in: allowedSites }, endDate: null } };
    }
    if (categorie) {
      employeeFilter.categorie = categorie;
    }
    if (Object.keys(employeeFilter).length > 0) {
      where.employee = employeeFilter;
    }

    const [entries, total] = await Promise.all([
      prisma.workEntry.findMany({
        where,
        include: {
          absenceCode: { select: { code: true, color: true } },
          vehicle: { select: { registration: true } },
        },
        orderBy: { [sortField]: sortDir },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.workEntry.count({ where }),
    ]);

    const rows = entries.map((e) => ({
      id: e.id,
      weekNumber: e.weekNumber,
      date: e.date.toISOString().split("T")[0],
      dayName: e.dayName,
      affectation: e.affectation,
      typeContrat: e.typeContrat,
      matricule: e.matricule,
      nomConducteur: e.nomConducteur,
      motifAbsence: e.absenceCode?.code ?? null,
      absenceColor: e.absenceCode?.color ?? null,
      posteOccupe: e.posteOccupe,
      heureDebut: e.heureDebut,
      heureFin: e.heureFin,
      tempsTravail: e.tempsTravail,
      heuresDecimales: e.heuresDecimales ? Number(e.heuresDecimales) : null,
      vehicule: e.vehicle?.registration ?? null,
      typeRoute: e.typeRoute,
      nbKm: e.nbKm ? Number(e.nbKm) : null,
    }));

    return NextResponse.json({ rows, total, page, limit });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const data = workEntryCreateSchema.parse(body);

    const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee) {
      return NextResponse.json({ error: "Employé non trouvé" }, { status: 404 });
    }

    await assertEmployeeInScope(session, data.employeeId);

    const posteConfig = await prisma.posteConfig.findFirst({ where: { label: { equals: employee.poste, mode: "insensitive" } } }).catch(() => null);
    const pauseMinutes = posteConfig?.pauseMinutes ?? 0;
    const date = new Date(data.date);
    let tempsTravail: string | null = null;
    let heuresDecimales: number | null = null;

    if (data.heureDebut && data.heureFin) {
      const result = computeWorkDuration(data.heureDebut, data.heureFin, pauseMinutes);
      tempsTravail = result.time;
      heuresDecimales = result.decimal;
    }

    const entry = await prisma.workEntry.upsert({
      where: {
        employeeId_date: { employeeId: data.employeeId, date },
      },
      update: {
        absenceCodeId: data.absenceCodeId ?? null,
        heureDebut: data.heureDebut ?? null,
        heureFin: data.heureFin ?? null,
        tempsTravail,
        heuresDecimales,
        vehicleId: data.vehicleId ?? null,
        typeRoute: data.typeRoute ?? null,
        nbKm: data.nbKm ?? null,
        updatedBy: session.user.id,
      },
      create: {
        employeeId: data.employeeId,
        date,
        weekNumber: getWeekNumber(date),
        dayName: getDayNameFr(date),
        affectation: employee.affectationCode,
        typeContrat: employee.typeContrat,
        matricule: employee.matricule,
        nomConducteur: `${employee.nom} ${employee.prenom}`,
        posteOccupe: employee.poste,
        absenceCodeId: data.absenceCodeId ?? null,
        heureDebut: data.heureDebut ?? null,
        heureFin: data.heureFin ?? null,
        tempsTravail,
        heuresDecimales,
        vehicleId: data.vehicleId ?? null,
        typeRoute: data.typeRoute ?? null,
        nbKm: data.nbKm ?? null,
        source: "MANUAL",
        updatedBy: session.user.id,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Données invalides", details: err }, { status: 422 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
