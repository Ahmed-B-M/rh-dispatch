@AGENTS.md

# rh-dispatch — Context for AI Assistants

> Application de gestion des heures et primes pour les équipes dispatch d'ID Logistics.
> **Dernière mise à jour** : 2026-04-27

## Stack

- **Framework** : Next.js 15 App Router (TypeScript strict)
- **ORM** : Prisma v7 avec `@prisma/adapter-pg` — INCOMPATIBLE avec Prisma v5
- **Base de données** : PostgreSQL 15 (`rh_dispatch`) sur VPS 72.60.213.4
- **Auth** : NextAuth.js v4 (credentials provider, JWT sessions)
- **UI** : Tailwind CSS v4, shadcn/ui, Radix UI
- **State** : React Query (`@tanstack/react-query`) pour les mutations et le cache
- **Runtime** : Node.js 22 Alpine (Docker multi-stage)

## Architecture du projet

```
app/
  (app)/            # Routes protégées (layout avec sidebar + auth check)
    dashboard/      # KPIs du mois
    planning/       # Saisie hebdomadaire des heures
    recap/          # Récap mensuel (heures + paniers + PQS)
    pqs/            # Évaluation PQS mensuelle par poste
    employes/       # CRUD employés
    synthese/       # Synthèse hebdomadaire
    import/         # Import Excel feuilles de route
    sites/          # Gestion des sites
    vehicules/      # Gestion de la flotte
    parametres/     # Postes, codes absence, utilisateurs
  api/              # Route handlers Next.js
  auth/signin/      # Page de connexion NextAuth
lib/
  prisma.ts         # Singleton Prisma v7 avec adapter-pg
  auth.ts           # requireAuth(), requireAdmin(), getAllowedSiteIds()
  time-utils.ts     # nightHoursOverlap(), computeWorkDuration(), parseExcelTime()
prisma/
  schema.prisma     # 12 modèles + 4 enums
  seed.ts           # Seed : postes, codes absence, PQS criteria
  migrations/       # Migrations SQL horodatées
```

## Pattern Prisma v7 — CRITIQUE

```typescript
// lib/prisma.ts — NE PAS utiliser new PrismaClient() directement sans adapter
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
```

> **Piège** : `@prisma/adapter-pg` est obligatoire avec Prisma v7.
> `prisma.config.ts` à la racine configure le driver adapter pour les commandes CLI.

## Patterns Auth

```typescript
// Dans chaque route API :
const session = await requireAuth();               // 401 si non connecté
const session = await requireAdmin();              // 403 si non ADMIN

// Filtrage par site pour les RESPONSABLE :
const allowedSites = getAllowedSiteIds(session);   // null = ADMIN (tous), string[] = RESPONSABLE
if (allowedSites) {
  where.sites = { some: { siteId: { in: allowedSites }, endDate: null } };
}

// Vérifier qu'un employé est dans le périmètre :
await assertEmployeeInScope(session, employeeId);
```

## Rôles utilisateurs

| Rôle | Accès |
|------|-------|
| `ADMIN` | Tous les sites, toutes les pages, gestion utilisateurs |
| `RESPONSABLE` | Sites assignés uniquement, pas de gestion utilisateurs |

La page `/pqs` est accessible aux RESPONSABLE (pas seulement ADMIN).

## Modèles Prisma

| Modèle | Description |
|--------|-------------|
| `Employee` | Salarié (matricule, poste, categorie, typeContrat) |
| `EmployeeSite` | Affectation salarié → site (startDate/endDate) |
| `WorkEntry` | Entrée journalière (date, heureDebut/Fin, absenceCode, heuresDecimales) |
| `ImportBatch` | Historique imports Excel |
| `Site` | Sites (code + label) |
| `Vehicle` | Véhicules (immatriculation) |
| `AbsenceCode` | Codes absence (P=Présent, CP, AT...) + isWork + color |
| `PosteConfig` | Config par poste (mealAllowance €, pauseMinutes) |
| `PqsCriteria` | Critères PQS par poste (label + montant €) |
| `PqsEvaluation` | Évaluation PQS mensuelle (employeeId + year + month, unique) |
| `PqsEvaluationItem` | Résultat par critère (achieved boolean) |
| `User` | Utilisateurs app (ADMIN / RESPONSABLE) |

## Logique métier clé

### Heures de nuit (`lib/time-utils.ts`)

```typescript
nightHoursOverlap("22:00", "06:00") // → 8.0h
```

Plage nuit : 00h-6h + 21h-24h. Gère le passage minuit.

### Calcul des paniers repas

`mealAllowance` (€/jour) × `joursTravailles` (entrées avec `absenceCode.isWork === true`).
Le lookup poste est case-insensitive : `emp.poste.toLowerCase()` vs `PosteConfig.label.toLowerCase()`.

### Calcul PQS (Prime Qualité de Service)

Chaque `PosteConfig` a N `PqsCriteria` avec un montant. Chaque mois, un responsable crée une `PqsEvaluation` et coche les critères atteints (`PqsEvaluationItem.achieved`).
`montantPqs = sum(amount)` des critères atteints pour cet employé ce mois.

**Pattern upsert PQS (idempotent)** :
```typescript
const evaluation = await prisma.pqsEvaluation.upsert({
  where: { employeeId_year_month: { employeeId, year, month } },
  create: { employeeId, year, month },
  update: { updatedAt: new Date() },
});
// deleteMany items + createMany items
```

### Pause déduite automatiquement

À la saisie des heures, `pauseMinutes` du `PosteConfig` correspondant est déduit de `heuresDecimales`.

## Routes API

| Route | Méthodes | Description |
|-------|----------|-------------|
| `/api/dashboard` | GET | KPIs mois (jours, heures, paniers) |
| `/api/employees` | GET, POST | Liste + création employés |
| `/api/employees/[id]` | GET, PUT, DELETE | Fiche + modif + suppression |
| `/api/employees/[id]/transfer` | POST | Transfert de site |
| `/api/work-entries` | GET, POST | Entrées de travail |
| `/api/work-entries/[id]` | PUT, DELETE | Modifier / supprimer |
| `/api/work-entries/bulk` | POST | Upsert bulk (import) |
| `/api/planning` | GET | Données planning par semaine |
| `/api/recap` | GET | Récap mensuel (heures + paniers + PQS) |
| `/api/pqs` | GET, POST | Évaluations PQS (liste + upsert) |
| `/api/pqs/criteria` | GET | Critères PQS par poste (`?poste=NOM`) |
| `/api/import` | POST | Import Excel feuille de route |
| `/api/export` | GET | Export Excel récap mensuel |
| `/api/postes` | GET, POST | CRUD configurations de postes |
| `/api/postes/[id]` | PUT, DELETE | Modifier / supprimer un poste |
| `/api/sites` | GET, POST | CRUD sites |
| `/api/sites/[id]` | PUT, DELETE | Modifier / supprimer un site |
| `/api/vehicles` | GET, POST | CRUD véhicules |
| `/api/vehicles/[id]` | PUT, DELETE | Modifier / supprimer un véhicule |
| `/api/absence-codes` | GET | Codes absence (référence) |
| `/api/users` | GET, POST | Gestion utilisateurs (ADMIN) |
| `/api/auth/[...nextauth]` | GET, POST | Handler NextAuth |

## Scripts npm

| Commande | Description |
|----------|-------------|
| `npm run dev` | Dev local avec Turbopack |
| `npm run build` | `prisma generate` + `next build` |
| `npm run start` | Démarrer en prod |
| `npm run lint` | ESLint |
| `npm run seed` | Seeder la base (postes, codes absence, PQS criteria) |

## Migrations

6 migrations au total :

| Migration | Description |
|-----------|-------------|
| `20260423000000_init` | Schema initial (Employee, WorkEntry, Site, Vehicle, AbsenceCode, User) |
| `20260423120000_add_poste_config` | Ajout PosteConfig (mealAllowance) |
| `20260423140000_add_user_allowed_pages` | Champ allowedPages sur User |
| `20260423150000_add_weekend_inclusive` | Champ isWeekendInclusive sur AbsenceCode |
| `20260423170000_add_pause_minutes_to_poste` | Champ pauseMinutes sur PosteConfig |
| `20260427000000_add_pqs_models` | Ajout PqsCriteria, PqsEvaluation, PqsEvaluationItem |

**Appliquer les migrations sur le VPS :**
```bash
# Méthode 1 — via le service migrator (recommandé, identique au déploiement)
ssh hostinger "cd /root/rh-dispatch && docker compose -f docker-compose.prod.yml run --rm migrator"

# Méthode 2 — directement dans le container
ssh hostinger "docker exec rh-dispatch npx prisma migrate deploy"

# Méthode 3 — SQL direct dans PostgreSQL
ssh hostinger "docker exec supabase-db psql -U postgres -d rh_dispatch -f /tmp/migration.sql"
```

**Seed PQS criteria :**
```bash
ssh hostinger "docker exec rh-dispatch npm run seed"
```

## Déploiement VPS

- **Dir VPS** : `/root/rh-dispatch/`
- **Container** : `rh-dispatch` (réseaux : `id360-shared` + `supabase_default`)
- **Compose** : `docker-compose.prod.yml` (service `migrator` + service `rh-dispatch`)
- **Env** : `.env.production` (non committé, sur le VPS)
- **Reverse proxy** : `id360-caddy` (Caddyfile dans `/root/id-360/`)
- **Mémoire** : limité à 512 MB (reservation 128 MB)
- **Health check** : `wget http://127.0.0.1:3000/` toutes les 30s

```bash
# Rebuild et redéploiement complet
ssh hostinger "cd /root/rh-dispatch && git pull && docker compose -f docker-compose.prod.yml up --build -d"

# Migration seulement
ssh hostinger "cd /root/rh-dispatch && docker compose -f docker-compose.prod.yml run --rm migrator"

# Seed PQS
ssh hostinger "docker exec rh-dispatch npm run seed"

# Logs
ssh hostinger "docker logs rh-dispatch --tail 100 -f"

# Statut migrations
ssh hostinger "docker exec supabase-db psql -U postgres -d rh_dispatch -c 'SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at;'"
```

## Variables d'environnement (`.env.production` sur le VPS)

```
DATABASE_URL=postgresql://postgres:<pwd>@supabase-db:5432/rh_dispatch
DIRECT_URL=postgresql://postgres:<pwd>@supabase-db:5432/rh_dispatch
NEXTAUTH_SECRET=<secret>
NEXTAUTH_URL=https://<domaine>
NODE_ENV=production
```

> `supabase-db` est le hostname Docker du container PostgreSQL (réseau `supabase_default`).

## Pièges connus

1. **Prisma v7 + adapter-pg** : toujours vérifier `prisma.config.ts` à la racine pour les commandes CLI
2. **supabase-pooler** : le pooler Supavisor (ports 5432/6543 exposés) exige `user.tenant` — connexion directe externe impossible, passer par `docker exec supabase-db psql`
3. **nightHoursOverlap** : plage nuit 21h-6h codée en dur dans `lib/time-utils.ts` lignes 36-49
4. **PQS lookup case-insensitive** : `emp.poste.toLowerCase()` pour matcher `PosteConfig.label` — les libellés doivent correspondre (après lowercase)
5. **npx prisma generate** : obligatoire après chaque modification du schema, sinon TypeScript ne voit pas les nouveaux modèles
6. **Import Excel** : colonnes positionnelles — si le format de la feuille de route change, vérifier `app/api/import/route.ts`

## Commandes de vérification rapide

```bash
# TypeScript (local)
npx tsc --noEmit

# Tables sur le VPS
ssh hostinger "docker exec supabase-db psql -U postgres -d rh_dispatch -c '\dt'"

# Critères PQS seedés
ssh hostinger "docker exec supabase-db psql -U postgres -d rh_dispatch -c 'SELECT pc.label, count(pqc.id) as nb FROM \"PosteConfig\" pc LEFT JOIN \"PqsCriteria\" pqc ON pqc.\"posteConfigId\" = pc.id GROUP BY pc.label;'"

# Migrations appliquées
ssh hostinger "docker exec supabase-db psql -U postgres -d rh_dispatch -c 'SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at;'"
```
