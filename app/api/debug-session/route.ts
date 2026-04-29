import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// TEMP debug endpoint — remove after issue is resolved
export async function GET(): Promise<NextResponse> {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id as string },
    include: { sites: { select: { siteId: true, site: { select: { code: true } } } } },
  });

  return NextResponse.json({
    session: {
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role,
      jwtAllowedSiteIds: session.user.allowedSiteIds,
    },
    db: {
      found: !!dbUser,
      siteIds: dbUser?.sites.map((s) => ({ siteId: s.siteId, code: s.site.code })) ?? [],
    },
  });
}
