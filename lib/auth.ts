import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";

export async function getAuthSession(): Promise<Session | null> {
  return getServerSession(authOptions);
}

export async function requireAuth(): Promise<Session> {
  const session = await getAuthSession();
  if (!session?.user) {
    throw NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireAuth();
  if (session.user.role !== "ADMIN") {
    throw NextResponse.json({ error: "Accès refusé — rôle ADMIN requis" }, { status: 403 });
  }
  return session;
}

export function isAdmin(session: Session): boolean {
  return session.user.role === "ADMIN";
}

export function getAllowedSiteIds(session: Session): string[] | null {
  if (isAdmin(session)) return null;
  return session.user.allowedSiteIds;
}

export async function assertEmployeeInScope(
  session: Session,
  employeeId: string,
): Promise<void> {
  // ADMIN bypasses site-scope checks
  if (isAdmin(session)) return;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { sites: { select: { siteId: true } } },
  });

  if (!employee) {
    throw NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const allowedSiteIds = session.user.allowedSiteIds ?? [];
  const hasAccess = employee.sites.some((s) =>
    allowedSiteIds.includes(s.siteId),
  );

  if (!hasAccess) {
    throw NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
}
