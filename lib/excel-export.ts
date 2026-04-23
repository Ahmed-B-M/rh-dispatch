import ExcelJS from "exceljs";

interface ExportRow {
  weekNumber: number;
  date: string;
  dayName: string;
  affectation: string | null;
  typeContrat: string;
  matricule: string;
  nomConducteur: string;
  motifAbsence: string | null;
  posteOccupe: string | null;
  heureDebut: string | null;
  heureFin: string | null;
  tempsTravail: string | null;
  heuresDecimales: number | null;
  vehicule: string | null;
  typeRoute: string | null;
  nbKm: number | null;
}

const COLUMNS: { header: string; key: string; width: number }[] = [
  { header: "Semaine", key: "weekNumber", width: 10 },
  { header: "Jour", key: "date", width: 14 },
  { header: "Type jour", key: "dayName", width: 12 },
  { header: "Affectation", key: "affectation", width: 22 },
  { header: "Type contrat", key: "typeContrat", width: 14 },
  { header: "Matricule", key: "matricule", width: 12 },
  { header: "Nom conducteur", key: "nomConducteur", width: 26 },
  { header: "Motif_Absence", key: "motifAbsence", width: 20 },
  { header: "Poste occupé", key: "posteOccupe", width: 24 },
  { header: "Heure début", key: "heureDebut", width: 12 },
  { header: "Heure fin", key: "heureFin", width: 12 },
  { header: "Temps de travail", key: "tempsTravail", width: 16 },
  { header: "Heures décimales", key: "heuresDecimales", width: 16 },
  { header: "Véhicule", key: "vehicule", width: 14 },
  { header: "Type de route", key: "typeRoute", width: 16 },
  { header: "Nb km", key: "nbKm", width: 10 },
];

const MONTH_NAMES_FR = [
  "JANVIER", "FEVRIER", "MARS", "AVRIL", "MAI", "JUIN",
  "JUILLET", "AOUT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DECEMBRE",
];

function addSheetWithData(workbook: ExcelJS.Workbook, name: string, rows: ExportRow[]): void {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = COLUMNS.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }));

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, size: 10 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.border = {
    bottom: { style: "thin", color: { argb: "FF94A3B8" } },
  };

  for (const row of rows) {
    sheet.addRow({
      weekNumber: row.weekNumber,
      date: row.date,
      dayName: row.dayName,
      affectation: row.affectation ?? "",
      typeContrat: row.typeContrat,
      matricule: row.matricule,
      nomConducteur: row.nomConducteur,
      motifAbsence: row.motifAbsence ?? "",
      posteOccupe: row.posteOccupe ?? "",
      heureDebut: row.heureDebut ?? "",
      heureFin: row.heureFin ?? "",
      tempsTravail: row.tempsTravail ?? "",
      heuresDecimales: row.heuresDecimales,
      vehicule: row.vehicule ?? "",
      typeRoute: row.typeRoute ?? "",
      nbKm: row.nbKm,
    });
  }
}

export async function generateExcel(
  rows: ExportRow[],
  mode: "synthesis" | "site" | "employee" | "month",
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RH Dispatch";
  workbook.created = new Date();

  switch (mode) {
    case "synthesis":
      addSheetWithData(workbook, "Synthèse", rows);
      break;

    case "site": {
      const bySite = new Map<string, ExportRow[]>();
      for (const row of rows) {
        const key = row.affectation || "Sans affectation";
        if (!bySite.has(key)) bySite.set(key, []);
        bySite.get(key)!.push(row);
      }
      for (const [site, siteRows] of bySite) {
        addSheetWithData(workbook, site.substring(0, 31), siteRows);
      }
      break;
    }

    case "employee": {
      const byEmployee = new Map<string, ExportRow[]>();
      for (const row of rows) {
        const key = row.nomConducteur || row.matricule;
        if (!byEmployee.has(key)) byEmployee.set(key, []);
        byEmployee.get(key)!.push(row);
      }
      for (const [emp, empRows] of byEmployee) {
        addSheetWithData(workbook, emp.substring(0, 31), empRows);
      }
      break;
    }

    case "month": {
      const byMonth = new Map<string, ExportRow[]>();
      for (const row of rows) {
        const d = new Date(row.date);
        const key = `${MONTH_NAMES_FR[d.getMonth()]} ${d.getFullYear()}`;
        if (!byMonth.has(key)) byMonth.set(key, []);
        byMonth.get(key)!.push(row);
      }
      for (const [month, monthRows] of byMonth) {
        addSheetWithData(workbook, month.substring(0, 31), monthRows);
      }
      break;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
