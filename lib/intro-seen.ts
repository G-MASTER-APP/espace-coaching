const MAX_SHOWS = 2;

export function shouldShowIntro(key: string): boolean {
  try {
    const count = Number(localStorage.getItem(`intro-seen-${key}`) ?? "0");
    return count < MAX_SHOWS;
  } catch {
    return true;
  }
}

export function markIntroSeen(key: string) {
  try {
    const count = Number(localStorage.getItem(`intro-seen-${key}`) ?? "0");
    localStorage.setItem(`intro-seen-${key}`, String(count + 1));
  } catch {
    // localStorage indisponible (navigation privée…) — l'intro se
    // réaffichera simplement, pas bloquant.
  }
}
