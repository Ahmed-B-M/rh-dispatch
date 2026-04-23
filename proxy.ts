import { NextRequest } from "next/server";
import nextAuthMiddleware from "next-auth/middleware";

export function proxy(request: NextRequest) {
  return (nextAuthMiddleware as (req: NextRequest) => Response)(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/employes/:path*",
    "/planning/:path*",
    "/synthese/:path*",
    "/import/:path*",
    "/vehicules/:path*",
    "/sites/:path*",
    "/parametres/:path*",
  ],
};
