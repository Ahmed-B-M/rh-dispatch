import type { ContractType, EmployeeCategory, UserRole, EntrySource } from "@prisma/client";

export type { ContractType, EmployeeCategory, UserRole, EntrySource };

export interface EmployeeWithSites {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  typeContrat: ContractType;
  categorie: EmployeeCategory;
  poste: string;
  affectationCode: string | null;
  dateDebut: Date;
  dateFin: Date | null;
  dateEntree: Date;
  dateSortie: Date | null;
  isActive: boolean;
  photoUrl: string | null;
  note: string | null;
  sites: {
    id: string;
    site: { id: string; code: string; label: string };
    isPrimary: boolean;
  }[];
}

export interface WorkEntryRow {
  id: string;
  weekNumber: number;
  date: string;
  dayName: string;
  affectation: string | null;
  typeContrat: ContractType;
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

export interface PlanningCell {
  employeeId: string;
  date: string;
  absenceCode: string | null;
  absenceColor: string | null;
  heureDebut: string | null;
  heureFin: string | null;
  heuresDecimales: number | null;
  vehicleRegistration: string | null;
  nbKm: number | null;
}

export interface DashboardKPIs {
  totalHours: number;
  absenceRate: number;
  activeEmployees: number;
  avgHoursPerDay: number;
  hoursBySite: { site: string; hours: number }[];
  absenceDistribution: { code: string; count: number; color: string }[];
}
