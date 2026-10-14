/**
 * Qué foto del envase se enseña (sin dependencias de pantalla, para poder probarlo).
 *
 * CIMA da la foto oficial de la caja en miniatura (200 × 113 px): ampliada se ve borrosa y no se reconoce la caja.
 * La misma foto existe a tamaño completo (1024 px) cambiando «/thumbnails/» por «/full/». Solo el ~30 % de los
 * medicamentos de CIMA tiene foto oficial: para el resto se enseña la foto de SU caja (la guardada o la que acaba de
 * hacer para identificarlo) antes que el envase ilustrado.
 */
export function fullSizeOfficialPhoto(uri: string): string {
  return uri.replace('/cima/fotos/thumbnails/', '/cima/fotos/full/');
}

/** Fotos posibles, en orden. Si una no carga, se prueba la siguiente; si no queda ninguna, el envase ilustrado. */
export function photoCandidates(opts: {
  official: string | null | undefined;
  own: string | null | undefined;
  fallback: string | null | undefined;
  preferOwn?: boolean;
  large?: boolean;
}): string[] {
  const list: string[] = [];
  const add = (u: string | null | undefined) => {
    if (u && !list.includes(u)) list.push(u);
  };
  const addOfficial = () => {
    if (!opts.official) return;
    if (opts.large) add(fullSizeOfficialPhoto(opts.official));
    add(opts.official); // si la grande no carga, la miniatura
  };
  if (opts.preferOwn) {
    add(opts.own);
    addOfficial();
  } else {
    addOfficial();
    add(opts.own);
  }
  add(opts.fallback);
  return list;
}
