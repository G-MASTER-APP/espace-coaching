/**
 * Lundi (YYYY-MM-DD) de la semaine ISO en cours, calculé dans le fuseau
 * Europe/Paris. Recalculé à chaque chargement de page plutôt que de se fier
 * uniquement à un cron : le reset hebdomadaire (dimanche 00h00 Paris) est
 * ainsi toujours correct même si aucun job planifié n'a tourné entre-temps.
 */
export function parisWeekStart(date: Date = new Date()): string {
  const parisDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

  const [y, m, d] = parisDateStr.split("-").map(Number);
  // Ancrage à midi UTC : arithmétique de date calendaire pure, insensible
  // aux changements d'heure d'été/hiver.
  const noonUTC = new Date(Date.UTC(y, m - 1, d, 12));
  const isoDayOfWeek = noonUTC.getUTCDay() === 0 ? 7 : noonUTC.getUTCDay();
  noonUTC.setUTCDate(noonUTC.getUTCDate() - (isoDayOfWeek - 1));

  return noonUTC.toISOString().slice(0, 10);
}

/** Index du jour ISO en cours (0 = lundi ... 6 = dimanche), fuseau Europe/Paris. */
export function parisIsoDayIndex(date: Date = new Date()): number {
  const parisDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const [y, m, d] = parisDateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  return dow === 0 ? 6 : dow - 1;
}

export function formatFrenchDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}
