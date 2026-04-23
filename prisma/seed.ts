import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

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
  { code: "AIX", label: "Aix-en-Provence" },
] as const;

const POSTES = [
  { label: "Conducteur PL", mealAllowance: 15.96 },
  { label: "Conducteur SPL", mealAllowance: 15.96 },
  { label: "Conducteur VL", mealAllowance: 15.96 },
  { label: "Dispatcheur", mealAllowance: 7.30 },
  { label: "Chef d'équipe", mealAllowance: 7.30 },
  { label: "Responsable exploitation", mealAllowance: 7.30 },
  { label: "Agent logistique", mealAllowance: 7.30 },
  { label: "Manutentionnaire", mealAllowance: 7.30 },
  { label: "Cariste", mealAllowance: 7.30 },
  { label: "Préparateur de commandes", mealAllowance: 7.30 },
  { label: "Agent administratif", mealAllowance: 0 },
] as const;

const USERS = [
  { email: "aramdani@id-logistics.com", name: "Abdelhak RAMDANI", role: "ADMIN" as const, sites: [] as string[], allowedPages: [] as string[] },
  { email: "nnarrainen@id-logistics.com", name: "Nedy NARRAINEN", role: "ADMIN" as const, sites: [] as string[], allowedPages: [] as string[] },
  { email: "adiallo@id-logistics.com", name: "Aissatou DIALLO", role: "RESPONSABLE" as const, sites: ["VLG"], allowedPages: [] as string[] },
  { email: "ebilland@id-logistics.com", name: "Estelle BILLAND", role: "RESPONSABLE" as const, sites: ["VLG", "LPP", "RUNGIS", "VITRY"], allowedPages: [] as string[] },
  { email: "lizidi@id-logistics.com", name: "Logan IZIDI", role: "RESPONSABLE" as const, sites: ["AIX", "CASTRIES", "ANTIBES"], allowedPages: [] as string[] },
  { email: "sdiabira@id-logistics.com", name: "Seckou DIABIRA", role: "RESPONSABLE" as const, sites: ["RUNGIS"], allowedPages: ["/planning"] },
  { email: "okonioko@id-logistics.com", name: "Olivier KONIOKO", role: "RESPONSABLE" as const, sites: ["VITRY"], allowedPages: ["/planning"] },
  { email: "mamessaoudene@id-logistics.com", name: "M'hamed Amine MESSAOUDENE", role: "RESPONSABLE" as const, sites: ["ANTIBES"], allowedPages: ["/planning"] },
  { email: "mzarglayoune@id-logistics.com", name: "Medhi ZARGLAYOUNE", role: "RESPONSABLE" as const, sites: ["RUNGIS", "VITRY", "VLG", "LPP", "CASTRIES", "ANTIBES", "ROSNY", "AIX"], allowedPages: ["/planning"] },
  { email: "pleblanc@id-logistics.com", name: "Pascal LEBLANC", role: "RESPONSABLE" as const, sites: ["AIX"], allowedPages: ["/planning"] },
];

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

  console.log("Seeding postes...");
  for (const poste of POSTES) {
    await prisma.posteConfig.upsert({
      where: { label: poste.label },
      update: { mealAllowance: poste.mealAllowance },
      create: poste,
    });
  }

  console.log("Seeding users...");
  const hashedPassword = await hash("Idl2026!", 12);

  const allSites = await prisma.site.findMany();
  const siteByCode = new Map(allSites.map((s) => [s.code, s.id]));

  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, allowedPages: u.allowedPages },
      create: {
        name: u.name,
        email: u.email,
        password: hashedPassword,
        role: u.role,
        allowedPages: u.allowedPages,
      },
    });

    for (const siteCode of u.sites) {
      const siteId = siteByCode.get(siteCode);
      if (!siteId) {
        console.warn(`  Site ${siteCode} not found, skipping for ${u.email}`);
        continue;
      }
      await prisma.userSite.upsert({
        where: { userId_siteId: { userId: user.id, siteId } },
        update: {},
        create: { userId: user.id, siteId },
      });
    }
    console.log(`  ${u.email} → ${u.role} (${u.sites.join(", ") || "all sites"})`);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
