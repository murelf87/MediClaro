// Puntuación de confianza de la identificación. Lógica pura y testeada.
// Nunca se elige un candidato al azar: si no hay un claro ganador => 'ambiguous'.

export type BoxReading = {
  nombre?: string | null;
  principioActivo?: string | null;
  dosis?: string | null;
  forma?: string | null;
  laboratorio?: string | null;
  unidades?: string | null;
  cn?: string | null;
  legible?: boolean;
  variosMedicamentos?: boolean;
};

export type Candidate = {
  id: string; nombre: string; laboratorio: string | null;
  principiosActivos: { nombre: string }[]; formaFarmaceutica: string | null;
  presentaciones?: { cn: string; nombre: string }[]; dosis?: string | null;
};

export const THRESHOLD_IDENTIFIED = 0.85;
export const MIN_GAP = 0.12;
export const MIN_CANDIDATE = 0.35;

export const norm = (s?: string | null) =>
  (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function tokens(s?: string | null) { return new Set(norm(s).split(' ').filter(t => t.length > 1)); }

function overlap(a?: string | null, b?: string | null) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let hit = 0; A.forEach(t => { if (B.has(t)) hit++; });
  return hit / A.size;
}

function doseTokens(s?: string | null) {
  return (norm(s).match(/\d+([.,]\d+)?\s?(mg|g|ml|mcg|microgramos|ui|%)/g) ?? []).map(x => x.replace(/\s/g, ''));
}

/** Puntúa un candidato frente a lo leído en la caja (0..1). */
export function scoreCandidate(r: BoxReading, c: Candidate, matchedByCN: boolean): number {
  if (matchedByCN) return 0.99; // el Código Nacional identifica la presentación exacta
  let s = 0;
  s += 0.45 * overlap(r.nombre, c.nombre);
  const pa = c.principiosActivos.map(p => p.nombre).join(' ');
  s += 0.2 * Math.max(overlap(r.principioActivo, pa), overlap(r.nombre, pa) * 0.5);
  const dr = doseTokens(r.dosis ?? r.nombre);
  if (dr.length) {
    const dc = doseTokens(c.dosis ?? c.nombre);
    s += 0.2 * (dr.some(d => dc.includes(d)) ? 1 : dc.length ? -0.5 : 0);
  }
  if (r.forma && c.formaFarmaceutica) s += 0.1 * overlap(r.forma, c.formaFarmaceutica);
  if (r.laboratorio && c.laboratorio) s += 0.05 * overlap(r.laboratorio, c.laboratorio);
  return Math.max(0, Math.min(0.97, s));
}

export type Decision =
  | { status: 'identified'; best: { id: string; score: number }; others: { id: string; score: number }[] }
  | { status: 'ambiguous'; candidates: { id: string; score: number }[]; reason: string }
  | { status: 'not_found'; reason: string };

export function decide(scored: { id: string; score: number }[], reading?: BoxReading): Decision {
  if (reading?.variosMedicamentos) {
    return { status: 'not_found', reason: 'multiple_items' };
  }
  const list = scored.filter(x => x.score >= MIN_CANDIDATE).sort((a, b) => b.score - a.score);
  if (!list.length) return { status: 'not_found', reason: reading?.legible === false ? 'blurry' : 'no_match' };
  const [top, second] = list;
  if (top.score >= THRESHOLD_IDENTIFIED && (!second || top.score - second.score >= MIN_GAP)) {
    return { status: 'identified', best: top, others: list.slice(1, 4) };
  }
  return { status: 'ambiguous', candidates: list.slice(0, 5), reason: top.score < THRESHOLD_IDENTIFIED ? 'low_confidence' : 'close_matches' };
}
