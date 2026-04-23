import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

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
