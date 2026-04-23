import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin, getAllowedSiteIds } from "@/lib/auth";
import { employeeCreateSchema } from "@/lib/validations";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth();
    const { searchParams } = req.nextUrl;

    const isActive = searchParams.get("active");
    const categorie = searchParams.get("categorie");
    const siteId = searchParams.get("siteId");
    const search = searchParams.get("search");

    const allowedSites = getAllowedSiteIds(session);

    const where: Record<string, unknown> = {};

    if (isActive !== null) {
      where.isActive = isActive === "true";
    }
    if (categorie) {
      where.categorie = categorie;
    }
    if (search) {
      where.OR = [
        { nom: { contains: search, mode: "insensitive" } },
        { prenom: { contains: search, mode: "insensitive" } },
        { matricule: { contains: search, mode: "insensitive" } },
      ];
    }

    if (siteId) {
      where.sites = { some: { siteId } };
    } else if (allowedSites) {
      where.sites = { some: { siteId: { in: allowedSites } } };
    }

    const employees = await prisma.employee.findMany({
      where,
      include: {
        sites: {
          include: { site: { select: { id: true, code: true, label: true } } },
        },
      },
      orderBy: [{ isActive: "desc" }, { nom: "asc" }],
    });

    return NextResponse.json(employees);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();
    const body = await req.json();
    const data = employeeCreateSchema.parse(body);

    const { siteIds, ...employeeData } = data;

    const employee = await prisma.employee.create({
      data: {
        ...employeeData,
        dateDebut: new Date(employeeData.dateDebut),
        dateFin: employeeData.dateFin ? new Date(employeeData.dateFin) : null,
        dateEntree: new Date(employeeData.dateEntree),
        dateSortie: employeeData.dateSortie ? new Date(employeeData.dateSortie) : null,
        sites: siteIds?.length
          ? {
              create: siteIds.map((siteId, i) => ({
                siteId,
                isPrimary: i === 0,
                startDate: new Date(employeeData.dateEntree),
              })),
            }
          : undefined,
      },
      include: {
        sites: { include: { site: true } },
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Données invalides", details: err }, { status: 422 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
