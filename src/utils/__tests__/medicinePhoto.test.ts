import { fullSizeOfficialPhoto, photoCandidates } from '../medicinePhoto';

const thumb = 'https://cima.aemps.es/cima/fotos/thumbnails/materialas/42304/42304_materialas.jpg';
const full = 'https://cima.aemps.es/cima/fotos/full/materialas/42304/42304_materialas.jpg';

test('la foto oficial grande usa el tamaño completo de CIMA (no la miniatura de 200 px)', () => {
  expect(fullSizeOfficialPhoto(thumb)).toBe(full);
  expect(photoCandidates({ official: thumb, own: null, fallback: null, large: true })).toEqual([full, thumb]);
  expect(photoCandidates({ official: thumb, own: null, fallback: null, large: false })).toEqual([thumb]);
});

test('sin foto oficial se enseña la foto de SU caja antes que el dibujo', () => {
  expect(photoCandidates({ official: null, own: null, fallback: 'data:image/jpeg;base64,AAA', large: true })).toEqual(['data:image/jpeg;base64,AAA']);
  expect(photoCandidates({ official: null, own: 'file:///own.jpg', fallback: 'data:image/jpeg;base64,AAA', large: true })).toEqual(['file:///own.jpg', 'data:image/jpeg;base64,AAA']);
});

test('Mis pastillas: primero la foto propia', () => {
  expect(photoCandidates({ official: thumb, own: 'file:///own.jpg', fallback: null, preferOwn: true, large: true })).toEqual(['file:///own.jpg', full, thumb]);
});
