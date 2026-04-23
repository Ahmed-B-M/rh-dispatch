/**
 * migrate-excel.ts — Import 3 Excel source files into rh_dispatch database
 *
 * Usage: npx tsx scripts/migrate-excel.ts
 *
 * Requires SSH tunnel: ssh -L 5433:supabase-db:5432 hostinger
 * Then set DATABASE_URL=postgresql://postgres:<pwd>@localhost:5433/rh_dispatch
 */

import { readFileSync } from "fs";
import { join } from "path";
import ExcelJS from "exceljs";
import XLSX from "xlsx";
import pg from "pg";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DB_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:pfadPpSX7yeFxi4aZo3txwRqKs1lsVmBerV7uitPMrc@localhost:5434/rh_dispatch";

const EXCEL_DIR = join(__dirname, "..", "..");

const FILES = [
  { path: "Copie de HEURES_ROSNY.xlsx", source: "ROSNY", categorie: "LOGISTIQUE" },
  { path: "Copie de HEURES_CARREFOUR.xlsx", source: "CARREFOUR", categorie: "TRANSPORT" },
  { path: "Copie de HEURES_DISPATCHEURS.xlsx", source: "DISPATCHEURS", categorie: "TRANSPORT" },
] as const;

const MONTH_NAMES = [
  "JANVIER", "FEVRIER", "MARS", "AVRIL", "MAI", "JUIN",
  "JUILLET", "AOUT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DECEMBRE",
];

const CONTRACT_MAP: Record<string, string> = {
  CDI: "CDI",
  CDD: "CDD",
  ALTERNANCE: "ALTERNANCE",
  ALT: "ALTERNANCE",
  ALTERNANT: "ALTERNANCE",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isMonthSheet(name: string): boolean {
  const upper = name.toUpperCase().trim();
  return MONTH_NAMES.some((m) => upper.startsWith(m));
}

function cellText(cell: ExcelJS.Cell): string {
  if (!cell || cell.value === null || cell.value === undefined) return "";
  if (typeof cell.value === "object" && cell.value !== null && "richText" in (cell.value as unknown as Record<string, unknown>)) {
    const rt = cell.value as { richText: { text: string }[] };
    return rt.richText.map((r) => r.text).join("");
  }
  if (cell.value instanceof Date) return cell.value.toISOString();
  return String(cell.value);
}

function parseDateCell(cell: ExcelJS.Cell): Date | null {
  if (!cell || cell.value === null || cell.value === undefined) return null;
  if (cell.value instanceof Date) return cell.value;
  if (typeof cell.value === "number") {
    const utcDays = cell.value - 25569;
    const date = new Date(utcDays * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }
  const d = new Date(String(cell.value));
  return isNaN(d.getTime()) ? null : d;
}

function parseTimeCell(cell: ExcelJS.Cell): string | null {
  if (!cell || cell.value === null || cell.value === undefined) return null;
  if (typeof cell.value === "number") {
    const totalMinutes = Math.round(cell.value * 24 * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  if (cell.value instanceof Date) {
    const h = cell.value.getHours();
    const m = cell.value.getMinutes();
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const str = String(cell.value).trim();
  if (/^\d{1,2}:\d{2}/.test(str)) {
    const [h, m] = str.split(":").map(Number);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return null;
}

const DAY_NAMES_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function getDayNameFr(date: Date): string {
  return DAY_NAMES_FR[date.getDay()];
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function normalizeContract(raw: string): string {
  const upper = raw.toUpperCase().trim();
  return CONTRACT_MAP[upper] || "CDI";
}

function splitNomPrenom(full: string): { nom: string; prenom: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { nom: parts[0] || "INCONNU", prenom: "" };
  // Convention: last word(s) starting uppercase = nom, rest = prenom
  // Simple heuristic: first word = nom, rest = prenom
  return { nom: parts[0], prenom: parts.slice(1).join(" ") };
}

function generateCuid(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "c";
  for (let i = 0; i < 24; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface ParsedEmployee {
  matricule: string;
  nomPrenom: string;
  typeContrat: string;
  affectation: string;
  poste: string;
  isSorti: boolean;
}

interface ParsedEntry {
  matricule: string;
  date: Date;
  weekNumber: number;
  dayName: string;
  affectation: string;
  typeContrat: string;
  nomConducteur: string;
  motifAbsence: string;
  posteOccupe: string;
  heureDebut: string | null;
  heureFin: string | null;
  tempsTravail: string | null;
  heuresDecimales: number | null;
  vehicule: string;
  typeRoute: string;
  nbKm: number | null;
}

// ---------------------------------------------------------------------------
// Parse Excel
// ---------------------------------------------------------------------------

function parseExcelDateSerial(serial: number): Date | null {
  if (serial < 1) return null;
  const utcDays = serial - 25569;
  const date = new Date(utcDays * 86400 * 1000);
  return isNaN(date.getTime()) ? null : date;
}

function parseTimeFromDecimal(value: number): string | null {
  if (value <= 0 || value >= 1) return null;
  const totalMinutes = Math.round(value * 24 * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function sheetjsCellVal(row: unknown[], colIdx: number): unknown {
  return colIdx < row.length ? row[colIdx] : undefined;
}

function sheetjsCellStr(row: unknown[], colIdx: number): string {
  const v = sheetjsCellVal(row, colIdx);
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("v" in (v as Record<string, unknown>)) return String((v as Record<string, unknown>).v).trim();
    if ("w" in (v as Record<string, unknown>)) return String((v as Record<string, unknown>).w).trim();
    return "";
  }
  return String(v).trim();
}

function parseFileSheetJS(
  filePath: string,
): { employees: ParsedEmployee[]; entries: ParsedEntry[]; monthCount: number } {
  console.log("  (Fallback SheetJS)");
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: true });

  const employees: ParsedEmployee[] = [];
  const entries: ParsedEntry[] = [];
  let monthCount = 0;

  // Find PERSONNELS sheet
  const personnelName = workbook.SheetNames.find((n) =>
    n.toUpperCase().includes("PERSONNEL"),
  );

  if (personnelName) {
    const sheet = workbook.Sheets[personnelName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
    let isSortisSection = false;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const firstCell = String(row[0] ?? "").toUpperCase();
      if (firstCell.includes("SORTIS") || firstCell.includes("SORTI")) {
        isSortisSection = true;
        continue;
      }

      const matriculeRaw = row[0];
      if (matriculeRaw === null || matriculeRaw === undefined) continue;
      const matricule = String(matriculeRaw).trim();
      if (!matricule || matricule === "0" || matricule.toUpperCase() === "MATRICULE") continue;

      const nomPrenom = String(row[1] ?? "").trim();
      if (!nomPrenom) continue;

      employees.push({
        matricule,
        nomPrenom,
        typeContrat: String(row[2] ?? "CDI").trim() || "CDI",
        affectation: String(row[3] ?? "").trim(),
        poste: String(row[4] ?? "").trim(),
        isSorti: isSortisSection,
      });
    }
  }

  // Parse monthly sheets
  for (const sheetName of workbook.SheetNames) {
    if (!isMonthSheet(sheetName)) continue;
    monthCount++;

    const sheet = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 8) continue;

      // Column F (index 5) = Matricule
      const matriculeRaw = sheetjsCellVal(row, 5);
      if (matriculeRaw === null || matriculeRaw === undefined) continue;
      const matricule = String(matriculeRaw).trim();
      if (!matricule || matricule === "Matricule" || matricule === "0") continue;

      // Column B (index 1) = Date (Excel serial)
      const dateRaw = sheetjsCellVal(row, 1);
      let date: Date | null = null;
      if (typeof dateRaw === "number") {
        date = parseExcelDateSerial(dateRaw);
      } else if (dateRaw instanceof Date) {
        date = dateRaw;
      } else if (dateRaw) {
        date = new Date(String(dateRaw));
        if (isNaN(date.getTime())) date = null;
      }
      if (!date) continue;

      // Column P (index 15) = Nb km
      const nbKmRaw = sheetjsCellVal(row, 15);
      const nbKm = typeof nbKmRaw === "number" ? nbKmRaw : null;

      // Column J (index 9) = Heure début, K (index 10) = Heure fin
      const hdRaw = sheetjsCellVal(row, 9);
      const hfRaw = sheetjsCellVal(row, 10);
      const heureDebut = typeof hdRaw === "number" ? parseTimeFromDecimal(hdRaw) : null;
      const heureFin = typeof hfRaw === "number" ? parseTimeFromDecimal(hfRaw) : null;

      // Column L (index 11) = Temps de travail
      let tempsTravail: string | null = null;
      const ttRaw = sheetjsCellVal(row, 11);
      if (typeof ttRaw === "number" && ttRaw > 0) {
        const totalMin = Math.round(ttRaw * 24 * 60);
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        tempsTravail = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
      }

      // Column M (index 12) = Heures décimales
      let heuresDecimales: number | null = null;
      const hdecRaw = sheetjsCellVal(row, 12);
      if (typeof hdecRaw === "number") {
        heuresDecimales = Math.round(hdecRaw * 100) / 100;
      }

      entries.push({
        matricule,
        date,
        weekNumber: getWeekNumber(date),
        dayName: getDayNameFr(date),
        affectation: sheetjsCellStr(row, 3),
        typeContrat: sheetjsCellStr(row, 4),
        nomConducteur: sheetjsCellStr(row, 6),
        motifAbsence: sheetjsCellStr(row, 7),
        posteOccupe: sheetjsCellStr(row, 8),
        heureDebut,
        heureFin,
        tempsTravail,
        heuresDecimales,
        vehicule: sheetjsCellStr(row, 13),
        typeRoute: sheetjsCellStr(row, 14),
        nbKm,
      });
    }
  }

  console.log(
    `  → ${employees.length} employés, ${entries.length} entrées, ${monthCount} mois`,
  );
  return { employees, entries, monthCount };
}

async function parseFile(
  filePath: string,
  categorie: string,
): Promise<{ employees: ParsedEmployee[]; entries: ParsedEntry[]; monthCount: number }> {
  try {
    const buffer = readFileSync(filePath);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const employees: ParsedEmployee[] = [];
    const entries: ParsedEntry[] = [];
    let monthCount = 0;

    let personnelSheet: ExcelJS.Worksheet | undefined;
    for (const sheet of workbook.worksheets) {
      if (sheet.name.toUpperCase().includes("PERSONNEL")) {
        personnelSheet = sheet;
        break;
      }
    }

    if (personnelSheet) {
      let isSortisSection = false;
      personnelSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber <= 1) return;

        const firstCell = cellText(row.getCell(1)).toUpperCase();
        if (firstCell.includes("SORTIS") || firstCell.includes("SORTI")) {
          isSortisSection = true;
          return;
        }

        const matriculeRaw = row.getCell(1).value;
        if (matriculeRaw === null || matriculeRaw === undefined) return;

        const matricule =
          typeof matriculeRaw === "number" ? String(matriculeRaw) : String(matriculeRaw).trim();
        if (!matricule || matricule === "0" || matricule.toUpperCase() === "MATRICULE") return;

        const nomPrenom = cellText(row.getCell(2)).trim();
        if (!nomPrenom) return;

        employees.push({
          matricule,
          nomPrenom,
          typeContrat: cellText(row.getCell(3)).trim() || "CDI",
          affectation: cellText(row.getCell(4)).trim(),
          poste: cellText(row.getCell(5)).trim(),
          isSorti: isSortisSection,
        });
      });
    }

    for (const sheet of workbook.worksheets) {
      if (!isMonthSheet(sheet.name)) continue;
      monthCount++;

      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber <= 1) return;

        const matriculeRaw = row.getCell(6).value;
        if (matriculeRaw === null || matriculeRaw === undefined) return;

        const matricule =
          typeof matriculeRaw === "number" ? String(matriculeRaw) : String(matriculeRaw).trim();
        if (!matricule || matricule === "Matricule" || matricule === "0") return;

        const date = parseDateCell(row.getCell(2));
        if (!date) return;

        const nbKmRaw = row.getCell(16).value;
        const nbKm = typeof nbKmRaw === "number" ? nbKmRaw : null;

        const heureDebut = parseTimeCell(row.getCell(10));
        const heureFin = parseTimeCell(row.getCell(11));

        let tempsTravail: string | null = null;
        let heuresDecimales: number | null = null;

        const tempsTravailRaw = row.getCell(12).value;
        if (typeof tempsTravailRaw === "number" && tempsTravailRaw > 0) {
          const totalMin = Math.round(tempsTravailRaw * 24 * 60);
          const h = Math.floor(totalMin / 60);
          const m = totalMin % 60;
          tempsTravail = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
        } else if (tempsTravailRaw instanceof Date) {
          const h = tempsTravailRaw.getHours();
          const m = tempsTravailRaw.getMinutes();
          const s = tempsTravailRaw.getSeconds();
          tempsTravail = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
        }

        const heuresDecRaw = row.getCell(13).value;
        if (typeof heuresDecRaw === "number") {
          heuresDecimales = Math.round(heuresDecRaw * 100) / 100;
        }

        entries.push({
          matricule,
          date,
          weekNumber: getWeekNumber(date),
          dayName: getDayNameFr(date),
          affectation: cellText(row.getCell(4)).trim(),
          typeContrat: cellText(row.getCell(5)).trim(),
          nomConducteur: cellText(row.getCell(7)).trim(),
          motifAbsence: cellText(row.getCell(8)).trim(),
          posteOccupe: cellText(row.getCell(9)).trim(),
          heureDebut,
          heureFin,
          tempsTravail,
          heuresDecimales,
          vehicule: cellText(row.getCell(14)).trim(),
          typeRoute: cellText(row.getCell(15)).trim(),
          nbKm,
        });
      });
    }

    console.log(
      `  → ${employees.length} employés, ${entries.length} entrées, ${monthCount} mois`,
    );
    return { employees, entries, monthCount };
  } catch (err) {
    console.warn(`  ⚠ ExcelJS failed: ${(err as Error).message}`);
    return parseFileSheetJS(filePath);
  }
}

// ---------------------------------------------------------------------------
// Database operations
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Migration Excel → PostgreSQL ===\n");

  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  console.log("Connecté à PostgreSQL\n");

  // Load absence codes map
  const absRes = await client.query('SELECT id, code FROM "AbsenceCode"');
  const absenceMap = new Map<string, string>();
  for (const row of absRes.rows) {
    absenceMap.set(row.code, row.id);
    absenceMap.set(row.code.toLowerCase(), row.id);
  }
  console.log(`${absenceMap.size / 2} codes absence chargés`);

  // Load sites map
  const siteRes = await client.query('SELECT id, code FROM "Site"');
  const siteMap = new Map<string, string>();
  for (const row of siteRes.rows) {
    siteMap.set(row.code, row.id);
  }
  console.log(`${siteMap.size} sites chargés\n`);

  let totalEmployees = 0;
  let totalEntries = 0;
  let totalSkipped = 0;

  for (const file of FILES) {
    const filePath = join(EXCEL_DIR, file.path);
    console.log(`\nParsing ${file.path} (${file.source}, ${file.categorie})...`);

    const { employees, entries } = await parseFile(filePath, file.categorie);

    // --- Upsert employees ---
    console.log(`  Insertion des employés...`);
    const employeeIdMap = new Map<string, string>(); // matricule → id

    for (const emp of employees) {
      const { nom, prenom } = splitNomPrenom(emp.nomPrenom);
      const typeContrat = normalizeContract(emp.typeContrat);
      const id = generateCuid();

      const res = await client.query(
        `INSERT INTO "Employee" (id, matricule, nom, prenom, "typeContrat", categorie, poste, "affectationCode", "dateDebut", "dateEntree", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5::\"ContractType\", $6::\"EmployeeCategory\", $7, $8, NOW(), NOW(), $9, NOW(), NOW())
         ON CONFLICT (matricule) DO UPDATE SET
           nom = EXCLUDED.nom,
           prenom = EXCLUDED.prenom,
           "typeContrat" = EXCLUDED."typeContrat",
           categorie = EXCLUDED.categorie,
           poste = CASE WHEN EXCLUDED.poste != '' THEN EXCLUDED.poste ELSE "Employee".poste END,
           "isActive" = EXCLUDED."isActive",
           "updatedAt" = NOW()
         RETURNING id`,
        [
          id,
          emp.matricule,
          nom,
          prenom,
          typeContrat,
          file.categorie,
          emp.poste || "Non défini",
          emp.affectation || null,
          !emp.isSorti,
        ],
      );
      employeeIdMap.set(emp.matricule, res.rows[0].id);
      totalEmployees++;
    }

    // Also assign site to employees
    const siteId = siteMap.get(file.source === "CARREFOUR" ? "RUNGIS" : file.source);
    if (siteId) {
      for (const [, empId] of employeeIdMap) {
        await client.query(
          `INSERT INTO "EmployeeSite" (id, "employeeId", "siteId", "isPrimary", "startDate")
           VALUES ($1, $2, $3, true, NOW())
           ON CONFLICT ("employeeId", "siteId", "startDate") DO NOTHING`,
          [generateCuid(), empId, siteId],
        );
      }
    }

    // --- Build vehicle map ---
    const vehicleMap = new Map<string, string>();
    const existingVehicles = await client.query('SELECT id, registration FROM "Vehicle"');
    for (const row of existingVehicles.rows) {
      vehicleMap.set(row.registration, row.id);
    }

    // --- Insert work entries in batches ---
    console.log(`  Insertion des entrées (${entries.length})...`);
    let batchSkipped = 0;

    // Collect all employee IDs we need but don't have yet
    const missingMatricules = new Set<string>();
    for (const entry of entries) {
      if (!employeeIdMap.has(entry.matricule)) {
        missingMatricules.add(entry.matricule);
      }
    }

    // Look up existing employees for missing matricules
    if (missingMatricules.size > 0) {
      const existingRes = await client.query(
        'SELECT id, matricule FROM "Employee" WHERE matricule = ANY($1)',
        [Array.from(missingMatricules)],
      );
      for (const row of existingRes.rows) {
        employeeIdMap.set(row.matricule, row.id);
        missingMatricules.delete(row.matricule);
      }

      // Create placeholder employees for truly missing matricules
      for (const mat of missingMatricules) {
        const id = generateCuid();
        const res = await client.query(
          `INSERT INTO "Employee" (id, matricule, nom, prenom, "typeContrat", categorie, poste, "dateDebut", "dateEntree", "isActive", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, '', 'CDI'::"ContractType", $4::"EmployeeCategory", 'Non défini', NOW(), NOW(), true, NOW(), NOW())
           ON CONFLICT (matricule) DO UPDATE SET "updatedAt" = NOW()
           RETURNING id`,
          [id, mat, `Matricule_${mat}`, file.categorie],
        );
        employeeIdMap.set(mat, res.rows[0].id);
      }
    }

    const BATCH_SIZE = 500;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);

      const values: unknown[] = [];
      const placeholders: string[] = [];
      let paramIdx = 1;

      for (const entry of batch) {
        const employeeId = employeeIdMap.get(entry.matricule);
        if (!employeeId) {
          batchSkipped++;
          continue;
        }

        // Find or create vehicle
        let vehicleId: string | null = null;
        if (entry.vehicule) {
          if (!vehicleMap.has(entry.vehicule)) {
            const vId = generateCuid();
            try {
              await client.query(
                'INSERT INTO "Vehicle" (id, registration, "isActive", "createdAt", "updatedAt") VALUES ($1, $2, true, NOW(), NOW()) ON CONFLICT (registration) DO NOTHING RETURNING id',
                [vId, entry.vehicule],
              );
              vehicleMap.set(entry.vehicule, vId);
            } catch {
              // already exists
            }
            // Re-fetch in case of conflict
            if (!vehicleMap.has(entry.vehicule)) {
              const vr = await client.query(
                'SELECT id FROM "Vehicle" WHERE registration = $1',
                [entry.vehicule],
              );
              if (vr.rows[0]) vehicleMap.set(entry.vehicule, vr.rows[0].id);
            }
          }
          vehicleId = vehicleMap.get(entry.vehicule) || null;
        }

        // Find absence code
        let absenceCodeId: string | null = null;
        if (entry.motifAbsence) {
          absenceCodeId =
            absenceMap.get(entry.motifAbsence) ||
            absenceMap.get(entry.motifAbsence.toLowerCase()) ||
            null;
        }

        const typeContrat = normalizeContract(entry.typeContrat);
        const dateStr = entry.date.toISOString().split("T")[0];

        placeholders.push(
          `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}::date, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}::\"ContractType\", $${paramIdx + 7}, $${paramIdx + 8}, $${paramIdx + 9}, $${paramIdx + 10}, $${paramIdx + 11}, $${paramIdx + 12}, $${paramIdx + 13}, $${paramIdx + 14}, $${paramIdx + 15}, $${paramIdx + 16}, $${paramIdx + 17}, $${paramIdx + 18}, 'IMPORT_EXCEL'::"EntrySource", NOW(), NOW())`,
        );

        values.push(
          generateCuid(),     // id
          employeeId,         // employeeId
          dateStr,            // date
          entry.weekNumber,   // weekNumber
          entry.dayName,      // dayName
          entry.affectation || null, // affectation
          typeContrat,        // typeContrat
          entry.matricule,    // matricule
          entry.nomConducteur, // nomConducteur
          entry.posteOccupe || null, // posteOccupe
          absenceCodeId,      // absenceCodeId
          entry.heureDebut,   // heureDebut
          entry.heureFin,     // heureFin
          entry.tempsTravail, // tempsTravail
          entry.heuresDecimales, // heuresDecimales
          vehicleId,          // vehicleId
          entry.typeRoute || null, // typeRoute
          entry.nbKm,         // nbKm
          null,               // updatedBy
        );
        paramIdx += 19;
      }

      if (placeholders.length > 0) {
        const sql = `
          INSERT INTO "WorkEntry" (id, "employeeId", date, "weekNumber", "dayName", affectation, "typeContrat", matricule, "nomConducteur", "posteOccupe", "absenceCodeId", "heureDebut", "heureFin", "tempsTravail", "heuresDecimales", "vehicleId", "typeRoute", "nbKm", "updatedBy", source, "createdAt", "updatedAt")
          VALUES ${placeholders.join(",\n")}
          ON CONFLICT ("employeeId", date) DO UPDATE SET
            "absenceCodeId" = EXCLUDED."absenceCodeId",
            "heureDebut" = EXCLUDED."heureDebut",
            "heureFin" = EXCLUDED."heureFin",
            "tempsTravail" = EXCLUDED."tempsTravail",
            "heuresDecimales" = EXCLUDED."heuresDecimales",
            "vehicleId" = EXCLUDED."vehicleId",
            "typeRoute" = EXCLUDED."typeRoute",
            "nbKm" = EXCLUDED."nbKm",
            "updatedAt" = NOW()
        `;
        try {
          await client.query(sql, values);
          totalEntries += placeholders.length;
        } catch (err) {
          console.error(`  ✗ Erreur batch ${i}-${i + BATCH_SIZE}:`, (err as Error).message);
          // Fall back to individual inserts
          for (let j = 0; j < batch.length; j++) {
            const entry = batch[j];
            const employeeId = employeeIdMap.get(entry.matricule);
            if (!employeeId) continue;

            let vehicleId: string | null = null;
            if (entry.vehicule) vehicleId = vehicleMap.get(entry.vehicule) || null;

            let absenceCodeId: string | null = null;
            if (entry.motifAbsence) {
              absenceCodeId = absenceMap.get(entry.motifAbsence) || absenceMap.get(entry.motifAbsence.toLowerCase()) || null;
            }

            const typeContrat = normalizeContract(entry.typeContrat);
            const dateStr = entry.date.toISOString().split("T")[0];

            try {
              await client.query(
                `INSERT INTO "WorkEntry" (id, "employeeId", date, "weekNumber", "dayName", affectation, "typeContrat", matricule, "nomConducteur", "posteOccupe", "absenceCodeId", "heureDebut", "heureFin", "tempsTravail", "heuresDecimales", "vehicleId", "typeRoute", "nbKm", source, "createdAt", "updatedAt")
                 VALUES ($1, $2, $3::date, $4, $5, $6, $7::"ContractType", $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'IMPORT_EXCEL'::"EntrySource", NOW(), NOW())
                 ON CONFLICT ("employeeId", date) DO NOTHING`,
                [
                  generateCuid(), employeeId, dateStr, entry.weekNumber, entry.dayName,
                  entry.affectation || null, typeContrat, entry.matricule, entry.nomConducteur,
                  entry.posteOccupe || null, absenceCodeId, entry.heureDebut, entry.heureFin,
                  entry.tempsTravail, entry.heuresDecimales, vehicleId, entry.typeRoute || null, entry.nbKm,
                ],
              );
              totalEntries++;
            } catch (err2) {
              batchSkipped++;
            }
          }
        }
      }

      if ((i + BATCH_SIZE) % 5000 === 0 || i + BATCH_SIZE >= entries.length) {
        console.log(`    ${Math.min(i + BATCH_SIZE, entries.length)}/${entries.length} traités`);
      }
    }

    totalSkipped += batchSkipped;
    console.log(`  ✓ ${file.source}: ${entries.length - batchSkipped} insérées, ${batchSkipped} ignorées`);

    // Record import batch
    await client.query(
      `INSERT INTO "ImportBatch" (id, filename, source, "rowsTotal", "rowsImported", "rowsSkipped", "createdAt", "createdBy")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'migration-script')`,
      [generateCuid(), file.path, file.source, entries.length, entries.length - batchSkipped, batchSkipped],
    );
  }

  console.log("\n=== Résumé ===");
  console.log(`Employés insérés/mis à jour: ${totalEmployees}`);
  console.log(`Entrées insérées: ${totalEntries}`);
  console.log(`Entrées ignorées: ${totalSkipped}`);

  // Verify counts
  const empCount = await client.query('SELECT count(*) FROM "Employee"');
  const entryCount = await client.query('SELECT count(*) FROM "WorkEntry"');
  const vehCount = await client.query('SELECT count(*) FROM "Vehicle"');
  console.log(`\n=== État BDD ===`);
  console.log(`Employés: ${empCount.rows[0].count}`);
  console.log(`Entrées travail: ${entryCount.rows[0].count}`);
  console.log(`Véhicules: ${vehCount.rows[0].count}`);

  await client.end();
  console.log("\nTerminé.");
}

main().catch((err) => {
  console.error("ERREUR:", err);
  process.exit(1);
});
