import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { vehicleCreateSchema } from "@/lib/validations";

export async function GET(): Promise<NextResponse> {
  try {
    await requireAuth();
    const vehicles = await prisma.vehicle.findMany({
      orderBy: { registration: "asc" },
    });
    return NextResponse.json(vehicles);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();
    const body = await req.json();
    const data = vehicleCreateSchema.parse(body);

    const vehicle = await prisma.vehicle.create({ data });
    return NextResponse.json(vehicle, { status: 201 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
