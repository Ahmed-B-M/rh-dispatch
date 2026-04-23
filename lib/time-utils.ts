export function parseExcelTime(value: number): string {
  const totalMinutes = Math.round(value * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function computeWorkDuration(start: string, end: string): { time: string; decimal: number } {
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  const diff = endMin - startMin;
  if (diff <= 0) return { time: "00:00:00", decimal: 0 };
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return {
    time: `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`,
    decimal: parseFloat((diff / 60).toFixed(2)),
  };
}

export function minutesToDecimal(minutes: number): number {
  return parseFloat((minutes / 60).toFixed(2));
}

const DAY_NAMES_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export function getDayNameFr(date: Date): string {
  return DAY_NAMES_FR[date.getDay()];
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
