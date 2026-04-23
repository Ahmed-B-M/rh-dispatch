import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { siteCreateSchema } from "@/lib/validations";

export async function GET(): Promise<NextResponse> {
  try {
    await requireAuth();
    const sites = await prisma.site.findMany({
      orderBy: { code: "asc" },
      include: { _count: { select: { employees: true } } },
    });
    return NextResponse.json(sites);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();
    const body = await req.json();
    const data = siteCreateSchema.parse(body);

    const site = await prisma.site.create({ data });
    return NextResponse.json(site, { status: 201 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
