/**
 * Datos del Modo demostración y de la vista previa: todos los medicamentos de ejemplo son registros REALES de
 * CIMA y sus enlaces oficiales siguen el formato que da la propia CIMA (docs → urlHtml). Antes había números
 * inventados y «Ver prospecto oficial» abría una página de error de CIMA («El recurso solicitado no existe»).
 */
import { VOICE_PREVIEW_TEXTS } from '../../config/voicePreviews';
import {
  DEMO_MEDICINE_IDS,
  demoAmbiguous,
  demoChatAnswer,
  demoCards,
  demoChatReply,
  demoDetail,
  demoIdentified,
  demoSavedMedications,
  demoScans,
} from '../demoData';

const CIMA = 'https://cima.aemps.es/cima';

describe('Medicamentos de ejemplo (CIMA)', () => {
  test('cada ficha enlaza su propio prospecto, ficha técnica y página de CIMA', () => {
    expect(DEMO_MEDICINE_IDS.length).toBeGreaterThanOrEqual(6);
    for (const id of DEMO_MEDICINE_IDS) {
      const d = demoDetail(id);
      expect(d.leafletUrl).toBe(`${CIMA}/dochtml/p/${id}/P_${id}.html`);
      expect(d.sheetUrl).toBe(`${CIMA}/dochtml/ft/${id}/FT_${id}.html`);
      expect(d.medicine.source.url).toBe(`${CIMA}/publico/detalle.html?nregistro=${id}`);
      expect(d.medicine.nombre).not.toBe('MEDICAMENTO DE DEMOSTRACIÓN');
      expect(d.medicine.presentaciones[0].cn).toMatch(/^\d{6}$/);
      expect(d.simple?.comoSeToma.length).toBeGreaterThan(20);
    }
  });

  test('las tarjetas, guardados e historial solo usan esos medicamentos, con el mismo nombre', () => {
    const named = [
      ...Object.values(demoCards).map((c) => ({ id: c.id, nombre: c.nombre })),
      ...demoSavedMedications.map((m) => ({ id: m.nregistro, nombre: m.nombre })),
      ...demoScans()
        .filter((s) => s.nregistro)
        .map((s) => ({ id: String(s.nregistro), nombre: String(s.nombre) })),
    ];
    expect(named.length).toBeGreaterThan(8);
    for (const { id, nombre } of named) {
      expect(DEMO_MEDICINE_IDS).toContain(id);
      expect(nombre).toBe(demoDetail(id).medicine.nombre);
    }
    for (const c of [demoIdentified.best, ...demoIdentified.others, ...demoAmbiguous.candidates]) {
      expect(DEMO_MEDICINE_IDS).toContain(c.id);
    }
  });

  test('el enlace de Lucía es el prospecto del paracetamol de ejemplo', () => {
    expect(demoChatReply.sourceUrl).toBe(demoDetail(demoIdentified.best.id).leafletUrl);
  });

  test('sin los números inventados de antes', () => {
    const all = JSON.stringify({
      cards: demoCards,
      saved: demoSavedMedications,
      scans: demoScans(),
      chat: demoChatReply,
      details: DEMO_MEDICINE_IDS.map(demoDetail),
    });
    for (const fake of ['65402', '64005', '63489', '712729']) expect(all).not.toContain(fake);
  });

  test('Lucía responde según lo que se le dice (no habla del paracetamol si solo se saluda)', () => {
    expect(demoChatAnswer('hola')).toEqual({ reply: VOICE_PREVIEW_TEXTS.assistantTest, sourceUrl: null });
    expect(demoChatAnswer('Buenos días, Lucía').reply).toBe(VOICE_PREVIEW_TEXTS.assistantTest);
    expect(demoChatAnswer('Hola')).not.toEqual(expect.objectContaining({ reply: expect.stringMatching(/paracetamol/i) }));
    // El paracetamol de 1 g usa la respuesta con voz natural (texto permitido).
    expect(demoChatAnswer('¿Para qué sirve el paracetamol?')).toEqual({ reply: demoChatReply.reply, sourceUrl: demoDetail('70310').leafletUrl });
    const ibu = demoChatAnswer('¿Cómo tomo el IBUPROFENO?');
    expect(ibu.reply).toMatch(/^El ibuprofeno de 600 mg alivia el dolor/);
    expect(ibu.sourceUrl).toBe(demoDetail('70039').leafletUrl);
    expect(demoChatAnswer('¿y la metformina?').reply).toMatch(/^La metformina de 850 mg/);
    // Desde la ficha de un medicamento, una pregunta sin nombre se responde sobre ese medicamento.
    expect(demoChatAnswer('¿Cuándo lo tomo?', '63710').sourceUrl).toBe(demoDetail('63710').leafletUrl);
    expect(demoChatAnswer('Muchas gracias').reply).toMatch(/^De nada/);
    expect(demoChatAnswer('¿Qué tiempo hace?')).toEqual({ reply: expect.stringMatching(/modo de demostración/), sourceUrl: null });
  });

  test('el paracetamol de 1 g necesita receta (como en CIMA); el de 650 mg no', () => {
    expect(demoDetail('70310').medicine.receta).toBe(true);
    expect(demoDetail('68331').medicine.receta).toBe(false);
  });
});
