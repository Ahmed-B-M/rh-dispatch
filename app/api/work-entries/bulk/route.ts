import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { workEntryBulkSchema } from "@/lib/validations";
import { computeWorkDuration, getDayNameFr, getWeekNumber } from "@/lib/time-utils";
import type { Prisma } from "@prisma/client";

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

    const uniquePostes = [...new Set(employees.map((e) => e.poste).filter(Boolean))];
    const posteConfigs = await prisma.posteConfig.findMany({
      where: { label: { in: uniquePostes } },
      select: { label: true, pauseMinutes: true },
    });
    const posteMap = new Map(posteConfigs.map((p) => [p.label, p.pauseMinutes]));

    // Normalize incoming entries to a filtered, enriched list in a single pass.
    // Each normalized entry carries its computed Date object and the composite key
    // used to join against the pre-loaded existing rows.
    type NormalizedEntry = {
      key: string;
      date: Date;
      tempsTravail: string | null;
      heuresDecimales: number | null;
      input: (typeof entries)[number];
      employee: (typeof employees)[number];
    };

    const normalized: NormalizedEntry[] = [];
    const datesSet = new Set<number>();

    for (const entry of entries) {
      const employee = employeeMap.get(entry.employeeId);
      if (!employee) continue;

      const date = new Date(entry.date);
      let tempsTravail: string | null = null;
      let heuresDecimales: number | null = null;

      if (entry.heureDebut && entry.heureFin) {
        const pauseMinutes = posteMap.get(employee.poste) ?? 0;
        const result = computeWorkDuration(entry.heureDebut, entry.heureFin, pauseMinutes);
        tempsTravail = result.time;
        heuresDecimales = result.decimal;
      }

      datesSet.add(date.getTime());
      normalized.push({
        key: `${entry.employeeId}|${date.toISOString()}`,
        date,
        tempsTravail,
        heuresDecimales,
        input: entry,
        employee,
      });
    }

    // Single query to fetch all already-existing rows for the (employees, dates) set.
    // Avoids the previous N x findUnique pattern.
    const targetEmployeeIds = [...new Set(normalized.map((n) => n.input.employeeId))];
    const targetDates = [...datesSet].map((t) => new Date(t));

    const existingEntries =
      normalized.length === 0
        ? []
        : await prisma.workEntry.findMany({
            where: {
              employeeId: { in: targetEmployeeIds },
              date: { in: targetDates },
            },
            select: { id: true, employeeId: true, date: true },
          });

    const existingMap = new Map<string, string>();
    for (const row of existingEntries) {
      existingMap.set(`${row.employeeId}|${row.date.toISOString()}`, row.id);
    }

    // Split into createMany payload and individual updates.
    const toCreate: Prisma.WorkEntryCreateManyInput[] = [];
    const toUpdate: { id: string; data: Prisma.WorkEntryUncheckedUpdateInput }[] = [];

    for (const n of normalized) {
      const existingId = existingMap.get(n.key);
      if (existingId) {
        toUpdate.push({
          id: existingId,
          data: {
            absenceCodeId: n.input.absenceCodeId ?? null,
            heureDebut: n.input.heureDebut ?? null,
            heureFin: n.input.heureFin ?? null,
            tempsTravail: n.tempsTravail,
            heuresDecimales: n.heuresDecimales,
            vehicleId: n.input.vehicleId ?? null,
            typeRoute: n.input.typeRoute ?? null,
            nbKm: n.input.nbKm ?? null,
            updatedBy: session.user.id,
          },
        });
      } else {
        toCreate.push({
          employeeId: n.input.employeeId,
          date: n.date,
          weekNumber: getWeekNumber(n.date),
          dayName: getDayNameFr(n.date),
          affectation: n.employee.affectationCode,
          typeContrat: n.employee.typeContrat,
          matricule: n.employee.matricule,
          nomConducteur: `${n.employee.nom} ${n.employee.prenom}`,
          posteOccupe: n.employee.poste,
          absenceCodeId: n.input.absenceCodeId ?? null,
          heureDebut: n.input.heureDebut ?? null,
          heureFin: n.input.heureFin ?? null,
          tempsTravail: n.tempsTravail,
          heuresDecimales: n.heuresDecimales,
          vehicleId: n.input.vehicleId ?? null,
          typeRoute: n.input.typeRoute ?? null,
          nbKm: n.input.nbKm ?? null,
          source: "MANUAL",
          updatedBy: session.user.id,
        });
      }
    }

    // Execute all writes inside a single transaction. createMany groups inserts
    // in one round-trip; updates remain per-row (different columns per row) but
    // benefit from shared connection + atomicity.
    const operations: Prisma.PrismaPromise<unknown>[] = [];
    if (toCreate.length > 0) {
      operations.push(
        prisma.workEntry.createMany({ data: toCreate, skipDuplicates: true }),
      );
    }
    for (const u of toUpdate) {
      operations.push(
        prisma.workEntry.update({ where: { id: u.id }, data: u.data }),
      );
    }

    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }

    const created = toCreate.length;
    const updated = toUpdate.length;

    return NextResponse.json({ created, updated, total: created + updated });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
