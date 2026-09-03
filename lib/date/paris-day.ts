/**
 * Date du jour (YYYY-MM-DD) dans le fuseau Europe/Paris. Comme pour
 * parisWeekStart, recalculée à chaque chargement de page — le "reset
 * nocturne" du suivi quotidien est simplement l'apparition d'une nouvelle
 * date, sans dépendre d'un cron.
 */
export function parisToday(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Ajoute `months` mois à une date calendaire (YYYY-MM-DD), arithmétique pure. */
export function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, d, 12)).toISOString().slice(0, 10);
}
