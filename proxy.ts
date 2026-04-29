import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Public path prefixes — always allowed without authentication
const PUBLIC_PREFIXES: readonly string[] = [
  "/auth",
  "/_next",
  "/api/auth",
  "/favicon",
  "/illustrations",
  "/logo.svg",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Let public routes pass through
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // No token — redirect to sign-in
  if (!token) {
    const signInUrl = new URL("/auth/signin", request.url);
    return NextResponse.redirect(signInUrl);
  }

  // ADMIN role bypasses allowedPages restrictions
  if (token.role === "ADMIN") {
    return NextResponse.next();
  }

  // API routes always pass — they enforce their own access control via requireAuth()
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // RESPONSABLE: enforce allowedPages if the list is non-empty
  const allowedPages = Array.isArray(token.allowedPages)
    ? (token.allowedPages as string[])
    : [];

  if (allowedPages.length === 0) {
    // Empty list means no restriction
    return NextResponse.next();
  }

  const isAllowed = allowedPages.some((page) => pathname.startsWith(page));
  if (isAllowed) {
    return NextResponse.next();
  }

  // Not allowed — redirect to the first allowed page, or sign-in as fallback
  const firstAllowed = allowedPages[0];
  const target = firstAllowed && firstAllowed.startsWith("/")
    ? firstAllowed
    : "/auth/signin";
  return NextResponse.redirect(new URL(target, request.url));
}

export const config = {
  matcher: [
    // Match all paths except Next internals, static files, and favicon
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
