import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const ABSENCE_CODES = [
  { code: "Présent",                  label: "Présent",                           color: "#22c55e", isWork: true,  isWeekendInclusive: false, sortOrder: 1  },
  { code: "Repos",                    label: "Repos",                             color: "#3b82f6", isWork: false, isWeekendInclusive: false, sortOrder: 2  },
  { code: "Formation",                label: "Formation",                         color: "#8b5cf6", isWork: true,  isWeekendInclusive: false, sortOrder: 3  },
  { code: "Absence injustifiée",      label: "Absence injustifiée",               color: "#ef4444", isWork: false, isWeekendInclusive: false, sortOrder: 4  },
  { code: "Accident travail",         label: "Accident travail",                  color: "#f97316", isWork: false, isWeekendInclusive: true,  sortOrder: 5  },
  { code: "Conges payes",             label: "Congés payés",                      color: "#06b6d4", isWork: false, isWeekendInclusive: false, sortOrder: 6  },
  { code: "Maladie",                  label: "Maladie",                           color: "#f43f5e", isWork: false, isWeekendInclusive: true,  sortOrder: 7  },
  { code: "Mise à pied",              label: "Mise à pied",                       color: "#dc2626", isWork: false, isWeekendInclusive: true,  sortOrder: 8  },
  { code: "Abs convenu non rémunérée",label: "Absence convenue non rémunérée",   color: "#a855f7", isWork: false, isWeekendInclusive: false, sortOrder: 9  },
  { code: "Accident Trajet",          label: "Accident Trajet",                   color: "#f97316", isWork: false, isWeekendInclusive: true,  sortOrder: 10 },
  { code: "Congés sans solde",        label: "Congés sans solde",                 color: "#0ea5e9", isWork: false, isWeekendInclusive: false, sortOrder: 11 },
  { code: "Abs evenement fam.",       label: "Absence événement familial",        color: "#d946ef", isWork: false, isWeekendInclusive: false, sortOrder: 12 },
  { code: "Congés naissance",         label: "Congés naissance",                  color: "#14b8a6", isWork: false, isWeekendInclusive: true,  sortOrder: 13 },
  { code: "Mal. professionnelle",     label: "Maladie professionnelle",           color: "#e11d48", isWork: false, isWeekendInclusive: true,  sortOrder: 14 },
  { code: "Paternité",                label: "Paternité",                         color: "#2563eb", isWork: false, isWeekendInclusive: true,  sortOrder: 15 },
  { code: "Préavis non eff. pay",     label: "Préavis non effectué payé",         color: "#eab308", isWork: false, isWeekendInclusive: false, sortOrder: 16 },
  { code: "Préavis n.eff. n.pay",     label: "Préavis non effectué non payé",     color: "#ca8a04", isWork: false, isWeekendInclusive: false, sortOrder: 17 },
  { code: "Repos compensateur",       label: "Repos compensateur",                color: "#6366f1", isWork: false, isWeekendInclusive: false, sortOrder: 18 },
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
  { label: "Conducteur PL", mealAllowance: 15.96, pauseMinutes: 0 },
  { label: "Conducteur SPL", mealAllowance: 15.96, pauseMinutes: 0 },
  { label: "Conducteur VL", mealAllowance: 15.96, pauseMinutes: 0 },
  { label: "Dispatcheur", mealAllowance: 7.30, pauseMinutes: 0 },
  { label: "Chef d'équipe", mealAllowance: 8.87, pauseMinutes: 60 },
  { label: "Responsable exploitation", mealAllowance: 7.30, pauseMinutes: 0 },
  { label: "Agent logistique", mealAllowance: 7.30, pauseMinutes: 0 },
  { label: "Manutentionnaire", mealAllowance: 7.30, pauseMinutes: 0 },
  { label: "Cariste", mealAllowance: 7.30, pauseMinutes: 0 },
  { label: "Préparateur de commandes", mealAllowance: 7.30, pauseMinutes: 0 },
  { label: "Agent administratif", mealAllowance: 0, pauseMinutes: 0 },
  // PQS postes
  { label: "CHEF DE GROUPE", mealAllowance: 8.87, pauseMinutes: 60 },
  { label: "CHAUFFEUR LIVREUR", mealAllowance: 16.20, pauseMinutes: 30 },
  { label: "RESPONSABLE METHODE & QUALITE", mealAllowance: 8.87, pauseMinutes: 60 },
  { label: "RESPONSABLE EXPLOITATION", mealAllowance: 0, pauseMinutes: 60 },
  { label: "RESPONSABLE DE SERVICE", mealAllowance: 8.87, pauseMinutes: 60 },
  { label: "AGENT EXPLOIT", mealAllowance: 4.32, pauseMinutes: 60 },
  { label: "RESPONSABLE DOSSIER", mealAllowance: 15.20, pauseMinutes: 60 },
  { label: "ASSISTANTE DE SITE", mealAllowance: 8.87, pauseMinutes: 60 },
  { label: "CHEF D'EQUIPE", mealAllowance: 8.87, pauseMinutes: 60 },
  { label: "COORDINATEUR TRANSPORT", mealAllowance: 8.87, pauseMinutes: 60 },
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
      update: { label: ac.label, color: ac.color, isWork: ac.isWork, isWeekendInclusive: ac.isWeekendInclusive, sortOrder: ac.sortOrder },
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
      update: { mealAllowance: poste.mealAllowance, pauseMinutes: poste.pauseMinutes },
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

  // ── PQS Criteria ────────────────────────────────────────────────────────────
  console.log("Seeding PQS criteria...");

  const PQS_DATA: { poste: string; criteria: { label: string; amount: number }[] }[] = [
    {
      poste: "CHEF DE GROUPE",
      criteria: [
        { label: "Note livreur — Objectif > 4,80", amount: 25 },
        { label: "Ponctualité > 95%", amount: 25 },
        { label: "Process livraison — Surplace forcé <10%, Commande forcée <10%, Scan >95%", amount: 25 },
        { label: "Respect des process sur sites", amount: 25 },
      ],
    },
    {
      poste: "CHAUFFEUR LIVREUR",
      criteria: [
        { label: "Note livreur — Objectif > 4,80", amount: 50 },
        { label: "Respect du créneau — Objectif > 95%", amount: 50 },
        { label: "Respect des process sur sites", amount: 25 },
        { label: "100% Docs réglementaires complétés (MOBILIC)", amount: 25 },
        { label: "Sinistre camion / Propreté camion", amount: 25 },
        { label: "Process livraison — Commandes forcées, Surplace forcé, Taux de scan", amount: 25 },
      ],
    },
    {
      poste: "RESPONSABLE METHODE & QUALITE",
      criteria: [
        { label: "Budget M-1", amount: 50 },
        { label: "Weekly à la semaine", amount: 50 },
        { label: "Moyenne Site NPS > 60, Note livreur < 4,80, Ponctualité >95%, Commandes forcées <10%, Surplace forcé <10%, Taux de scan <10%", amount: 50 },
        { label: "CID : Forecast / Prévision GEDTRANS", amount: 50 },
      ],
    },
    {
      poste: "RESPONSABLE EXPLOITATION",
      criteria: [
        { label: "Budget M-1", amount: 50 },
        { label: "Qualité", amount: 50 },
        { label: "Weekly à la semaine", amount: 50 },
        { label: "CID", amount: 50 },
      ],
    },
    {
      poste: "RESPONSABLE DE SERVICE",
      criteria: [
        { label: "Casse : 100% déclarée dans Coliweb, Casse cause entrepôt < 5%", amount: 50 },
        { label: "Vérification des tournées — Commandes partiel 5%", amount: 50 },
        { label: "Taux de scan sur les 3 contextes > 95%", amount: 50 },
        { label: "Respect des règles de sécurité (porte coupe-feu, EPI, sorties de secours, accès quai)", amount: 50 },
      ],
    },
    {
      poste: "AGENT EXPLOIT",
      criteria: [
        { label: "Casse : 100% déclarée dans Coliweb, Casse cause entrepôt < 5%", amount: 30 },
        { label: "Vérification des tournées — Commandes partiel 5%", amount: 30 },
        { label: "Taux de scan sur les 3 contextes > 95%", amount: 30 },
        { label: "Dépôt et matériels à nettoyer après chaque utilisation", amount: 10 },
        { label: "Utilisation chariots avec sécurité, casse accidentelle < 5%", amount: 30 },
        { label: "Retards/absences justifiés", amount: 20 },
      ],
    },
    {
      poste: "RESPONSABLE DOSSIER",
      criteria: [
        { label: "NPS > 60, Note livreur < 4,80, Ponctualité >95%, Commandes forcées <10%, Surplace forcé <10%, Taux de scan <10%", amount: 25 },
        { label: "Propreté du site + Suivi balance Bac", amount: 50 },
        { label: "Moyens humains et matériels optimisés", amount: 50 },
        { label: "Facturation et Forecast", amount: 50 },
        { label: "Mobilic complété à la journée", amount: 25 },
      ],
    },
    {
      poste: "ASSISTANTE DE SITE",
      criteria: [],
    },
    {
      poste: "CHEF D'EQUIPE",
      criteria: [
        { label: "Casse : 100% déclarée dans Coliweb, Casse cause entrepôt < 5%", amount: 50 },
        { label: "Vérification des tournées — Commandes partiel 5%", amount: 50 },
        { label: "Taux de scan sur les 3 contextes > 95%", amount: 25 },
        { label: "Respect des règles de sécurité (porte coupe-feu, EPI, sorties de secours, accès quai)", amount: 25 },
      ],
    },
    {
      poste: "COORDINATEUR TRANSPORT",
      criteria: [
        { label: "Casse : 100% déclarée dans Coliweb, Casse cause entrepôt < 5%", amount: 50 },
        { label: "Vérification des tournées — Commandes partiel 5%", amount: 50 },
        { label: "Taux de scan sur les 3 contextes > 95%", amount: 25 },
        { label: "Respect des règles de sécurité (porte coupe-feu, EPI, sorties de secours, accès quai)", amount: 25 },
      ],
    },
  ];

  for (const { poste: posteLabel, criteria } of PQS_DATA) {
    const posteConfig = await prisma.posteConfig.findUnique({ where: { label: posteLabel } });
    if (!posteConfig) {
      console.warn(`  PosteConfig "${posteLabel}" not found, skipping PQS criteria`);
      continue;
    }

    // Delete existing criteria then recreate (idempotent)
    await prisma.pqsCriteria.deleteMany({ where: { posteConfigId: posteConfig.id } });

    for (let i = 0; i < criteria.length; i++) {
      await prisma.pqsCriteria.create({
        data: {
          posteConfigId: posteConfig.id,
          label: criteria[i].label,
          amount: criteria[i].amount,
          sortOrder: i + 1,
        },
      });
    }
    console.log(`  ${posteLabel} → ${criteria.length} critères`);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
