import { mapCard, mapDetail, mapIdentify } from '../MedicationService';

const card = {
  id: '68339',
  score: 97,
  nombre: 'PARACETAMOL KERN PHARMA 1 G COMPRIMIDOS EFG',
  laboratorio: 'KERN PHARMA, S.L.',
  principioActivo: 'PARACETAMOL',
  forma: 'COMPRIMIDO',
  fotoUrl: null,
};

describe('MedicationService — mapeos del contrato identify-medicine', () => {
  it('mapea una tarjeta con nombre corto y nombre oficial', () => {
    const c = mapCard(card);
    expect(c.id).toBe('68339');
    expect(c.name).toBe('Paracetamol 1\u00A0g');
    expect(c.officialName).toBe('Paracetamol Kern Pharma 1\u00A0g Comprimidos EFG');
    expect(c.laboratory).toBe('Kern Pharma, S.L.');
    expect(c.pharmaceuticalForm).toBe('Comprimido');
    expect(c.score).toBe(97);
  });

  it('identified / ambiguous / not_found', () => {
    const a = mapIdentify({ status: 'identified', scanId: 1, best: card, others: [] });
    expect(a.status).toBe('identified');
    const b = mapIdentify({ status: 'ambiguous', scanId: 2, reason: 'close_matches', candidates: [card, card] });
    expect(b.status === 'ambiguous' && b.candidates.length).toBe(2);
    const n = mapIdentify({ status: 'not_found', reason: 'blurry', message: 'Acerque la caja' });
    expect(n.status).toBe('not_found');
    // Mensajes propios en tuteo, coherentes con el resto de la app
    expect(n.status === 'not_found' && n.message).toMatch(/Acerca la caja/);
  });

  it('mapea la ficha oficial (medicine-detail)', () => {
    const d = mapDetail({
      medicine: {
        id: '68339',
        nombre: card.nombre,
        laboratorio: card.laboratorio,
        principiosActivos: [{ nombre: 'PARACETAMOL', cantidad: '1', unidad: 'g' }],
        formaFarmaceutica: 'COMPRIMIDO',
        presentaciones: [{ cn: '658257', nombre: 'PARACETAMOL KERN PHARMA 1 G 40 COMPRIMIDOS' }],
        receta: false,
        comercializado: true,
        fotoUrl: null,
        source: { label: 'CIMA', url: null, fetchedAt: '2026-09-27T10:00:00Z' },
      },
      simple: { paraQue: 'Dolor', comoSeToma: 'Cada 8 h', avisos: ['No superar', ''], conservacion: 'Seco', generatedFrom: 'Prospecto', aiAssisted: true },
      leaflet: [{ key: 'indicaciones', title: '1.', text: 'Texto' }, { key: 'antes', title: '2.', text: '  ' }],
      leafletUrl: 'https://cima.aemps.es/p',
      sheetUrl: null,
    });
    expect(d.name).toBe('Paracetamol 1\u00A0g');
    expect(d.requiresPrescription).toBe(false);
    expect(d.simple?.warnings).toEqual(['No superar']);
    expect(d.leaflet).toHaveLength(1);
    expect(d.presentations[0].nationalCode).toBe('658257');
  });
});
