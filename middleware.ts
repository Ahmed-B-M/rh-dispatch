export { default } from "next-auth/middleware";

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
    "/api/employees/:path*",
    "/api/work-entries/:path*",
    "/api/planning/:path*",
    "/api/export/:path*",
    "/api/import/:path*",
    "/api/sites/:path*",
    "/api/vehicles/:path*",
    "/api/absence-codes/:path*",
    "/api/dashboard/:path*",
    "/api/users/:path*",
  ],
};
