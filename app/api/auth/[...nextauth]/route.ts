import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { sites: { select: { siteId: true } } },
        });
        if (!user?.password) return null;

        const isValid = user.password.startsWith("$2")
          ? await compare(credentials.password, user.password)
          : false;

        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          allowedSiteIds: user.sites.map((s) => s.siteId),
          allowedPages: user.allowedPages ?? [],
        };
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/auth/signin" },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.allowedSiteIds = user.allowedSiteIds ?? [];
        token.allowedPages = user.allowedPages ?? [];
      }
      if (trigger === "update") {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id },
            include: { sites: { select: { siteId: true } } },
          });
          if (dbUser) {
            token.role = dbUser.role;
            token.allowedSiteIds = dbUser.sites.map((s) => s.siteId);
            token.allowedPages = dbUser.allowedPages ?? [];
          }
        } catch {
          // DB unreachable — keep existing token values
        }
      }
      if (!token.allowedSiteIds) token.allowedSiteIds = [];
      if (!token.allowedPages) token.allowedPages = [];
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.allowedSiteIds = token.allowedSiteIds ?? [];
        session.user.allowedPages = token.allowedPages ?? [];
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
