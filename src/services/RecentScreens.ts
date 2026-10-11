/**
 * Últimas pantallas visitadas (solo el nombre de la ruta, sin datos): se adjuntan a «Notifícanos un error» para saber
 * por dónde iba la persona cuando algo falló. Solo en memoria; no se guarda ni se envía a ningún sitio más.
 */
const MAX = 6;
let recent: string[] = [];

export const RecentScreens = {
  note(path: string): void {
    const clean = path.replace(/\/\(tabs\)/g, '').replace(/\/index$/, '') || '/';
    if (recent[recent.length - 1] === clean) return;
    recent = [...recent, clean].slice(-MAX);
  },
  /** Las últimas pantallas, de la más antigua a la más reciente («/ → /assistant → /help»). */
  list(): string[] {
    return [...recent];
  },
  /** La pantalla anterior a `current` (la que estaba usando antes de abrir Ayuda o el formulario). */
  before(...skip: string[]): string | null {
    for (let i = recent.length - 1; i >= 0; i -= 1) {
      if (!skip.includes(recent[i])) return recent[i];
    }
    return null;
  },
  clear(): void {
    recent = [];
  },
};
