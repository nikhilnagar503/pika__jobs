const PREFIX = "pikajobs:scroll:";

export function saveScroll(key: string) {
  try {
    sessionStorage.setItem(`${PREFIX}${key}`, String(window.scrollY));
  } catch {
    // ignore storage failures
  }
}

export function restoreScroll(key: string) {
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return;
    const top = Number(raw);
    if (!Number.isFinite(top)) return;
    requestAnimationFrame(() => {
      window.scrollTo(0, top);
    });
  } catch {
    // ignore storage failures
  }
}

export function clearScroll(key: string) {
  try {
    sessionStorage.removeItem(`${PREFIX}${key}`);
  } catch {
    // ignore
  }
}
