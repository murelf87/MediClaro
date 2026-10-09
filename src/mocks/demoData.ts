/**
 * MODO DEMOSTRACIÓN — datos de ejemplo.
 *
 * Solo se usan cuando el usuario entra con "Entrar sin verificar" (y en la QA
 * visual). La app muestra siempre el aviso "Modo demostración · datos de ejemplo".
 * Personas ficticias. Los textos de medicamentos resumen información pública
 * general y NO sustituyen al prospecto oficial.
 * Forma EXACTA de las respuestas del backend real.
 */

import { VOICE_PREVIEW_TEXTS } from '../config/voicePreviews';
import { demoBoxPhoto } from './demoPhotos';

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000de0';
export const DEMO_PHONE = '+34600123456';

interface DemoCard {
  id: string;
  score: number;
  nombre: string;
  laboratorio: string | null;
  principioActivo: string;
  forma: string | null;
  fotoUrl: string | null;
}

// Medicamentos REALES de CIMA (ver MEDICINES más abajo): sus enlaces oficiales funcionan.
export const demoCards: Record<string, DemoCard> = {
  paracetamol: {
    id: '70310', score: 97, nombre: 'PARACETAMOL CINFA 1 g COMPRIMIDOS EFG', laboratorio: 'Laboratorios Cinfa S.A.',
    principioActivo: 'PARACETAMOL', forma: 'COMPRIMIDO', fotoUrl: demoBoxPhoto('70310'),
  },
  paracetamolStada: {
    id: '69478', score: 81, nombre: 'PARACETAMOL STADA 1 g COMPRIMIDOS EFG', laboratorio: 'Laboratorio Stada S.L.',
    principioActivo: 'PARACETAMOL', forma: 'COMPRIMIDO', fotoUrl: demoBoxPhoto('69478'),
  },
  paracetamolNormon: {
    id: '68331', score: 76, nombre: 'PARACETAMOL NORMON 650 mg COMPRIMIDOS EFG', laboratorio: 'Laboratorios Normon S.A.',
    principioActivo: 'PARACETAMOL', forma: 'COMPRIMIDO', fotoUrl: demoBoxPhoto('68331'),
  },
};

export const demoIdentified = {
  status: 'identified' as const,
  scanId: 101,
  best: demoCards.paracetamol,
  others: [demoCards.paracetamolStada],
};

export const demoAmbiguous = {
  status: 'ambiguous' as const,
  scanId: 102,
  reason: 'close_matches' as const,
  candidates: [demoCards.paracetamol, demoCards.paracetamolStada, demoCards.paracetamolNormon],
};

export const demoNotFound = {
  status: 'not_found' as const,
  reason: 'blurry' as const,
  message: 'La foto está borrosa. Acerca la caja y vuelve a intentarlo.',
};

const source = (id: string) => ({
  provider: 'cima',
  label: 'CIMA · Agencia Española de Medicamentos (AEMPS)',
  url: `https://cima.aemps.es/cima/publico/detalle.html?nregistro=${id}`,
  fetchedAt: new Date().toISOString(),
});

interface DemoMedicineInfo {
  nombre: string;
  laboratorio: string;
  principio: string;
  cantidad: string;
  unidad: string;
  forma: string;
  receta: boolean;
  cn: string;
  presentacion: string;
  /** Enlaces oficiales tal como los da CIMA (docs → urlHtml). */
  leafletUrl: string;
  sheetUrl: string;
  paraQue: string;
  comoSeToma: string;
  avisos: string[];
  conservacion: string;
}

const PARACETAMOL_AVISOS = [
  'No superes la dosis recomendada: puede dañar el hígado.',
  'No lo tomes junto con otros medicamentos que también lleven paracetamol.',
  'Consulta a tu médico si tienes problemas de hígado o de riñón, o si bebes alcohol a diario.',
];
const ROOM = 'Guárdalo a temperatura ambiente, en su envase original y fuera del alcance de los niños.';
const cimaDocs = (id: string) => ({
  leafletUrl: `https://cima.aemps.es/cima/dochtml/p/${id}/P_${id}.html`,
  sheetUrl: `https://cima.aemps.es/cima/dochtml/ft/${id}/FT_${id}.html`,
});

/**
 * Medicamentos REALES de CIMA (AEMPS), comprobados el 09/10/2026 con la API oficial (todos con foto real de la caja en CIMA)
 * (/cima/rest/medicamento?nregistro=…): número de registro, nombre, laboratorio, receta, código nacional y
 * enlaces oficiales (docs → urlHtml, que en los seis siguen el formato de cimaDocs). Así «Ver prospecto oficial»
 * abre el prospecto de verdad. Los textos sencillos resumen el prospecto oficial de cada uno (sección 3 para la
 * dosis); son de ejemplo y no sustituyen al prospecto.
 */
const MEDICINES: Record<string, DemoMedicineInfo> = {
  '70310': {
    nombre: 'PARACETAMOL CINFA 1 g COMPRIMIDOS EFG', laboratorio: 'Laboratorios Cinfa S.A.',
    principio: 'PARACETAMOL', cantidad: '1', unidad: 'g', forma: 'COMPRIMIDO', receta: true,
    cn: '662026', presentacion: 'PARACETAMOL CINFA 1 g COMPRIMIDOS EFG, 40 comprimidos', ...cimaDocs('70310'),
    paraQue: 'Alivia el dolor leve o moderado (de cabeza, muscular o de espalda) y baja la fiebre.',
    comoSeToma: 'Adultos: medio o 1 comprimido cuando lo necesites, dejando al menos 4 horas entre tomas. No tomes más de 4 comprimidos en 24 horas.',
    avisos: PARACETAMOL_AVISOS, conservacion: ROOM,
  },
  '69478': {
    nombre: 'PARACETAMOL STADA 1 g COMPRIMIDOS EFG', laboratorio: 'Laboratorio Stada S.L.',
    principio: 'PARACETAMOL', cantidad: '1', unidad: 'g', forma: 'COMPRIMIDO', receta: true,
    cn: '660261', presentacion: 'PARACETAMOL STADA 1 g COMPRIMIDOS EFG, 40 comprimidos', ...cimaDocs('69478'),
    paraQue: 'Alivia el dolor leve o moderado (de cabeza, muscular o de espalda) y baja la fiebre.',
    comoSeToma: 'Adultos: 1 comprimido cuando lo necesites, dejando al menos 4 horas entre tomas. No tomes más de 4 comprimidos en 24 horas.',
    avisos: PARACETAMOL_AVISOS, conservacion: ROOM,
  },
  '68331': {
    nombre: 'PARACETAMOL NORMON 650 mg COMPRIMIDOS EFG', laboratorio: 'Laboratorios Normon S.A.',
    principio: 'PARACETAMOL', cantidad: '650', unidad: 'mg', forma: 'COMPRIMIDO', receta: false,
    cn: '658247', presentacion: 'PARACETAMOL NORMON 650 mg COMPRIMIDOS EFG, 40 comprimidos', ...cimaDocs('68331'),
    paraQue: 'Alivia el dolor leve o moderado (de cabeza, muscular o de espalda) y baja la fiebre.',
    comoSeToma: 'Adultos: medio o 1 comprimido cada 4 a 6 horas si lo necesitas. No tomes más de 3 g en 24 horas.',
    avisos: PARACETAMOL_AVISOS, conservacion: ROOM,
  },
  '70039': {
    nombre: 'IBUPROFENO CINFA 600 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG', laboratorio: 'Laboratorios Cinfa S.A.',
    principio: 'IBUPROFENO', cantidad: '600', unidad: 'mg', forma: 'COMPRIMIDO RECUBIERTO CON PELÍCULA', receta: true,
    cn: '661426', presentacion: 'IBUPROFENO CINFA 600 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG, 40 comprimidos', ...cimaDocs('70039'),
    paraQue: 'Alivia el dolor y la inflamación (por ejemplo, de articulaciones o músculos) y baja la fiebre.',
    comoSeToma: 'Adultos: 1 comprimido cada 6 a 8 horas, mejor con comida. No tomes más de 4 comprimidos al día (2.400 mg).',
    avisos: [
      'Tómalo con alimentos para proteger el estómago.',
      'No lo uses si has tenido úlcera o sangrado de estómago.',
      'Consulta a tu médico si tienes la tensión alta, problemas de corazón o de riñón.',
      'No lo combines con otros antiinflamatorios.',
    ],
    conservacion: ROOM,
  },
  '63710': {
    nombre: 'OMEPRAZOL NORMON 20 mg CAPSULAS DURAS GASTRORRESISTENTES EFG', laboratorio: 'Laboratorios Normon S.A.',
    principio: 'OMEPRAZOL', cantidad: '20', unidad: 'mg', forma: 'CÁPSULA DURA GASTRORRESISTENTE', receta: true,
    cn: '834697', presentacion: 'OMEPRAZOL NORMON 20 mg CAPSULAS DURAS GASTRORRESISTENTES EFG, 28 cápsulas', ...cimaDocs('63710'),
    paraQue: 'Reduce la cantidad de ácido del estómago. Se usa para el ardor, el reflujo y para proteger el estómago.',
    comoSeToma: 'Normalmente 1 cápsula al día, por la mañana, con o sin comida. Trágala entera con agua, sin masticarla ni abrirla.',
    avisos: [
      'No mastiques ni abras la cápsula.',
      'Consulta a tu médico si pierdes peso sin motivo, vomitas o notas sangre en las heces.',
      'Si lo tomas durante mucho tiempo, tu médico revisará el tratamiento.',
    ],
    conservacion: 'Guárdalo a temperatura ambiente, en su envase original y protegido de la humedad.',
  },
  '71269': {
    nombre: 'METFORMINA SANDOZ 850 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG', laboratorio: 'Sandoz Farmaceutica S.A.',
    principio: 'METFORMINA HIDROCLORURO', cantidad: '850', unidad: 'mg', forma: 'COMPRIMIDO RECUBIERTO CON PELÍCULA', receta: true,
    cn: '670938', presentacion: 'METFORMINA SANDOZ 850 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG, 50 comprimidos', ...cimaDocs('71269'),
    paraQue: 'Ayuda a controlar el azúcar en sangre en personas con diabetes tipo 2.',
    comoSeToma: 'Normalmente 1 comprimido 2 o 3 veces al día, durante o después de las comidas, como te haya indicado tu médico. Trágalo con un vaso de agua.',
    avisos: [
      'Avisa a tu médico antes de una prueba con contraste o de una operación.',
      'Consulta si tienes problemas de riñón o de hígado.',
      'Evita el alcohol en exceso.',
    ],
    conservacion: 'Guárdalo a temperatura ambiente, en su envase original.',
  },
};

/** Números de registro de los medicamentos de ejemplo (todos existen en CIMA). */
export const DEMO_MEDICINE_IDS = Object.keys(MEDICINES);

/** Ficha con la forma de `medicine-detail`. */
export function demoDetail(id: string) {
  const m = MEDICINES[id];
  if (!m) {
    return {
      medicine: {
        id, nombre: 'MEDICAMENTO DE DEMOSTRACIÓN', laboratorio: null, principiosActivos: [], formaFarmaceutica: null,
        presentaciones: [], receta: false, comercializado: true, fotoUrl: demoBoxPhoto(id), source: source(id),
      },
      simple: null,
      leaflet: [],
      leafletUrl: null,
      sheetUrl: null,
    };
  }
  const src = source(id);
  return {
    medicine: {
      id,
      nombre: m.nombre,
      laboratorio: m.laboratorio,
      principiosActivos: [{ nombre: m.principio, cantidad: m.cantidad, unidad: m.unidad }],
      formaFarmaceutica: m.forma,
      presentaciones: [{ cn: m.cn, nombre: m.presentacion }],
      receta: m.receta,
      comercializado: true,
      fotoUrl: demoBoxPhoto(id),
      source: src,
    },
    simple: {
      paraQue: m.paraQue,
      comoSeToma: m.comoSeToma,
      avisos: m.avisos,
      conservacion: m.conservacion,
      generatedFrom: 'Prospecto oficial (CIMA · AEMPS)',
      aiAssisted: true,
    },
    leaflet: [
      { key: 'indicaciones', title: '1. Qué es y para qué se utiliza', text: m.paraQue, source: src },
      { key: 'posologia', title: '3. Cómo tomarlo', text: m.comoSeToma, source: src },
      { key: 'conservacion', title: '5. Conservación', text: m.conservacion, source: src },
    ],
    leafletUrl: m.leafletUrl,
    sheetUrl: m.sheetUrl,
  };
}

const daysAgo = (d: number, h: number, min: number) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - d, h, min).toISOString();
};

export const demoSavedMedications = [
  { id: 1, user_id: DEMO_USER_ID, nregistro: '70310', nombre: 'PARACETAMOL CINFA 1 g COMPRIMIDOS EFG', principio_activo: 'Paracetamol', presentacion: 'Comprimidos', favorito: true, created_at: daysAgo(7, 10, 12) },
  { id: 2, user_id: DEMO_USER_ID, nregistro: '70039', nombre: 'IBUPROFENO CINFA 600 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG', principio_activo: 'Ibuprofeno', presentacion: 'Comprimidos recubiertos', favorito: false, created_at: daysAgo(9, 9, 0) },
  { id: 3, user_id: DEMO_USER_ID, nregistro: '63710', nombre: 'OMEPRAZOL NORMON 20 mg CAPSULAS DURAS GASTRORRESISTENTES EFG', principio_activo: 'Omeprazol', presentacion: 'Cápsulas', favorito: false, created_at: daysAgo(17, 18, 30) },
  { id: 4, user_id: DEMO_USER_ID, nregistro: '71269', nombre: 'METFORMINA SANDOZ 850 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG', principio_activo: 'Metformina hidrocloruro', presentacion: 'Comprimidos', favorito: false, created_at: daysAgo(25, 8, 0) },
];

export const demoScans = () => [
  { id: 101, user_id: DEMO_USER_ID, nregistro: '70310', nombre: 'PARACETAMOL CINFA 1 g COMPRIMIDOS EFG', confidence: 'alta', created_at: daysAgo(0, 10, 12), status: 'identified', score: 0.97, method: 'cn' },
  { id: 100, user_id: DEMO_USER_ID, nregistro: null, nombre: null, confidence: 'media', created_at: daysAgo(0, 9, 40), status: 'ambiguous', score: 0.71, method: 'ocr' },
  { id: 99, user_id: DEMO_USER_ID, nregistro: '70039', nombre: 'IBUPROFENO CINFA 600 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG', confidence: 'alta', created_at: daysAgo(1, 18, 5), status: 'identified', score: 0.93, method: 'ocr' },
  { id: 98, user_id: DEMO_USER_ID, nregistro: null, nombre: null, confidence: null, created_at: daysAgo(5, 12, 0), status: 'not_found', score: null, method: 'ocr' },
  { id: 97, user_id: DEMO_USER_ID, nregistro: '63710', nombre: 'OMEPRAZOL NORMON 20 mg CAPSULAS DURAS GASTRORRESISTENTES EFG', confidence: 'alta', created_at: daysAgo(12, 8, 30), status: 'identified', score: 0.95, method: 'cn' },
];

export const demoEmergencyProfile = {
  id: 1,
  user_id: DEMO_USER_ID,
  full_name: 'María García López',
  date_of_birth: '1948-03-12',
  address: 'Avenida de la Paz, 12',
  postal_code: '41005',
  city: 'Sevilla',
  province: 'Sevilla',
  country: 'España',
  blood_type: 'A+',
  allergies: 'Penicilina',
  medical_conditions: 'Hipertensión',
  current_medications: 'Paracetamol 1 g, Omeprazol 20 mg, Metformina 850 mg, Enalapril 10 mg, Atorvastatina 20 mg',
  emergency_contact_name: 'Ana García',
  emergency_contact_relationship: 'Hija',
  emergency_contact_phone: '+34600987654',
  language: 'es-ES',
  voice_preference: 'female',
  consent_share_location: true,
  consent_share_address: true,
  consent_share_medications: true,
  consent_share_allergies: true,
  consent_share_medical_info: true,
  consent_share_conversation: true,
  consent_notify_contact: true,
  updated_at: daysAgo(7, 10, 0),
};

export const demoAccountStatus = (premium: boolean) => ({
  plan: premium ? 'premium' : 'free',
  state: 'FREE',
  period_end: null,
  scans_this_period: 2,
  // Premium: identificaciones ilimitadas mientras dure la suscripción (migración 20261008200000).
  included_scans: premium ? 1_000_000 : 5,
  free_scans_left: premium ? 999_998 : 3,
  settings: {
    display_name: 'María García',
    font_size: 'grande',
    easy_mode: false,
    speech_rate: 0.85,
    locale: 'es-ES',
    onboarded: true,
    country: 'ES',
  },
});

export const demoProfileRow = (premium: boolean) => ({
  id: DEMO_USER_ID,
  plan: premium ? 'premium' : 'free',
  subscription_status: premium ? 'active' : null,
  current_period_end: premium ? new Date(Date.now() + 30 * 86_400_000).toISOString() : null,
  billing_provider: 'stripe',
  created_at: '2026-03-01T10:00:00.000Z',
});

/**
 * Catálogo de planes tal como lo configuraría el propietario en app_config (key 'plans'):
 * precios del tablero, compra integrada ya comprobada por el servidor y create-checkout con planId.
 */
export const demoPlansConfig = {
  providerLabel: 'Stripe',
  checkoutAcceptsPlanId: true,
  storeVerification: true,
  // Bizum (pago único por periodo) y «Que pague mi familiar»: el servidor de ejemplo los admite.
  bizum: true,
  familyPay: true,
  // Domiciliación bancaria SEPA y PayPal (la misma suscripción, otra forma de cobro).
  sepaDebit: true,
  paypal: true,
  plans: [
    { id: 'premium_monthly', name: 'MediClaro Premium', period: 'monthly', priceCents: 499, terms: ['IVA incluido.', 'Identificaciones ilimitadas mientras dure la suscripción.'] },
    { id: 'premium_quarterly', name: 'MediClaro Premium', period: 'quarterly', priceCents: 1299, terms: ['IVA incluido.', 'Identificaciones ilimitadas mientras dure la suscripción.'] },
    { id: 'premium_annual', name: 'MediClaro Premium', period: 'annual', priceCents: 3999, highlighted: true, terms: ['IVA incluido.', 'Identificaciones ilimitadas mientras dure la suscripción.'] },
  ],
};

/** Refleja los valores reales de plan_config del backend. */
export const demoPlanConfig = [
  { plan: 'free', monthly_scans: 5, overage_enabled: false, hard_cap: 5, chat_per_day: 10 },
  { plan: 'premium', monthly_scans: 1_000_000, overage_enabled: false, hard_cap: 1_000_000, chat_per_day: 200 },
];

export const demoEmergencyConfig = {
  primaryAssistanceName: 'Central MediClaro (demo)',
  primaryAssistanceNumber: '+34900000000',
  countryEmergencyNumber: '112',
  regionOverrides: {},
};

/**
 * El texto de la respuesta es EXACTAMENTE el permitido en tts-preview (no cambiarlo). El enlace es el prospecto
 * oficial del paracetamol de ejemplo, el mismo que «Ver prospecto oficial» en su ficha.
 */
export const demoChatReply = {
  reply: 'El paracetamol sirve para aliviar el dolor leve o moderado y para bajar la fiebre. En adultos se suele tomar 1 comprimido de 1 g cada 6 a 8 horas, sin pasar de 3 al día. Si tienes dudas, consulta a tu farmacéutico.',
  sourceUrl: MEDICINES['70310'].leafletUrl,
};

/** Saludo del asistente: es la frase de prueba de voz permitida en tts-preview (suena con voz natural también sin cuenta). */
export const DEMO_GREETING_REPLY = VOICE_PREVIEW_TEXTS.assistantTest;
const DEMO_THANKS_REPLY = 'De nada. Aquí estoy para lo que necesites sobre tus medicamentos.';
const DEMO_UNKNOWN_REPLY =
  'En el modo de demostración no estoy conectado a la inteligencia artificial, así que solo respondo a algunas preguntas de ejemplo: por tus pastillas de hoy, por tus medicamentos guardados, qué hacer si se te olvida una toma o cómo guardar las medicinas. Con tu cuenta de MediClaro te respondo a cualquier duda con el prospecto oficial.';
const DEMO_FORGOT_REPLY =
  'Si se te olvida una toma, mira en el prospecto el apartado «Si olvidó tomar» de ese medicamento, porque cada uno es distinto. En general, no se toma una dosis doble para compensar. Si no lo tienes claro, pregunta a tu farmacéutico, y anota en «Mis pastillas» lo que hayas hecho.';
const DEMO_STORAGE_REPLY =
  'Guarda tus medicinas en su caja, con su prospecto, en un sitio fresco y seco, sin sol directo y fuera del alcance de los niños; el baño y la cocina no son buenos sitios por el calor y la humedad. Algunas, como ciertas insulinas, van en la nevera: lo dice su prospecto. Las caducadas o las que ya no uses, llévalas al punto SIGRE de tu farmacia.';

const plain = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** Medicamentos de ejemplo que el asistente reconoce por su nombre (el primero de cada uno es el que se explica). */
const DEMO_NAMES: { pattern: RegExp; id: string }[] = [
  { pattern: /paracetamol/, id: '70310' },
  { pattern: /ibuprofeno/, id: '70039' },
  { pattern: /omeprazol/, id: '63710' },
  { pattern: /metformina/, id: '71269' },
];
const GREETING = /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|saludos|que tal)\b/;
const THANKS = /\b(gracias|muchas gracias)\b/;

/** Explicación sencilla de un medicamento de ejemplo, a partir de su ficha (mismo contenido que la pantalla). */
function demoMedicineAnswer(id: string): string {
  const m = MEDICINES[id];
  const name = `${m.principio.split(' ')[0].toLowerCase()} de ${m.cantidad} ${m.unidad}`;
  const article = /a$/.test(m.principio.split(' ')[0].toLowerCase()) ? 'La' : 'El';
  const what = m.paraQue.charAt(0).toLowerCase() + m.paraQue.slice(1);
  return `${article} ${name} ${what} ${m.comoSeToma} ${m.avisos[0]} Si tienes dudas, consulta a tu médico o farmacéutico.`;
}

/**
 * Respuesta del asistente en el Modo demostración y en la vista previa (sin IA): según lo que se pregunta.
 * «Hola» → saludo; un medicamento de ejemplo (o el de la ficha desde la que se pregunta) → su explicación con su
 * prospecto oficial; «gracias» → de nada; lo demás → qué se puede preguntar aquí.
 */
export function demoChatAnswer(question: string, medicineId?: string | null): { reply: string; sourceUrl: string | null } {
  const q = plain(question.trim().split('\n').pop() ?? '');
  const named = DEMO_NAMES.find((n) => n.pattern.test(q))?.id ?? null;
  const id = named ?? (medicineId && MEDICINES[medicineId] ? medicineId : null);
  if (id) {
    // El paracetamol de 1 g usa la respuesta grabable con voz natural (texto permitido en tts-preview).
    if (id === '70310' || id === '69478') return { reply: demoChatReply.reply, sourceUrl: MEDICINES[id].leafletUrl };
    return { reply: demoMedicineAnswer(id), sourceUrl: MEDICINES[id].leafletUrl };
  }
  if (GREETING.test(q)) return { reply: DEMO_GREETING_REPLY, sourceUrl: null };
  if (THANKS.test(q)) return { reply: DEMO_THANKS_REPLY, sourceUrl: null };
  if (/\b(olvid|se me paso|me salte)/.test(q)) return { reply: DEMO_FORGOT_REPLY, sourceUrl: null };
  if (/\b(guard|conserv|nevera|caducad)/.test(q)) return { reply: DEMO_STORAGE_REPLY, sourceUrl: null };
  return { reply: DEMO_UNKNOWN_REPLY, sourceUrl: null };
}

export const demoChatEmergency = {
  emergency: true,
  resources: [
    { label: 'Emergencias', phone: '112' },
    { label: 'Instituto Nacional de Toxicología', phone: '915620420' },
    { label: 'Línea de atención a la conducta suicida', phone: '024' },
  ],
};
