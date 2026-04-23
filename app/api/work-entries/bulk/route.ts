import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { workEntryBulkSchema } from "@/lib/validations";
import { computeWorkDuration, getDayNameFr, getWeekNumber } from "@/lib/time-utils";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const { entries } = workEntryBulkSchema.parse(body);

    const employeeIds = [...new Set(entries.map((e) => e.employeeId))];
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
    });
    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    let created = 0;
    let updated = 0;

    for (const entry of entries) {
      const employee = employeeMap.get(entry.employeeId);
      if (!employee) continue;

      const date = new Date(entry.date);
      let tempsTravail: string | null = null;
      let heuresDecimales: number | null = null;

      if (entry.heureDebut && entry.heureFin) {
        const result = computeWorkDuration(entry.heureDebut, entry.heureFin);
        tempsTravail = result.time;
        heuresDecimales = result.decimal;
      }

      const existing = await prisma.workEntry.findUnique({
        where: { employeeId_date: { employeeId: entry.employeeId, date } },
      });

      if (existing) {
        await prisma.workEntry.update({
          where: { id: existing.id },
          data: {
            absenceCodeId: entry.absenceCodeId ?? null,
            heureDebut: entry.heureDebut ?? null,
            heureFin: entry.heureFin ?? null,
            tempsTravail,
            heuresDecimales,
            vehicleId: entry.vehicleId ?? null,
            typeRoute: entry.typeRoute ?? null,
            nbKm: entry.nbKm ?? null,
            updatedBy: session.user.id,
          },
        });
        updated++;
      } else {
        await prisma.workEntry.create({
          data: {
            employeeId: entry.employeeId,
            date,
            weekNumber: getWeekNumber(date),
            dayName: getDayNameFr(date),
            affectation: employee.affectationCode,
            typeContrat: employee.typeContrat,
            matricule: employee.matricule,
            nomConducteur: `${employee.nom} ${employee.prenom}`,
            posteOccupe: employee.poste,
            absenceCodeId: entry.absenceCodeId ?? null,
            heureDebut: entry.heureDebut ?? null,
            heureFin: entry.heureFin ?? null,
            tempsTravail,
            heuresDecimales,
            vehicleId: entry.vehicleId ?? null,
            typeRoute: entry.typeRoute ?? null,
            nbKm: entry.nbKm ?? null,
            source: "MANUAL",
            updatedBy: session.user.id,
          },
        });
        created++;
      }
    }

    return NextResponse.json({ created, updated, total: created + updated });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
