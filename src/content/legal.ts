/**
 * Textos legales de MediClaro (Información legal). Se leen dentro de la app, completos y en letra pequeña.
 *
 * Redactados para España (RGPD, LOPDGDD, LSSI-CE y normativa de consumidores) y ajustados a cómo funciona de verdad
 * la app (qué se guarda, qué proveedores intervienen y qué se puede borrar). No son asesoramiento jurídico: conviene
 * que los revise un abogado antes de publicar. Los datos del titular (nombre o razón social, NIF, domicilio y correo)
 * los pone el propietario en la configuración (EXPO_PUBLIC_COMPANY_NAME, EXPO_PUBLIC_COMPANY_TAX_ID,
 * EXPO_PUBLIC_COMPANY_ADDRESS y EXPO_PUBLIC_SUPPORT_EMAIL): nunca se inventan.
 */

import { ASSISTANT_NAME } from '../config/assistant';

export type LegalSectionId = 'notice' | 'terms' | 'privacy' | 'medical' | 'sources' | 'ai' | 'emergency' | 'subscription';

/** Un bloque: subtítulo, párrafo o lista. */
export type LegalBlock = { h: string } | { p: string } | { list: string[] };

export interface LegalContext {
  company: { name: string; taxId: string; address: string };
  supportEmail: string;
  /** Se venden suscripciones en esta compilación. */
  purchases: boolean;
  /** Líneas de precios del catálogo real («Mensual: 4,99 € al mes (IVA incluido)»). */
  planLines: string[];
}

export const LEGAL_UPDATED = '9 de octubre de 2026';

function titular(ctx: LegalContext): string {
  return ctx.company.name ? ctx.company.name : 'el titular de MediClaro';
}

function contact(ctx: LegalContext): string {
  return ctx.supportEmail ? `escribiendo a ${ctx.supportEmail}` : 'por los medios de contacto indicados en este Aviso legal';
}

export function noticeBlocks(ctx: LegalContext): LegalBlock[] {
  const identity = [
    ctx.company.name ? `Titular: ${ctx.company.name}` : '',
    ctx.company.taxId ? `NIF: ${ctx.company.taxId}` : '',
    ctx.company.address ? `Domicilio: ${ctx.company.address}` : '',
    ctx.supportEmail ? `Correo de contacto: ${ctx.supportEmail}` : '',
  ].filter(Boolean);
  return [
    {
      p: 'En cumplimiento de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI-CE), estos son los datos del responsable de MediClaro:',
    },
    ...(identity.length ? [{ list: identity }] : []),
    { h: 'Objeto' },
    {
      p: 'MediClaro es una aplicación móvil que ayuda a consultar y entender la información oficial de los medicamentos autorizados en España, con un asistente que responde dudas, lectura en voz alta, avisos entre la persona usuaria y su cuidador/a y ayuda para llamar en una emergencia.',
    },
    { h: 'Condiciones de acceso' },
    {
      p: 'Usar MediClaro supone aceptar las Condiciones de uso y la Política de privacidad. Si no estás de acuerdo con ellas, no uses la aplicación.',
    },
    { h: 'Propiedad intelectual e industrial' },
    {
      p: `La aplicación, su diseño, su código, sus textos propios, ilustraciones, voces grabadas, marcas y logotipos pertenecen a ${titular(ctx)} o a quienes le han dado licencia. No se pueden copiar, modificar, distribuir ni usar con fines comerciales sin autorización escrita.`,
    },
    {
      p: 'La información de los medicamentos procede del Centro de Información online de Medicamentos (CIMA) de la Agencia Española de Medicamentos y Productos Sanitarios (AEMPS) y se muestra citando su origen. La AEMPS no participa en MediClaro ni lo respalda.',
    },
    { h: 'Responsabilidad y enlaces' },
    {
      p: 'Los límites de responsabilidad se explican en las Condiciones de uso. Los enlaces a sitios de terceros (por ejemplo, CIMA o la página segura de pago) se ofrecen para tu comodidad: esos sitios tienen sus propias condiciones y el titular no responde de su contenido ni de su disponibilidad.',
    },
    { h: 'Legislación aplicable' },
    {
      p: 'Este Aviso legal se rige por la ley española. Si eres consumidor/a, podrás acudir a los juzgados y tribunales de tu domicilio.',
    },
  ];
}

export function termsBlocks(ctx: LegalContext): LegalBlock[] {
  return [
    { h: '1. Qué es MediClaro' },
    {
      p: `MediClaro es un servicio de información sobre medicamentos prestado por ${titular(ctx)}. Ofrece la información oficial de los medicamentos explicada con palabras sencillas, un asistente (${ASSISTANT_NAME}), lectura en voz alta, la lista de tus medicamentos, avisos a tu cuidador/a y ayuda para llamar en una emergencia. Algunas funciones son de MediClaro Premium.`,
    },
    { h: '2. Aceptación y cambios' },
    {
      p: 'Al crear tu cuenta o usar la app aceptas estas condiciones. Podemos actualizarlas para mejorar el servicio o por cambios legales; te avisaremos en la app antes de que se apliquen los cambios importantes. Si no estás de acuerdo con la nueva versión, puedes dejar de usar MediClaro y eliminar tu cuenta en cualquier momento.',
    },
    { h: '3. Quién puede usarla' },
    {
      list: [
        'Debes ser mayor de edad.',
        'Si usas MediClaro para ayudar a otra persona (por ejemplo, como cuidador/a), necesitas su consentimiento o la autorización legal que corresponda.',
        'La cuenta es personal: no la compartas ni la uses en nombre de otra persona sin su permiso.',
      ],
    },
    { h: '4. Tu cuenta y su seguridad' },
    {
      p: 'Eres responsable de custodiar tu teléfono y el acceso a tu cuenta. Si crees que alguien la está usando sin permiso, cierra la sesión, cambia el acceso de tu teléfono y avísanos. Los datos que introduces (nombre, perfil de emergencia, medicamentos) deben ser ciertos y estar actualizados.',
    },
    { h: '5. Uso permitido' },
    {
      p: 'MediClaro es para uso personal y no comercial. No está permitido:',
    },
    {
      list: [
        'Usarla para fines ilegales o para causar daño a cualquier persona.',
        'Introducir datos de otras personas sin su permiso o suplantar a otra persona.',
        'Enviar mensajes ofensivos, falsos o que pongan en riesgo a alguien, también en el chat con tu cuidador/a o en el de los avisos.',
        'Copiar, descompilar o modificar la app, extraer datos de forma masiva o automatizada, o saltarse sus medidas de seguridad o de pago.',
        'Sobrecargar o interferir en el funcionamiento del servicio.',
      ],
    },
    { h: '6. La información de MediClaro no es consejo médico' },
    {
      list: [
        'MediClaro informa: no diagnostica, no receta, no recomienda tratamientos y no sustituye a tu médico ni a tu farmacéutico.',
        'Antes de empezar, dejar o cambiar un medicamento o su dosis, consulta siempre a un profesional sanitario.',
        'Comprueba siempre que el nombre de la caja coincide con el que muestra la app y lee el prospecto oficial. La identificación por foto puede equivocarse.',
        'MediClaro no revisa todas las interacciones, alergias ni situaciones personales. Avisa siempre a tu médico o farmacéutico de todo lo que tomas.',
        'En una urgencia, llama al 112. No esperes a una respuesta de la app.',
      ],
    },
    { h: '7. Inteligencia artificial' },
    {
      p: 'Los resúmenes sencillos, la lectura de fotos, el asistente y las voces usan inteligencia artificial. Sus respuestas se generan automáticamente y pueden contener errores u omisiones. Si algo no coincide, lo que vale es el prospecto o la ficha técnica oficial.',
    },
    { h: '8. Emergencias y cuidador/a' },
    {
      p: 'MediClaro no es un servicio de emergencias ni de teleasistencia y no vigila a nadie en tiempo real. Las condiciones de estas funciones se explican en el apartado «Emergencias, cuidador/a y ubicación».',
    },
    { h: '9. Premium y pagos' },
    {
      p: 'Las condiciones de MediClaro Premium (precios, renovación, Bizum, pago por un familiar, cancelación y desistimiento) están en «Condiciones de la suscripción». Las emergencias y el 112 son siempre gratis.',
    },
    { h: '10. Disponibilidad del servicio' },
    {
      p: 'Trabajamos para que MediClaro funcione siempre, pero puede haber interrupciones por mantenimiento, fallos técnicos, falta de cobertura o de batería, o problemas de servicios de terceros (por ejemplo, CIMA, proveedores de inteligencia artificial, de pago, de notificaciones o de llamadas). Podemos cambiar, mejorar o retirar funciones; si retiramos una función de pago, te lo comunicaremos y respetaremos tus derechos.',
    },
    { h: '11. Propiedad intelectual' },
    {
      p: 'Te damos una licencia personal, gratuita (salvo Premium), limitada, no exclusiva, intransferible y revocable para usar la app en tus dispositivos conforme a estas condiciones. Todo lo demás queda reservado.',
    },
    { h: '12. Responsabilidad' },
    {
      p: `En la medida máxima que permita la ley, ${titular(ctx)} no responde de los daños que se deriven de:`,
    },
    {
      list: [
        'Decisiones sobre tu salud o la de otras personas tomadas a partir de la información de la app, sin consultar a un profesional.',
        'Errores, retrasos u omisiones de la información oficial de terceros o de las respuestas generadas por inteligencia artificial.',
        'Una identificación de medicamento equivocada que no se haya comprobado con la caja y el prospecto.',
        'Avisos, notificaciones, mensajes o llamadas que no lleguen o lleguen tarde por causas ajenas (cobertura, batería, permisos del teléfono, ajustes del dispositivo o servicios de terceros).',
        'El uso de la app contrario a estas condiciones o a la ley.',
      ],
    },
    {
      p: 'Nada de lo anterior limita la responsabilidad que la ley no permite limitar, como la derivada de dolo o culpa grave, de los daños personales causados por negligencia, ni los derechos que te reconoce la normativa de consumidores.',
    },
    { h: '13. Baja y suspensión' },
    {
      p: 'Puedes eliminar tu cuenta cuando quieras desde Perfil › Datos de cuenta › Eliminar mi cuenta. Podemos suspender o cerrar una cuenta, avisando antes cuando sea posible, si hay un incumplimiento grave de estas condiciones, fraude o un riesgo para la seguridad de otras personas o del servicio.',
    },
    { h: '14. Ley aplicable y reclamaciones' },
    {
      p: `Estas condiciones se rigen por la ley española. Si eres consumidor/a, podrás reclamar ante los juzgados de tu domicilio y ante las autoridades de consumo. Antes, puedes contarnos el problema ${contact(ctx)}: intentaremos resolverlo cuanto antes.`,
    },
  ];
}

export function privacyBlocks(ctx: LegalContext): LegalBlock[] {
  return [
    { h: '1. Responsable' },
    {
      p: `El responsable del tratamiento es ${titular(ctx)}${ctx.company.taxId ? ` (NIF ${ctx.company.taxId})` : ''}${ctx.company.address ? `, con domicilio en ${ctx.company.address}` : ''}. Para cualquier cuestión sobre tus datos puedes contactar ${contact(ctx)}.`,
    },
    { h: '2. Qué datos tratamos' },
    {
      list: [
        'Cuenta: tu número de teléfono y un identificador interno.',
        'Perfil: tu nombre, sexo y edad; tu foto, si la añades; y tus ajustes (tamaño de letra, voces, Modo fácil).',
        'Medicamentos: los que guardas y el historial de tus identificaciones (qué medicamento y cuándo).',
        'Fotos de las cajas: las que envías para identificar un medicamento se usan solo para eso y no se guardan. Si tú eliges poner la foto de tu caja en «Mis pastillas» o en un medicamento guardado, se queda solo en tu teléfono (no se sube a ningún servidor).',
        '«Mis pastillas», si la usas: tus tratamientos (cantidad, horas, días y fechas que te indicó tu médico o farmacéutico), las tomas que confirmas u omites, sus correcciones, el estado de los avisos y sus ajustes. Tu cuidador/a solo los ve si tú lo permites.',
        `Conversaciones con ${ASSISTANT_NAME}: tus preguntas y sus respuestas se guardan en tu cuenta para que puedas seguirlas en cualquier móvil, hasta que las borres. Si activas su memoria, también lo que le cuentes de tu día a día (gustos, rutinas), nunca datos médicos.`,
        `Mensajes de voz a ${ASSISTANT_NAME}: el audio se envía para pasarlo a texto y no se guarda.`,
        'Perfil de emergencia, si lo creas: dirección, contacto de emergencia, grupo sanguíneo, alergias, enfermedades y medicamentos que tomas.',
        'Cuidador/a: las vinculaciones que aceptas, los avisos y el chat de cada aviso, y la ubicación durante un aviso si lo has permitido.',
        'Chat con tu cuidador/a (o con el familiar al que cuidas): los mensajes que os escribís, su hora y si se han leído. Solo los veis las dos personas vinculadas; los avisos del teléfono dicen quién ha escrito, nunca el texto.',
        'Llamadas de voz con tu cuidador/a: la voz va directamente de un móvil al otro, cifrada; MediClaro no la graba ni la guarda. Solo queda en vuestro chat el registro de la llamada (quién llamó, cuándo y cuánto duró).',
        'Premium de regalo: si el titular de MediClaro te regala Premium, se guarda tu número de teléfono (para activarlo cuando entres con él) y hasta cuándo dura.',
        'Pagos: el plan y el estado de tu suscripción. Los datos de la tarjeta, de Bizum, de la cuenta bancaria (domiciliación), de PayPal o de las tiendas los tratan Stripe, PayPal, Apple o Google: MediClaro nunca los ve.',
        'Datos técnicos mínimos para que el servicio funcione y sea seguro (por ejemplo, registros de acceso y de errores).',
      ],
    },
    {
      p: 'Parte de esta información (medicamentos, perfil de emergencia, preguntas sobre tu salud) son datos de salud, una categoría especial que tratamos con especial cuidado y solo con tu consentimiento explícito o cuando la ley lo permite.',
    },
    { h: '3. Para qué los usamos y con qué base legal' },
    {
      list: [
        'Prestarte el servicio que pides (cuenta, identificación, asistente, voces, lista de medicamentos, avisos y Premium): ejecución del contrato.',
        'Tratar tus datos de salud y enviar tus fotos y preguntas a la inteligencia artificial: tu consentimiento explícito, que te pedimos antes y puedes retirar cuando quieras en Perfil › Privacidad y datos.',
        'Compartir datos con tu cuidador/a o en una emergencia: lo que tú autorizas en «Qué compartir en una emergencia» y, si no puedes dar tu consentimiento, la protección de tu interés vital.',
        'Facturación y obligaciones fiscales: cumplimiento de obligaciones legales.',
        'Seguridad, prevención de fraudes y abusos y mejora técnica del servicio: interés legítimo.',
        'Gestionar el servicio desde el panel privado del titular (cuentas, planes y regalos de Premium): interés legítimo.',
      ],
    },
    {
      p: 'No vendemos tus datos, no hacemos publicidad, no creamos perfiles comerciales y no tomamos decisiones automatizadas que te afecten jurídicamente.',
    },
    { h: '4. Con quién se comparten' },
    {
      p: 'Solo con proveedores que nos prestan servicios, que actúan siguiendo nuestras instrucciones y con contrato de encargo de tratamiento:',
    },
    {
      list: [
        'Supabase: servidores, base de datos y acceso con tu teléfono.',
        'Google (Gemini): inteligencia artificial para leer las fotos, responder, resumir, pasar la voz a texto y generar las voces.',
        'Stripe: pagos con tarjeta, Bizum, domiciliación bancaria, PayPal y pagos de un familiar (PayPal trata además los datos de tu cuenta de PayPal). Apple y Google: compras dentro de la app.',
        'Twilio: llamadas y mensajes de emergencia; y el proveedor de SMS que envía el código de verificación.',
        'Expo, Apple y Google: envío de notificaciones (por ejemplo, los avisos a tu cuidador/a).',
        'El servidor de retransmisión de las llamadas de voz por internet entre paciente y cuidador/a, cuando se usan.',
      ],
    },
    {
      p: 'El titular de MediClaro, desde su panel privado (protegido con su teléfono, un código y Face ID), puede ver tu nombre, tu teléfono oculto (solo las últimas cifras), tu plan y cuántas veces has usado cada función. Nunca ve tus medicamentos, tus conversaciones, tu ubicación ni tus avisos de salud, y cada consulta queda registrada.',
    },
    {
      p: 'También verán tus datos, solo lo que tú decidas, las personas que vinculas como cuidador/a y los servicios de emergencia o de asistencia a los que llames. Las autoridades podrán recibirlos cuando la ley lo exija. A CIMA (AEMPS) solo se le pregunta por medicamentos, nunca por personas.',
    },
    {
      p: 'Si algún proveedor trata datos fuera del Espacio Económico Europeo, lo hace con las garantías del RGPD (decisiones de adecuación, como el Marco de Privacidad de Datos UE-EE. UU., o cláusulas contractuales tipo de la Comisión Europea).',
    },
    { h: '5. Cuánto tiempo los guardamos' },
    {
      list: [
        'Mientras tengas tu cuenta. Al eliminarla, se borran tus datos, salvo los que la ley obligue a conservar (por ejemplo, los de facturación, durante los plazos fiscales y mercantiles), que se guardan bloqueados.',
        `Las conversaciones con ${ASSISTANT_NAME}, hasta que las borres o elimines tu cuenta.`,
        '«Mis pastillas», hasta que la borres (Mis pastillas › Ajustes › «Borrar todos mis datos de medicación») o elimines tu cuenta.',
        'Las fotos que envías para identificar una caja y los mensajes de voz no se guardan. Google puede conservar lo que se le envía hasta 55 días solo para detectar abusos y no lo usa para mejorar sus productos.',
        'Los avisos al cuidador/a y su chat, el tiempo necesario para gestionarlos y por seguridad del servicio.',
        'El chat con tu cuidador/a, 90 días. Si se deshace la vinculación, deja de verse al momento y se borra en las 24 horas siguientes.',
      ],
    },
    { h: '6. Tus derechos' },
    {
      p: 'Puedes acceder a tus datos, rectificarlos, suprimirlos, oponerte o limitar su tratamiento, pedir su portabilidad y retirar tu consentimiento en cualquier momento (sin que afecte a lo hecho antes).',
    },
    {
      list: [
        'Desde la app: Perfil › Datos de cuenta (corregir datos, descargar tus datos y eliminar la cuenta) y Perfil › Privacidad y datos (permiso de inteligencia artificial, borrar tus conversaciones y qué compartir en una emergencia).',
        `O ${contact(ctx)}, indicando qué derecho quieres ejercer.`,
        'Si no estás conforme con nuestra respuesta, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).',
      ],
    },
    { h: '7. Seguridad' },
    {
      p: 'Las comunicaciones van cifradas, el acceso a los datos está restringido a cada cuenta y a las personas autorizadas, y aplicamos medidas técnicas y organizativas adecuadas. Si hubiera una brecha de seguridad que te afecte, te avisaremos y avisaremos a la autoridad cuando la ley lo exija.',
    },
    { h: '8. Menores' },
    {
      p: 'MediClaro no está dirigida a menores de edad. Si crees que un menor nos ha dado datos, avísanos y los borraremos.',
    },
    { h: '9. Cambios en esta política' },
    {
      p: 'Si cambiamos esta política de forma importante, te avisaremos en la app antes de aplicarla.',
    },
  ];
}

export function medicalBlocks(): LegalBlock[] {
  return [
    {
      p: 'MediClaro te muestra la información oficial de los medicamentos explicada de forma sencilla. Es información general: no tiene en cuenta tu situación personal.',
    },
    {
      list: [
        'No sustituye a tu médico ni a tu farmacéutico: consúltales antes de empezar, dejar o cambiar un tratamiento o su dosis.',
        'No diagnostica enfermedades ni recomienda tratamientos.',
        'Comprueba siempre el nombre de la caja y lee el prospecto oficial antes de tomar un medicamento.',
        'Si notas un efecto que te preocupa, consulta a un profesional. Puedes comunicar sospechas de efectos adversos en www.notificaRAM.es.',
        'En una urgencia, llama al 112. Ante una posible intoxicación, también puedes llamar al Servicio de Información Toxicológica: 91 562 04 20.',
      ],
    },
  ];
}

export function sourcesBlocks(): LegalBlock[] {
  return [
    {
      p: 'Los datos de los medicamentos proceden de CIMA, el Centro de Información online de Medicamentos de la AEMPS (Agencia Española de Medicamentos y Productos Sanitarios): es la información oficial y autorizada de cada medicamento en España.',
    },
    {
      list: [
        'La ficha de cada medicamento indica de dónde sale y cuándo se consultó, con enlaces al prospecto y a la ficha técnica oficiales.',
        'Los resúmenes con palabras sencillas se preparan a partir de esa información y pueden simplificarla: ante cualquier duda, vale el prospecto oficial.',
        'La AEMPS no participa en MediClaro ni lo respalda.',
      ],
    },
  ];
}

export function aiBlocks(): LegalBlock[] {
  return [
    {
      p: `Los resúmenes con palabras sencillas, la lectura de las fotos de las cajas, el asistente (${ASSISTANT_NAME}), los mensajes de voz y las voces naturales usan Gemini, la inteligencia artificial de Google.`,
    },
    {
      list: [
        'Sus respuestas pueden contener errores. Si algo no coincide, lo que vale es la ficha oficial del medicamento.',
        'Antes de enviar tu primera foto o tu primera pregunta te pedimos permiso. Puedes retirarlo cuando quieras en Perfil › Privacidad y datos.',
        `Solo se envía lo necesario: la foto, la pregunta o el texto que se va a leer y, para que ${ASSISTANT_NAME} te llame por tu nombre, el nombre de tu perfil. Nunca tu teléfono. Google no lo usa para mejorar sus productos y solo lo guarda hasta 55 días para evitar abusos.`,
        `MediClaro no guarda las fotos que envías para identificar ni los mensajes de voz (si eliges poner la foto de tu caja en «Mis pastillas», se queda solo en tu teléfono). Tus conversaciones con ${ASSISTANT_NAME} se guardan en tu cuenta hasta que las borres.`,
        `Si activas la memoria de ${ASSISTANT_NAME}, recordará solo detalles cotidianos que tú le cuentes (gustos, rutinas), nunca datos médicos. Puedes desactivarla cuando quieras.`,
      ],
    },
  ];
}

export function emergencyBlocks(): LegalBlock[] {
  return [
    {
      list: [
        'MediClaro no es un servicio de emergencias ni de teleasistencia y no vigila a nadie en tiempo real. En una urgencia, llama al 112.',
        'La app abre el teléfono para que tú llames: nunca llama sola. El 112 está siempre disponible y es gratis, con o sin Premium.',
        'El número privado de asistencia, si lo configuras, lo presta un tercero con sus propias condiciones y horarios.',
        'El cuidador/a es una persona que tú eliges y aceptas, no un profesional de MediClaro. Decide por sí mismo/a cómo actuar y si llama al 112.',
        'El chat con tu cuidador/a sirve para el día a día: no es un servicio de urgencias y nadie lo vigila. Si es urgente, llama al 112 o usa «Emergencia».',
        'Los avisos, notificaciones, mensajes y llamadas dependen de la cobertura, la batería, los permisos y ajustes del teléfono y de servicios de terceros: MediClaro no puede garantizar que lleguen ni que alguien los atienda.',
        'La ubicación solo se comparte durante un aviso o una emergencia, si lo has permitido, y puede no ser exacta.',
        'Lo que compartes en una emergencia lo decides tú en Perfil › Qué compartir en una emergencia. Mantén tu perfil de emergencia actualizado.',
        '«Probar la emergencia completa» es un simulacro: no avisa a nadie ni comparte nada.',
      ],
    },
  ];
}

export function subscriptionBlocks(ctx: LegalContext): LegalBlock[] {
  return [
    { p: 'MediClaro Premium es una suscripción. Planes y precios (IVA incluido):' },
    ctx.planLines.length ? { list: ctx.planLines } : { p: 'Los precios se muestran en la pantalla de Premium antes de pagar.' },
    { h: 'Cómo se paga' },
    {
      list: [
        'Con tu cuenta de Apple, con Google Play o con tarjeta (a través de Stripe), según elijas: se renueva sola.',
        'Con domiciliación bancaria SEPA o con PayPal (a través de Stripe), cuando estén disponibles: la misma suscripción, que se renueva sola. Con la domiciliación puedes pedir a tu banco la devolución de un recibo en las 8 semanas siguientes al cargo.',
        'Con Bizum (a través de Stripe): pagas el periodo elegido de una vez y NO se renueva solo. Al terminar vuelves al plan gratuito, salvo que pagues otro periodo; si lo pagas antes de que termine, se suma al final.',
        'Que pague un familiar o cuidador/a: le envías un enlace seguro y paga con tarjeta, Apple Pay o Google Pay. Solo verá tu nombre de pila y el plan, nunca tus datos de salud ni tus conversaciones. La suscripción se renueva sola y la gestiona y puede cancelarla esa persona desde el enlace de su correo de Stripe.',
        'MediClaro nunca ve ni guarda los datos de tu tarjeta, de tu cuenta bancaria ni de tu cuenta de PayPal.',
      ],
    },
    { h: 'Renovación y cancelación' },
    {
      list: [
        'Las suscripciones se renuevan solas al final de cada periodo por el mismo precio, salvo que se cancelen antes de la renovación (con Apple, al menos 24 horas antes). Sin permanencia.',
        'Para cancelar: Perfil › MediClaro Premium › Gestionar suscripción. Si la contrataste con Apple, también en Ajustes del iPhone › tu nombre › Suscripciones; con Google Play, en Google Play › Pagos y suscripciones.',
        'Al cancelar sigues teniendo Premium hasta el final del periodo pagado. Eliminar tu cuenta o borrar la app no cancela una suscripción de Apple o de Google Play.',
        'Si cambiamos el precio, te avisaremos antes y podrás cancelar sin coste antes de que se aplique.',
      ],
    },
    { h: 'Derecho de desistimiento y devoluciones' },
    {
      list: [
        `Si contratas con tarjeta, Bizum, domiciliación bancaria o PayPal, tienes 14 días naturales para desistir ${contact(ctx)}. Como Premium empieza a funcionar en cuanto pagas porque así lo pides, si desistes te devolveremos el importe descontando la parte proporcional del tiempo ya usado.`,
        'Las compras hechas con Apple o Google Play se reembolsan según sus condiciones: se piden a Apple o a Google.',
        'Si cambias de teléfono, entra con tu número («Ya soy Premium») o pulsa «Restaurar compra».',
      ],
    },
    { p: 'Las emergencias y el 112 son siempre gratis, con o sin Premium.' },
  ];
}
