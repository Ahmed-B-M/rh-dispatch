import { z } from "zod";

export const employeeCreateSchema = z.object({
  matricule: z.string().min(1, "Matricule requis"),
  nom: z.string().min(1, "Nom requis"),
  prenom: z.string().min(1, "Prénom requis"),
  typeContrat: z.enum(["CDI", "CDD", "ALTERNANCE"]),
  categorie: z.enum(["SEDENTAIRE", "TRANSPORT", "LOGISTIQUE"]),
  poste: z.string().min(1, "Poste requis"),
  affectationCode: z.string().nullable().optional(),
  dateDebut: z.string().min(1, "Date début requise"),
  dateFin: z.string().nullable().optional(),
  dateEntree: z.string().min(1, "Date entrée requise"),
  dateSortie: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  note: z.string().nullable().optional(),
  siteIds: z.array(z.string()).optional(),
});

export const employeeUpdateSchema = employeeCreateSchema.partial();

export const workEntryCreateSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1),
  absenceCodeId: z.string().nullable().optional(),
  heureDebut: z.string().nullable().optional(),
  heureFin: z.string().nullable().optional(),
  vehicleId: z.string().nullable().optional(),
  typeRoute: z.string().nullable().optional(),
  nbKm: z.number().nullable().optional(),
});

export const workEntryUpdateSchema = z.object({
  absenceCodeId: z.string().nullable().optional(),
  heureDebut: z.string().nullable().optional(),
  heureFin: z.string().nullable().optional(),
  affectation: z.string().nullable().optional(),
  vehicleId: z.string().nullable().optional(),
  typeRoute: z.string().nullable().optional(),
  nbKm: z.number().nullable().optional(),
});

export const workEntryBulkSchema = z.object({
  entries: z.array(workEntryCreateSchema),
});

export const siteCreateSchema = z.object({
  code: z.string().min(1, "Code requis"),
  label: z.string().min(1, "Libellé requis"),
  isActive: z.boolean().default(true),
});

export const vehicleCreateSchema = z.object({
  registration: z.string().min(1, "Immatriculation requise"),
  isActive: z.boolean().default(true),
});
