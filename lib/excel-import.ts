import ExcelJS from "exceljs";
import { parseExcelTime, getDayNameFr, getWeekNumber } from "./time-utils";

const MONTH_NAMES = [
  "JANVIER", "FEVRIER", "MARS", "AVRIL", "MAI", "JUIN",
  "JUILLET", "AOUT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DECEMBRE",
] as const;

const MAX_COL = 16;

export function isMonthSheet(name: string): boolean {
  const upper = name.toUpperCase().trim();
  return MONTH_NAMES.some((m) => upper.startsWith(m));
}

export function parseMonthYear(sheetName: string): { month: number; year: number } | null {
  const upper = sheetName.toUpperCase().trim();
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (upper.startsWith(MONTH_NAMES[i])) {
      const yearStr = upper.replace(MONTH_NAMES[i], "").trim();
      const year = parseInt(yearStr, 10);
      if (!isNaN(year)) return { month: i + 1, year };
    }
  }
  return null;
}

function parseExcelSerialDate(serial: number): string {
  return String(serial);
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

function parseTimeCell(cell: ExcelJS.Cell): string | null {
  if (!cell || cell.value === null || cell.value === undefined) return null;
  if (typeof cell.value === "number") {
    return parseExcelTime(cell.value);
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

function parseDateCell(cell: ExcelJS.Cell): Date | null {
  if (!cell || cell.value === null || cell.value === undefined) return null;
  if (cell.value instanceof Date) return cell.value;
  if (typeof cell.value === "number") {
    // Excel serial date: days since 1900-01-01 (with the 1900 bug)
    const utcDays = cell.value - 25569;
    const date = new Date(utcDays * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }
  const d = new Date(String(cell.value));
  return isNaN(d.getTime()) ? null : d;
}

export interface ParsedEmployee {
  matricule: string;
  nomPrenom: string;
  typeContrat: string;
  affectation: string;
  poste: string;
  isSorti: boolean;
}

export interface ParsedWorkEntry {
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

export interface ParseResult {
  employees: ParsedEmployee[];
  entries: ParsedWorkEntry[];
  months: string[];
  errors: string[];
}

export async function parseExcelFile(buffer: ArrayBuffer | Uint8Array, source: string): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as ArrayBuffer);

  const employees: ParsedEmployee[] = [];
  const entries: ParsedWorkEntry[] = [];
  const months: string[] = [];
  const errors: string[] = [];

  // Find PERSONNELS sheet
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

      const matricule = typeof matriculeRaw === "number"
        ? parseExcelSerialDate(matriculeRaw)
        : String(matriculeRaw).trim();

      if (!matricule || matricule === "0") return;

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

  // Parse monthly sheets
  for (const sheet of workbook.worksheets) {
    if (!isMonthSheet(sheet.name)) continue;

    const monthYear = parseMonthYear(sheet.name);
    if (!monthYear) continue;
    months.push(sheet.name);

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= 1) return;

      // Only read columns A through P (16)
      const matriculeRaw = row.getCell(6).value; // Column F
      if (matriculeRaw === null || matriculeRaw === undefined) return;

      const matricule = typeof matriculeRaw === "number"
        ? parseExcelSerialDate(matriculeRaw)
        : String(matriculeRaw).trim();

      if (!matricule || matricule === "Matricule" || matricule === "0") return;

      const dateCell = row.getCell(2); // Column B
      const date = parseDateCell(dateCell);
      if (!date) return;

      const nbKmRaw = row.getCell(16).value; // Column P
      const nbKm = typeof nbKmRaw === "number" ? nbKmRaw : null;

      let heureDebut: string | null = null;
      let heureFin: string | null = null;
      let tempsTravail: string | null = null;
      let heuresDecimales: number | null = null;

      heureDebut = parseTimeCell(row.getCell(10)); // Column J
      heureFin = parseTimeCell(row.getCell(11)); // Column K

      const tempsTravailRaw = row.getCell(12).value; // Column L
      if (typeof tempsTravailRaw === "number" && tempsTravailRaw > 0) {
        tempsTravail = parseExcelTime(tempsTravailRaw);
        tempsTravail += ":00";
      } else if (tempsTravailRaw instanceof Date) {
        const h = tempsTravailRaw.getHours();
        const m = tempsTravailRaw.getMinutes();
        const s = tempsTravailRaw.getSeconds();
        tempsTravail = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      }

      const heuresDecRaw = row.getCell(13).value; // Column M
      if (typeof heuresDecRaw === "number") {
        heuresDecimales = Math.round(heuresDecRaw * 100) / 100;
      }

      entries.push({
        matricule,
        date,
        weekNumber: getWeekNumber(date),
        dayName: getDayNameFr(date),
        affectation: cellText(row.getCell(4)).trim(), // Column D
        typeContrat: cellText(row.getCell(5)).trim(), // Column E
        nomConducteur: cellText(row.getCell(7)).trim(), // Column G
        motifAbsence: cellText(row.getCell(8)).trim(), // Column H
        posteOccupe: cellText(row.getCell(9)).trim(), // Column I
        heureDebut,
        heureFin,
        tempsTravail,
        heuresDecimales,
        vehicule: cellText(row.getCell(14)).trim(), // Column N
        typeRoute: cellText(row.getCell(15)).trim(), // Column O
        nbKm,
      });
    });
  }

  return { employees, entries, months, errors };
}
