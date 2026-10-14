/**
 * MODO DEMOSTRACIÓN — datos de ejemplo.
 *
 * Solo se usan cuando el usuario entra con "Entrar sin verificar" (y en la QA
 * visual). La app muestra siempre el aviso "Modo demostración · datos de ejemplo".
 * Personas ficticias. Los textos de medicamentos resumen información pública
 * general y NO sustituyen al prospecto oficial.
 * Forma EXACTA de las respuestas del backend real.
 */

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

export const demoCards: Record<string, DemoCard> = {
  paracetamol: {
    id: '65402', score: 97, nombre: 'PARACETAMOL KERN PHARMA 1 G COMPRIMIDOS EFG', laboratorio: 'KERN PHARMA, S.L.',
    principioActivo: 'PARACETAMOL', forma: 'COMPRIMIDO', fotoUrl: null,
  },
  paracetamolCinfa: {
    id: '67296', score: 81, nombre: 'PARACETAMOL CINFA 1 G COMPRIMIDOS EFG', laboratorio: 'LABORATORIOS CINFA, S.A.',
    principioActivo: 'PARACETAMOL', forma: 'COMPRIMIDO', fotoUrl: null,
  },
  paracetamolNormon: {
    id: '69785', score: 76, nombre: 'PARACETAMOL NORMON 650 MG COMPRIMIDOS EFG', laboratorio: 'LABORATORIOS NORMON, S.A.',
    principioActivo: 'PARACETAMOL', forma: 'COMPRIMIDO', fotoUrl: null,
  },
};

export const demoIdentified = {
  status: 'identified' as const,
  scanId: 101,
  best: demoCards.paracetamol,
  others: [demoCards.paracetamolCinfa],
};

export const demoAmbiguous = {
  status: 'ambiguous' as const,
  scanId: 102,
  reason: 'close_matches' as const,
  candidates: [demoCards.paracetamol, demoCards.paracetamolCinfa, demoCards.paracetamolNormon],
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
  paraQue: string;
  comoSeToma: string;
  avisos: string[];
  conservacion: string;
}

const PARACETAMOL_1G: Omit<DemoMedicineInfo, 'nombre' | 'laboratorio' | 'cn' | 'presentacion'> = {
  principio: 'PARACETAMOL', cantidad: '1', unidad: 'g', forma: 'COMPRIMIDO', receta: false,
  paraQue: 'Se utiliza para aliviar el dolor leve o moderado (como dolor de cabeza, muscular o de espalda) y para bajar la fiebre.',
  comoSeToma: 'Adultos: 1 comprimido cada 6 a 8 horas si lo necesitas. No tomes más de 3 comprimidos al día. Trágalo con un vaso de agua.',
  avisos: [
    'No superes la dosis recomendada: puede dañar el hígado.',
    'No lo tomes junto con otros medicamentos que también lleven paracetamol.',
    'Consulta a tu médico si tienes problemas de hígado o de riñón, o si bebes alcohol a diario.',
  ],
  conservacion: 'Guárdalo a temperatura ambiente, en su envase original y fuera del alcance de los niños.',
};

const MEDICINES: Record<string, DemoMedicineInfo> = {
  '65402': { ...PARACETAMOL_1G, nombre: 'PARACETAMOL KERN PHARMA 1 G COMPRIMIDOS EFG', laboratorio: 'KERN PHARMA, S.L.', cn: '712729', presentacion: 'Paracetamol Kern Pharma 1 g comprimidos EFG, 40 comprimidos' },
  '67296': { ...PARACETAMOL_1G, nombre: 'PARACETAMOL CINFA 1 G COMPRIMIDOS EFG', laboratorio: 'LABORATORIOS CINFA, S.A.', cn: '697169', presentacion: 'Paracetamol Cinfa 1 g comprimidos EFG, 40 comprimidos' },
  '69785': {
    ...PARACETAMOL_1G,
    nombre: 'PARACETAMOL NORMON 650 MG COMPRIMIDOS EFG', laboratorio: 'LABORATORIOS NORMON, S.A.', cantidad: '650', unidad: 'mg',
    cn: '664029', presentacion: 'Paracetamol Normon 650 mg comprimidos EFG, 40 comprimidos',
    comoSeToma: 'Adultos: 1 comprimido cada 4 a 6 horas si lo necesitas, sin superar la dosis máxima diaria que indica el prospecto. Trágalo con agua.',
  },
  '64005': {
    nombre: 'IBUPROFENO CINFA 600 MG COMPRIMIDOS RECUBIERTOS CON PELICULA EFG', laboratorio: 'LABORATORIOS CINFA, S.A.',
    principio: 'IBUPROFENO', cantidad: '600', unidad: 'mg', forma: 'COMPRIMIDO RECUBIERTO CON PELÍCULA', receta: true,
    cn: '653411', presentacion: 'Ibuprofeno Cinfa 600 mg comprimidos recubiertos con película EFG, 40 comprimidos',
    paraQue: 'Alivia el dolor y la inflamación (por ejemplo, de articulaciones o músculos) y baja la fiebre.',
    comoSeToma: 'Adultos: 1 comprimido cada 6 a 8 horas, preferiblemente con comida. No tomes más de 4 comprimidos al día.',
    avisos: [
      'Tómalo con alimentos para proteger el estómago.',
      'No lo uses si has tenido úlcera o sangrado de estómago.',
      'Consulta a tu médico si tienes la tensión alta, problemas de corazón o de riñón.',
      'No lo combines con otros antiinflamatorios.',
    ],
    conservacion: 'Guárdalo a temperatura ambiente, en su envase original y fuera del alcance de los niños.',
  },
  '63489': {
    nombre: 'OMEPRAZOL NORMON 20 MG CAPSULAS DURAS GASTRORRESISTENTES EFG', laboratorio: 'LABORATORIOS NORMON, S.A.',
    principio: 'OMEPRAZOL', cantidad: '20', unidad: 'mg', forma: 'CÁPSULA DURA GASTRORRESISTENTE', receta: true,
    cn: '656827', presentacion: 'Omeprazol Normon 20 mg cápsulas duras gastrorresistentes EFG, 28 cápsulas',
    paraQue: 'Reduce la cantidad de ácido del estómago. Se usa para el ardor, el reflujo y para proteger el estómago.',
    comoSeToma: 'Normalmente 1 cápsula al día, por la mañana antes del desayuno. Trágala entera con agua, sin masticarla.',
    avisos: [
      'No mastiques ni abras la cápsula.',
      'Consulta a tu médico si pierdes peso sin motivo, vomitas o notas sangre en las heces.',
      'Si lo tomas durante mucho tiempo, tu médico revisará el tratamiento.',
    ],
    conservacion: 'Guárdalo a temperatura ambiente, en su envase original y protegido de la humedad.',
  },
  '66121': {
    nombre: 'METFORMINA SANDOZ 850 MG COMPRIMIDOS RECUBIERTOS CON PELICULA EFG', laboratorio: 'SANDOZ FARMACÉUTICA, S.A.',
    principio: 'METFORMINA HIDROCLORURO', cantidad: '850', unidad: 'mg', forma: 'COMPRIMIDO RECUBIERTO CON PELÍCULA', receta: true,
    cn: '650838', presentacion: 'Metformina Sandoz 850 mg comprimidos recubiertos con película EFG, 50 comprimidos',
    paraQue: 'Ayuda a controlar el azúcar en sangre en personas con diabetes tipo 2.',
    comoSeToma: 'Tómalo con las comidas o justo después, como te haya indicado tu médico. Traga el comprimido con agua.',
    avisos: [
      'Avisa a tu médico antes de una prueba con contraste o de una operación.',
      'Consulta si tienes problemas de riñón o de hígado.',
      'Evita el alcohol en exceso.',
    ],
    conservacion: 'Guárdalo a temperatura ambiente, en su envase original.',
  },
};

/** Ficha con la forma de `medicine-detail`. */
export function demoDetail(id: string) {
  const m = MEDICINES[id];
  if (!m) {
    return {
      medicine: {
        id, nombre: 'MEDICAMENTO DE DEMOSTRACIÓN', laboratorio: null, principiosActivos: [], formaFarmaceutica: null,
        presentaciones: [], receta: false, comercializado: true, fotoUrl: null, source: source(id),
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
      fotoUrl: null,
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
    leafletUrl: `https://cima.aemps.es/cima/dochtml/p/${id}/P_${id}.html`,
    sheetUrl: `https://cima.aemps.es/cima/dochtml/ft/${id}/FT_${id}.html`,
  };
}

const daysAgo = (d: number, h: number, min: number) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - d, h, min).toISOString();
};

export const demoSavedMedications = [
  { id: 1, user_id: DEMO_USER_ID, nregistro: '65402', nombre: 'PARACETAMOL KERN PHARMA 1 G COMPRIMIDOS EFG', principio_activo: 'Paracetamol', presentacion: 'Comprimidos', favorito: true, created_at: daysAgo(7, 10, 12) },
  { id: 2, user_id: DEMO_USER_ID, nregistro: '64005', nombre: 'IBUPROFENO CINFA 600 MG COMPRIMIDOS RECUBIERTOS CON PELICULA EFG', principio_activo: 'Ibuprofeno', presentacion: 'Comprimidos recubiertos', favorito: false, created_at: daysAgo(9, 9, 0) },
  { id: 3, user_id: DEMO_USER_ID, nregistro: '63489', nombre: 'OMEPRAZOL NORMON 20 MG CAPSULAS DURAS GASTRORRESISTENTES EFG', principio_activo: 'Omeprazol', presentacion: 'Cápsulas', favorito: false, created_at: daysAgo(17, 18, 30) },
  { id: 4, user_id: DEMO_USER_ID, nregistro: '66121', nombre: 'METFORMINA SANDOZ 850 MG COMPRIMIDOS RECUBIERTOS CON PELICULA EFG', principio_activo: 'Metformina hidrocloruro', presentacion: 'Comprimidos', favorito: false, created_at: daysAgo(25, 8, 0) },
];

export const demoScans = () => [
  { id: 101, user_id: DEMO_USER_ID, nregistro: '65402', nombre: 'PARACETAMOL KERN PHARMA 1 G COMPRIMIDOS EFG', confidence: 'alta', created_at: daysAgo(0, 10, 12), status: 'identified', score: 0.97, method: 'barcode' },
  { id: 100, user_id: DEMO_USER_ID, nregistro: null, nombre: null, confidence: 'media', created_at: daysAgo(0, 9, 40), status: 'ambiguous', score: 0.71, method: 'ocr' },
  { id: 99, user_id: DEMO_USER_ID, nregistro: '64005', nombre: 'IBUPROFENO CINFA 600 MG COMPRIMIDOS RECUBIERTOS CON PELICULA EFG', confidence: 'alta', created_at: daysAgo(1, 18, 5), status: 'identified', score: 0.93, method: 'ocr' },
  { id: 98, user_id: DEMO_USER_ID, nregistro: null, nombre: null, confidence: null, created_at: daysAgo(5, 12, 0), status: 'not_found', score: null, method: 'ocr' },
  { id: 97, user_id: DEMO_USER_ID, nregistro: '63489', nombre: 'OMEPRAZOL NORMON 20 MG CAPSULAS DURAS GASTRORRESISTENTES EFG', confidence: 'alta', created_at: daysAgo(12, 8, 30), status: 'identified', score: 0.95, method: 'barcode' },
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
  included_scans: premium ? 100 : 5,
  free_scans_left: premium ? 98 : 3,
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
  plans: [
    { id: 'premium_monthly', name: 'MediClaro Premium', period: 'monthly', priceCents: 499, terms: ['IVA incluido.', 'Incluye 100 identificaciones al mes.'] },
    { id: 'premium_quarterly', name: 'MediClaro Premium', period: 'quarterly', priceCents: 1299, terms: ['IVA incluido.', 'Incluye 100 identificaciones al mes.'] },
    { id: 'premium_annual', name: 'MediClaro Premium', period: 'annual', priceCents: 3999, highlighted: true, terms: ['IVA incluido.', 'Incluye 100 identificaciones al mes.'] },
  ],
};

/** Refleja los valores reales de plan_config del backend. */
export const demoPlanConfig = [
  { plan: 'free', monthly_scans: 5, overage_enabled: false, hard_cap: 5, chat_per_day: 10 },
  { plan: 'premium', monthly_scans: 100, overage_enabled: true, hard_cap: 500, chat_per_day: 200 },
];

export const demoEmergencyConfig = {
  primaryAssistanceName: 'Central MediClaro (demo)',
  primaryAssistanceNumber: '+34900000000',
  countryEmergencyNumber: '112',
  regionOverrides: {},
};

export const demoChatReply = {
  reply: 'El paracetamol sirve para aliviar el dolor leve o moderado y para bajar la fiebre. En adultos se suele tomar 1 comprimido de 1 g cada 6 a 8 horas, sin pasar de 3 al día. Si tienes dudas, consulta a tu farmacéutico.',
  sourceUrl: 'https://cima.aemps.es/cima/dochtml/p/65402/P_65402.html',
};

export const demoChatEmergency = {
  emergency: true,
  resources: [
    { label: 'Emergencias', phone: '112' },
    { label: 'Instituto Nacional de Toxicología', phone: '915620420' },
    { label: 'Línea de atención a la conducta suicida', phone: '024' },
  ],
};
