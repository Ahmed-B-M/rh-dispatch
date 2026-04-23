import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const ABSENCE_CODES = [
  { code: "Présent", label: "Présent", color: "#22c55e", isWork: true, sortOrder: 1 },
  { code: "Repos", label: "Repos", color: "#3b82f6", isWork: false, sortOrder: 2 },
  { code: "Formation", label: "Formation", color: "#8b5cf6", isWork: true, sortOrder: 3 },
  { code: "Absence injustifiée", label: "Absence injustifiée", color: "#ef4444", isWork: false, sortOrder: 4 },
  { code: "Accident travail", label: "Accident travail", color: "#f97316", isWork: false, sortOrder: 5 },
  { code: "Conges payes", label: "Congés payés", color: "#06b6d4", isWork: false, sortOrder: 6 },
  { code: "Maladie", label: "Maladie", color: "#f43f5e", isWork: false, sortOrder: 7 },
  { code: "Mise à pied", label: "Mise à pied", color: "#dc2626", isWork: false, sortOrder: 8 },
  { code: "Abs convenu non rémunérée", label: "Absence convenue non rémunérée", color: "#a855f7", isWork: false, sortOrder: 9 },
  { code: "Accident Trajet", label: "Accident Trajet", color: "#f97316", isWork: false, sortOrder: 10 },
  { code: "Congés sans solde", label: "Congés sans solde", color: "#0ea5e9", isWork: false, sortOrder: 11 },
  { code: "Abs evenement fam.", label: "Absence événement familial", color: "#d946ef", isWork: false, sortOrder: 12 },
  { code: "Congés naissance", label: "Congés naissance", color: "#14b8a6", isWork: false, sortOrder: 13 },
  { code: "Mal. professionnelle", label: "Maladie professionnelle", color: "#e11d48", isWork: false, sortOrder: 14 },
  { code: "Paternité", label: "Paternité", color: "#2563eb", isWork: false, sortOrder: 15 },
  { code: "Préavis non eff. pay", label: "Préavis non effectué payé", color: "#eab308", isWork: false, sortOrder: 16 },
  { code: "Préavis n.eff. n.pay", label: "Préavis non effectué non payé", color: "#ca8a04", isWork: false, sortOrder: 17 },
  { code: "Repos compensateur", label: "Repos compensateur", color: "#6366f1", isWork: false, sortOrder: 18 },
] as const;

const SITES = [
  { code: "RUNGIS", label: "Rungis" },
  { code: "VITRY", label: "Vitry" },
  { code: "VLG", label: "VLG" },
  { code: "LPP", label: "LPP" },
  { code: "CASTRIES", label: "Castries" },
  { code: "ANTIBES", label: "Antibes" },
  { code: "ROSNY", label: "Rosny" },
] as const;

async function main(): Promise<void> {
  console.log("Seeding absence codes...");
  for (const ac of ABSENCE_CODES) {
    await prisma.absenceCode.upsert({
      where: { code: ac.code },
      update: { label: ac.label, color: ac.color, isWork: ac.isWork, sortOrder: ac.sortOrder },
      create: ac,
    });
  }

  console.log("Seeding sites...");
  for (const site of SITES) {
    await prisma.site.upsert({
      where: { code: site.code },
      update: { label: site.label },
      create: site,
    });
  }

  console.log("Seeding admin user...");
  const hashedPassword = await hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "sguimaraes@id-logistics.com" },
    update: {},
    create: {
      name: "Administrateur",
      email: "sguimaraes@id-logistics.com",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
