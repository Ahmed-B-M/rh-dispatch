import { defineConfig, env } from "prisma/config";

// dotenv only needed locally to load .env.local — in Docker, env vars are set by compose
try {
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env.local" });
} catch {
  // production: dotenv not installed, env vars already available
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
