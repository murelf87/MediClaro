import { keepDoseTogether, prettifyMedicineName as prettifyRaw, prettifySentence, shortMedicineName as shortRaw } from '../medicineText';

// La cifra y su unidad van unidas con un espacio de no separación; para comparar
// el texto se usa la versión con espacios normales.
const plain = (s: string) => s.replace(/\u00A0/g, ' ');
const prettifyMedicineName = (v: string | null | undefined) => plain(prettifyRaw(v));
const shortMedicineName = (v: string | null | undefined, a?: string | null) => plain(shortRaw(v, a));

describe('prettifyMedicineName', () => {
  it('pasa de MAYÚSCULAS a texto legible respetando unidades y siglas', () => {
    expect(prettifyMedicineName('PARACETAMOL KERN PHARMA 1 G COMPRIMIDOS EFG')).toBe('Paracetamol Kern Pharma 1 g Comprimidos EFG');
    expect(prettifyMedicineName('IBUPROFENO CINFA 600 MG COMPRIMIDOS RECUBIERTOS CON PELICULA EFG')).toBe(
      'Ibuprofeno Cinfa 600 mg Comprimidos Recubiertos con Pelicula EFG',
    );
  });
  it('respeta siglas con puntos (S.A., S.L.)', () => {
    expect(prettifyMedicineName('LABORATORIOS CINFA, S.A.')).toBe('Laboratorios Cinfa, S.A.');
    expect(prettifyMedicineName('KERN PHARMA, S.L.')).toBe('Kern Pharma, S.L.');
  });
  it('no toca nombres que ya vienen en minúsculas', () => {
    expect(prettifyMedicineName('Paracetamol 1 g')).toBe('Paracetamol 1 g');
  });
  it('tolera vacíos', () => {
    expect(prettifyMedicineName('')).toBe('');
    expect(prettifyMedicineName(null)).toBe('');
  });
});

describe('prettifySentence', () => {
  it('convierte formas farmacéuticas', () => {
    expect(prettifySentence('COMPRIMIDO RECUBIERTO CON PELÍCULA')).toBe('Comprimido recubierto con película');
  });
});

describe('shortMedicineName', () => {
  it('principio activo + dosis', () => {
    expect(shortMedicineName('Paracetamol Kern Pharma 1 g Comprimidos EFG', 'Paracetamol')).toBe('Paracetamol 1 g');
    expect(shortMedicineName('Ibuprofeno Cinfa 600 mg Comprimidos Recubiertos con Pelicula EFG', 'Ibuprofeno')).toBe('Ibuprofeno 600 mg');
  });
  it('principio activo de varias palabras', () => {
    expect(shortMedicineName('Acido Acetilsalicilico Cinfa 100 mg Comprimidos EFG', 'Ácido acetilsalicílico')).toBe(
      'Acido Acetilsalicilico 100 mg',
    );
  });
  it('marca + dosis cuando el nombre no empieza por el principio activo', () => {
    expect(shortMedicineName('Adiro 100 mg Comprimidos Gastrorresistentes', 'Ácido acetilsalicílico')).toBe('Adiro 100 mg');
  });
  it('dosis compuestas', () => {
    expect(shortMedicineName('Paracetamol/Codeina Kern 500 mg/30 mg Comprimidos EFG', 'Paracetamol')).toBe('Paracetamol/Codeina 500 mg/30 mg');
  });
  it('sin dosis reconocible devuelve el nombre completo', () => {
    expect(shortMedicineName('Medicamento de demostración', null)).toBe('Medicamento de demostración');
  });
});

describe('keepDoseTogether', () => {
  it('no separa la cifra de su unidad', () => {
    expect(shortRaw('Paracetamol Kern Pharma 1 g Comprimidos EFG', 'Paracetamol')).toBe('Paracetamol 1\u00A0g');
    expect(prettifyRaw('OMEPRAZOL NORMON 20 MG CAPSULAS')).toBe('Omeprazol Normon 20\u00A0mg Capsulas');
    expect(keepDoseTogether('500 mg/30 mg')).toBe('500\u00A0mg/30\u00A0mg');
    expect(keepDoseTogether('Crema al 5 %')).toBe('Crema al 5\u00A0%');
  });
  it('no une cifras con palabras que no son unidades', () => {
    expect(keepDoseTogether('Tomar 2 gotas')).toBe('Tomar 2 gotas');
    expect(keepDoseTogether('Caja de 20 comprimidos')).toBe('Caja de 20 comprimidos');
  });
});
