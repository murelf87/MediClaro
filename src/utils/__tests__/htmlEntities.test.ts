import { decodeHtmlEntities } from '../htmlEntities';

describe('decodeHtmlEntities (prospectos)', () => {
  it('convierte los códigos numéricos que se veían en el prospecto', () => {
    expect(decodeHtmlEntities('Qu&#233; es Vimpat')).toBe('Qué es Vimpat');
    expect(decodeHtmlEntities('&#8220;medicamentos antiepil&#233;pticos&#8221;.')).toBe('“medicamentos antiepilépticos”.');
    expect(decodeHtmlEntities('ni&#241;os a partir de 2 a&#241;os')).toBe('niños a partir de 2 años');
    expect(decodeHtmlEntities('por s&#237; solo, n&#250;mero')).toBe('por sí solo, número');
  });

  it('el espacio especial (&#xa0;) no deja líneas raras', () => {
    expect(decodeHtmlEntities('&#xa0;\n Qu&#233; es')).toBe('Qué es');
    expect(decodeHtmlEntities('a&nbsp;b')).toBe('a b');
  });

  it('códigos con nombre, en mayúsculas y dobles', () => {
    expect(decodeHtmlEntities('&aacute;cido &Eacute;l &ntilde;')).toBe('ácido Él ñ');
    expect(decodeHtmlEntities('Qu&amp;#233;')).toBe('Qué');
    expect(decodeHtmlEntities('5&nbsp;mg &plusmn; 1')).toBe('5 mg ± 1');
  });

  it('no rompe el texto normal ni lo que no conoce', () => {
    expect(decodeHtmlEntities('Tome 1 comprimido & agua')).toBe('Tome 1 comprimido & agua');
    expect(decodeHtmlEntities('&desconocido;')).toBe('&desconocido;');
    expect(decodeHtmlEntities('&#0;x&#xD800;')).toBe('x');
    expect(decodeHtmlEntities(null)).toBe('');
  });
});
