import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { hash } from "bcryptjs";
import { z } from "zod";

const userCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "RESPONSABLE"]),
  siteIds: z.array(z.string()).default([]),
});

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        sites: { include: { site: { select: { id: true, code: true, label: true } } } },
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(users);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();
    const body = await req.json();
    const data = userCreateSchema.parse(body);

    const hashedPassword = await hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role,
        sites: data.siteIds.length
          ? { create: data.siteIds.map((siteId) => ({ siteId })) }
          : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        sites: { include: { site: true } },
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
