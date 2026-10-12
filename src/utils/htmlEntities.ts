/**
 * Convierte los códigos HTML que a veces trae el texto de los prospectos (CIMA · AEMPS) en letras normales:
 * `&#233;` → «é», `&#xa0;` → espacio, `&#8220;` → «"», `&aacute;` → «á»…
 * Es una protección de la app: el servidor ya debería entregarlo limpio, pero los datos guardados de antes
 * pueden venir con estos códigos y una persona mayor no tiene por qué ver «Qu&#233;».
 */
const NAMED: Record<string, string> = {
  nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', laquo: '«', raquo: '»', sbquo: '‚', bdquo: '„',
  ndash: '–', mdash: '—', hellip: '…', bull: '•', middot: '·', deg: 'º', ordm: 'º', ordf: 'ª',
  iexcl: '¡', iquest: '¿', micro: 'µ', plusmn: '±', times: '×', divide: '÷', frac12: '½', frac14: '¼',
  frac34: '¾', sup2: '²', sup3: '³', copy: '©', reg: '®', trade: '™', euro: '€', shy: '', le: '≤', ge: '≥',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', Aacute: 'Á', Eacute: 'É', Iacute: 'Í',
  Oacute: 'Ó', Uacute: 'Ú', ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü', ccedil: 'ç', Ccedil: 'Ç',
  agrave: 'à', egrave: 'è', ograve: 'ò', iuml: 'ï', ouml: 'ö', auml: 'ä', euml: 'ë',
};

function fromCodePoint(n: number): string {
  if (!Number.isFinite(n) || n <= 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return '';
  return String.fromCodePoint(n);
}

function decodeOnce(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const n = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return fromCodePoint(n);
    }
    return NAMED[body] ?? NAMED[body.toLowerCase()] ?? whole;
  });
}

/** Decodifica los códigos HTML (también los dobles, como `&amp;#233;`) y deja los espacios normales. */
export function decodeHtmlEntities(text: string | null | undefined): string {
  if (!text) return '';
  let out = String(text);
  for (let i = 0; i < 3 && /&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/i.test(out); i++) {
    const next = decodeOnce(out);
    if (next === out) break;
    out = next;
  }
  return out.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
}
