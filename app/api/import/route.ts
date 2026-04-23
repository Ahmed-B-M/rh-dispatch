import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { parseExcelFile } from "@/lib/excel-import";
import type { ContractType, EmployeeCategory } from "@prisma/client";

function mapContractType(raw: string): ContractType {
  const upper = raw.toUpperCase().trim();
  if (upper.includes("CDD")) return "CDD";
  if (upper.includes("ALT")) return "ALTERNANCE";
  return "CDI";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAdmin();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const source = (formData.get("source") as string) ?? "UNKNOWN";
    const categorie = (formData.get("categorie") as EmployeeCategory) ?? "TRANSPORT";
    const dryRun = formData.get("dryRun") === "true";

    if (!file) {
      return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const parsed = await parseExcelFile(arrayBuffer, source);

    if (dryRun) {
      return NextResponse.json({
        preview: true,
        employees: parsed.employees.length,
        entries: parsed.entries.length,
        months: parsed.months,
        errors: parsed.errors,
        sampleEmployees: parsed.employees.slice(0, 10),
        sampleEntries: parsed.entries.slice(0, 20),
      });
    }

    // Load absence codes for matching
    const absenceCodes = await prisma.absenceCode.findMany();
    const absenceCodeMap = new Map(absenceCodes.map((ac) => [ac.code.toLowerCase(), ac.id]));

    // Upsert employees
    let employeesImported = 0;
    for (const emp of parsed.employees) {
      const nameParts = emp.nomPrenom.split(/\s+/);
      const nom = nameParts[0] || "";
      const prenom = nameParts.slice(1).join(" ") || "";

      await prisma.employee.upsert({
        where: { matricule: emp.matricule },
        update: {
          typeContrat: mapContractType(emp.typeContrat),
          poste: emp.poste || "Non défini",
          affectationCode: emp.affectation || null,
          isActive: !emp.isSorti,
          dateSortie: emp.isSorti ? new Date() : null,
        },
        create: {
          matricule: emp.matricule,
          nom,
          prenom,
          typeContrat: mapContractType(emp.typeContrat),
          categorie,
          poste: emp.poste || "Non défini",
          affectationCode: emp.affectation || null,
          dateDebut: new Date(2024, 0, 1),
          dateEntree: new Date(2024, 0, 1),
          isActive: !emp.isSorti,
          dateSortie: emp.isSorti ? new Date() : null,
        },
      });
      employeesImported++;
    }

    // Load employee map for entry linking
    const allEmployees = await prisma.employee.findMany({
      select: { id: true, matricule: true },
    });
    const employeeIdMap = new Map(allEmployees.map((e) => [e.matricule, e.id]));

    // Load vehicles for matching
    const vehicles = await prisma.vehicle.findMany();
    const vehicleMap = new Map(vehicles.map((v) => [v.registration.toLowerCase(), v.id]));

    let entriesImported = 0;
    let entriesSkipped = 0;
    const importErrors: string[] = [...parsed.errors];

    for (const entry of parsed.entries) {
      const employeeId = employeeIdMap.get(entry.matricule);
      if (!employeeId) {
        entriesSkipped++;
        continue;
      }

      const absenceCodeId = entry.motifAbsence
        ? absenceCodeMap.get(entry.motifAbsence.toLowerCase()) ?? null
        : null;

      let vehicleId: string | null = null;
      if (entry.vehicule) {
        vehicleId = vehicleMap.get(entry.vehicule.toLowerCase()) ?? null;
        if (!vehicleId && entry.vehicule.trim()) {
          const newVehicle = await prisma.vehicle.create({
            data: { registration: entry.vehicule.trim() },
          });
          vehicleMap.set(entry.vehicule.toLowerCase(), newVehicle.id);
          vehicleId = newVehicle.id;
        }
      }

      try {
        await prisma.workEntry.upsert({
          where: {
            employeeId_date: { employeeId, date: entry.date },
          },
          update: {
            affectation: entry.affectation || null,
            typeContrat: mapContractType(entry.typeContrat),
            nomConducteur: entry.nomConducteur,
            posteOccupe: entry.posteOccupe || null,
            absenceCodeId,
            heureDebut: entry.heureDebut,
            heureFin: entry.heureFin,
            tempsTravail: entry.tempsTravail,
            heuresDecimales: entry.heuresDecimales,
            vehicleId,
            typeRoute: entry.typeRoute || null,
            nbKm: entry.nbKm,
            source: "IMPORT_EXCEL",
          },
          create: {
            employeeId,
            date: entry.date,
            weekNumber: entry.weekNumber,
            dayName: entry.dayName,
            affectation: entry.affectation || null,
            typeContrat: mapContractType(entry.typeContrat),
            matricule: entry.matricule,
            nomConducteur: entry.nomConducteur,
            posteOccupe: entry.posteOccupe || null,
            absenceCodeId,
            heureDebut: entry.heureDebut,
            heureFin: entry.heureFin,
            tempsTravail: entry.tempsTravail,
            heuresDecimales: entry.heuresDecimales,
            vehicleId,
            typeRoute: entry.typeRoute || null,
            nbKm: entry.nbKm,
            source: "IMPORT_EXCEL",
          },
        });
        entriesImported++;
      } catch (err) {
        entriesSkipped++;
        importErrors.push(`Row ${entry.matricule}/${entry.date.toISOString().split("T")[0]}: ${(err as Error).message}`);
      }
    }

    // Record import batch
    await prisma.importBatch.create({
      data: {
        filename: file.name,
        source,
        rowsTotal: parsed.entries.length,
        rowsImported: entriesImported,
        rowsSkipped: entriesSkipped,
        errors: importErrors.length > 0 ? importErrors.slice(0, 100) : undefined,
        createdBy: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      employeesImported,
      entriesImported,
      entriesSkipped,
      errors: importErrors.slice(0, 50),
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("Import error:", err);
    return NextResponse.json(
      { error: "Erreur d'import", details: (err as Error).message },
      { status: 500 },
    );
  }
}
