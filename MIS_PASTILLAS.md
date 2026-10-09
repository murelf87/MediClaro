# «Mis pastillas» — documentación funcional y técnica

Versión candidata: **RC-2026-10-09** (app 1.0.1) · Fecha: 09/10/2026
Estado: **código terminado y probado en este entorno; pendiente de desplegar el backend y de probar en teléfonos reales** (ver §14 y §16).

---

## 1. Qué es (para la persona)

«Mis pastillas» ayuda a una persona mayor a **seguir la pauta que le indicó su médico o farmacéutico**:

- Apunta sus medicamentos con la cantidad, las horas, los días y hasta cuándo (o desde la foto de la caja).
- El teléfono **suena como una alarma a la hora de cada toma** (un «din-don» de unos 10 s pensado para personas mayores), también con la app cerrada y sin internet.
- Puede poner **la foto de su propia caja** para reconocerla de un vistazo (se guarda solo en su teléfono).
- En el aviso, tres botones grandes: **«Sí, ya la he tomado»**, **«Recordármelo después»** y **«Todavía no la he tomado»**.
- Ve de un vistazo lo de hoy con colores: **verde** tomada · **naranja** pendiente · **gris** más tarde · **rojo** sin confirmar, no tomada o posible toma doble.
- Puede preguntar al asistente **«¿Me he tomado las pastillas de hoy?»** o **«¿Qué me queda hoy?»** y le responde con **sus datos reales**.
- Tiene un **historial** (hoy, ayer, esta semana, este mes o fechas a elegir) que puede descargar o compartir con su médico.
- Si quiere, su **cuidador/a** puede ver sus tomas, confirmarlas por ella y recibir un aviso si no confirma una.

Es una función **Premium** (el servidor lo comprueba).

## 2. Reglas de seguridad (lo que la app NUNCA hace)

1. **Nunca dice que tome, repita, cambie o suspenda una dosis.** Solo informa de lo registrado. Probado: `ninguna respuesta indica tomar, repetir, cambiar o suspender una dosis`.
2. **Solo usa la pauta que la persona confirma** («Me la indicó mi médico o farmacéutico»): el servidor rechaza una pauta sin esa confirmación (`prescription_confirmed`).
3. **Un aviso entregado o abierto NO es una toma.** Solo cuenta la confirmación de la persona (o de su cuidador/a autorizado).
4. **Posible toma doble:** si una toma ya figura confirmada, la segunda se guarda como **toma adicional** con aviso claro: «Atención: esta toma ya figura confirmada a las HH:MM. No tomes otra dosis por si acaso…».
5. **Si no recuerda si la tomó** y no hay confirmación: respuesta prudente, sin decir que la repita.
6. **Nada se borra:** una corrección anula el registro con su motivo y deja constancia (quién, cuándo, por qué y el valor anterior).
7. **Privacidad en la pantalla bloqueada:** por defecto el aviso NO muestra el nombre del medicamento («Son las 14:00. Es la hora de tu medicamento.»). Se puede activar en Ajustes.
8. El aviso al cuidador/a **no incluye el nombre del medicamento** («María no ha confirmado la toma de las 14:00. Abre MediClaro para verlo.»).

## 3. Pantallas y recorridos

| Ruta | Pantalla | Qué hace |
|---|---|---|
| `/pills` | Mis pastillas | Próxima toma, lista de hoy con colores, semana, accesos a historial, ajustes y asistente. |
| `/pills/edit` | Añadir / cambiar pauta | Nombre (o desde la caja), concentración, **foto de tu caja** (hacer una foto, elegir de la galería o «Usar la foto que acabo de hacer» al venir de identificarla), cantidad, forma, horas, días (todos / algunos / cada X días), inicio y fin, instrucciones, avisos. Confirmación obligatoria de que la indicó un profesional. «Dejar de tomarlo» archiva y conserva el historial. |
| `/pills/reminder` | Aviso de la toma | Se abre al tocar el aviso (o solo, si llega con la app abierta: entonces suena la alarma y después se lee). Tres botones; «Me la tomé a otra hora» (hace 15 min / 30 min / 1 h); «No me la voy a tomar»; aviso de toma doble; variante «Todavía no es la hora». |
| `/pills/history` | Historial de tomas | Hoy, ayer, esta semana, este mes, fechas a elegir; resumen («18 de 19 tomas confirmadas · 2 requieren atención»); corregir (con motivo), registrar a posteriori; descargar/compartir. |
| `/pills/settings` | Avisos | Activar avisos, sonido, leer en voz alta, nombre en pantalla bloqueada, repetir a los N min, «Recordármelo después» N min, probar el aviso, permisos del cuidador/a, borrar todos mis datos de medicación. |
| `/pills/patient` | Pastillas de [familiar] | Vista del cuidador/a autorizado: tomas de la semana, incidencias y (si tiene permiso) «Confirmar que la ha tomado». |

Accesos: **Inicio** («Mis pastillas · Próxima: 14:00 · Ibuprofeno»), **Mis medicamentos**, el **resultado de la foto** («Añadir a Mis pastillas (avisos)»), la **ficha guardada** y **Mi cuidador/a**. Todas las pantallas tienen «Volver».

## 4. Avisos del teléfono

- **Notificaciones locales** (expo-notifications) programadas en el propio teléfono: suenan **con la app cerrada y sin internet**.
- **Sonido de alarma propio** `assets/sounds/mediclaro_alarma.wav` (creado con `node scripts/generate-alarm-sound.mjs`, sin derechos de terceros): «din-don» de campana en tonos medios (784 y 523 Hz, se oyen mejor con la edad) repetido 6 veces, 10 s. Se incluye en la app con el plugin de expo-notifications (`sounds`). En **Expo Go** no se pueden añadir sonidos: allí suena el tono normal del teléfono.
- **Con la app abierta**, el teléfono no pone su sonido ni un banner: se abre el aviso, suena la alarma y después se lee en voz alta (si está activado). Si la persona pulsa un botón, todo se calla.
- Si cambia cómo es el aviso (nombre en la pantalla bloqueada, sonido, repetición, dosis…), los avisos ya programados **se vuelven a programar** con el contenido nuevo (cada aviso lleva una huella de su contenido).
- Por cada toma: aviso principal a su hora y **repetición** a los N minutos si sigue sin confirmar (ajustable; 0 = no repetir). «Recordármelo después» sustituye los avisos de esa toma por uno a la hora aplazada.
- Se programan los **próximos 7 días, como mucho 60 avisos** (iOS admite 64 por app) y se **reprograman** al abrir la app, al confirmar, al cambiar la pauta o los ajustes, y al cambiar de zona horaria. Solo se tocan los avisos de «Mis pastillas» (prefijo `mediclaro-dose|`).
- **Android:** canal «Alarma de medicación» (`medication-alarm`, importancia máxima, vibración larga, sonido de alarma por el **canal de alarmas**: usa el volumen de alarma y suena con «No molestar» si las alarmas están permitidas) y canal sin sonido. El canal antiguo `medication-reminders` se borra. Permiso `POST_NOTIFICATIONS` (Android 13+) y `SCHEDULE_EXACT_ALARM` declarado: con él la alarma es exacta; si Android 14+ no lo concede, el aviso llega igualmente pero el sistema puede **retrasarlo unos minutos** (ahorro de batería).
- **iPhone:** permiso de notificaciones al activar los avisos; suena el mismo sonido de alarma (iOS admite hasta 30 s). Sin «Alertas críticas» (requiere permiso especial de Apple): con el modo silencio o «No molestar», iOS puede silenciar el aviso.
- **Voz:** con la app **abierta**, el aviso se lee en voz alta con la voz natural elegida (Sulafat o Achird; si falla, con la voz del teléfono). Con la app cerrada, iOS y Android **no permiten** que una app hable sola: suena la alarma.
- **Expo Go:** las notificaciones **locales** funcionan en Expo Go (iPhone y Android); las **push remotas** (aviso al cuidador) necesitan la app instalada (build de desarrollo o de tienda).

## 5. Asistente con datos reales

En el chat (y en la versión sin conexión) estas preguntas se responden **sin IA**, de forma determinista, con los registros de la persona:

- «¿Me he tomado las pastillas de hoy / de esta tarde?» → «Según tu historial, has confirmado que tomaste Omeprazol Normon 20 mg a las 08:39…»
- «¿Qué pastillas me quedan hoy?» / «¿Cuándo me toca la próxima?» → «Según tu pauta registrada, te queda una toma programada a las 21:00: Metformina…»
- «No recuerdo si me tomé la pastilla» sin confirmación → prudencia, nunca «repítela».
- Distingue confirmada por el cuidador/a, omitida, toma adicional y registro corregido. Sin datos: lo dice, no inventa.

Las demás dudas van a la IA, que solo recibe un **contexto breve** de la pauta cuando la pregunta es sobre «mis pastillas» y tiene prohibido indicar tomar, repetir, cambiar o suspender dosis. Lógica compartida servidor/app: `supabase/functions/_shared/medicationCore.ts`.

## 6. Cuidador/a

- Por defecto el cuidador/a vinculado **no ve nada**. El paciente decide en Ajustes: **ver mis tomas**, **confirmar tomas por mí** (requiere ver) y **avisarle si no confirmo una toma** tras 30/60/90/120/180 min (requiere ver).
- Cada confirmación del cuidador/a queda **a su nombre** («Confirmada por Javier»).
- Avisos de tomas sin confirmar: `pg_cron` cada 10 min encola (`medication_alert_jobs`), el disparador despierta `caregiver-dispatch`, que envía el push **sin el nombre del medicamento**. Si las tablas aún no están desplegadas, `caregiver-dispatch` sigue funcionando como antes.

## 7. Arquitectura

```
Pantallas (src/screens/pills/*)  ──>  hooks (usePillPlan, usePatientPlan, useNow, usePillState, useReminderVoice)
        │                                   │
        └──────────────>  MedicationPlanService (src/services/MedicationPlanService.ts)
                               ├─ planStore.ts      datos: copia cifrada + cola + RPC medication_*
                               ├─ reminderPlan.ts   qué avisos programar (puro, probado)
                               └─ notifications.ts  expo-notifications (canales, permisos, programar)
Lógica de dominio pura (horas, colores, toma doble, respuestas): supabase/functions/_shared/medicationCore.ts
   ↳ la usan la app (src/domain/medication.ts) y el servidor (chat, medicationData.ts)
Servidor: supabase/migrations/20261009120000_medication_plans.sql + chat + caregiver-dispatch
```

Los componentes no conocen Supabase ni expo-notifications: solo llaman a los servicios.

## 8. Base de datos (migración `20261009120000_medication_plans.sql`)

Aditiva e idempotente (no cambia nada existente). RLS en todas las tablas. **La app solo puede LEER** (lo suyo o lo que el paciente le permite ver, `medication_viewer_can_see`); **todas las escrituras** pasan por funciones `security definer` que comprueban usuario, permisos, Premium y límite de peticiones (`hit_rate_limit`).

| Tabla | Contenido |
|---|---|
| `medication_treatments` | Tratamiento y pauta (cantidad, forma, frecuencia, días, cada N días, inicio/fin, instrucciones, zona IANA, versión, `last_mutation_id`, confirmación de prescripción). |
| `medication_schedule_times` | Horas de reloj local de cada tratamiento. |
| `medication_dose_events` | Tomas `taken` / `skipped` / `extra`. Nunca se editan ni borran: se anulan (`voided`). Índice único: **una sola resolución activa por toma programada**. |
| `medication_dose_corrections` | Trazabilidad de cada corrección (acción, motivo, valor anterior, quién). |
| `medication_reminder_events` | Estado de los avisos (entregado, abierto, aplazado, «todavía no»). No son tomas. |
| `medication_reminder_settings` | Ajustes de avisos (sincronizados entre teléfonos). |
| `medication_care_permissions` | Permisos de cada cuidador/a (por vínculo `care_links`). |
| `medication_alert_jobs` | Cola de avisos push al cuidador/a (solo servidor). |

Funciones (RPC): `medication_save_treatment`, `medication_record_dose`, `medication_correct_dose`, `medication_log_reminders`, `medication_save_settings`, `medication_set_care_permissions`, `medication_get_plan`, `medication_delete_all`, y para el servidor `medication_claim_alert_jobs` + `mediclaro_private.medication_enqueue_missed_alerts` (cron `mediclaro-medication-missed-doses`, cada 10 min).

Errores con código (`AUTH_REQUIRED`, `PREMIUM_REQUIRED`, `NOT_ALLOWED`, `RATE_LIMIT`, `INVALID_*`, `ALREADY_TAKEN`…) que la app traduce a mensajes sencillos.

## 9. Idempotencia, conflictos y correcciones

- **Identificadores creados en el teléfono** (UUID) para tratamientos, tomas, correcciones y cada cambio (`mutationId`): reenviar tras perder la respuesta **devuelve el mismo registro** (`replayed`), nunca duplica.
- **Dos teléfonos editan la misma pauta:** se envía la versión esperada; si el servidor ya tiene otra, **gana el servidor** y la app lo explica («se había cambiado desde otro dispositivo…»).
- **Dos confirmaciones de la misma toma** (dos teléfonos o persona + cuidador/a): la primera es la toma; la segunda queda como **toma adicional / posible toma doble** (incidencia visible en rojo). Nunca se pierde.
- **Omitida y luego tomada:** la omisión se anula con trazabilidad y queda la toma.
- **Registrar a posteriori:** se guarda la hora declarada (`taken_at`) y la hora en que se anotó (`client_recorded_at`); el historial muestra ambas. No se aceptan horas futuras ni de hace más de 7 días.
- **Corregir:** «No me la tomé» o «Corregir la hora», siempre con motivo (mín. 3 caracteres).

## 10. Horas, zonas y cambios de hora

- Las horas de la pauta son **hora de reloj** («08:30») con la **zona IANA** de la persona; los instantes se guardan en **UTC** (`timestamptz`).
- **Primavera** (p. ej. 28/03/2027, 02:00→03:00): una toma de las 02:30 suena **una vez, a las 03:30** (hora válida siguiente, como `Temporal` «compatible»).
- **Otoño** (25/10/2026, 02:00–03:00 se repite): se avisa **la primera vez, una sola vez**.
- El día del cambio hay **exactamente** las tomas de la pauta. Viaje Madrid → Canarias: misma hora de reloj, otro instante; los avisos se reprograman al detectar el cambio de zona.

## 11. Sin conexión

- Copia **cifrada** de la pauta y las tomas en el teléfono (llavero de iOS / Keystore de Android, `secureLocalStore`) y **cola** de cambios.
- Lo que se confirma sin internet **se ve al momento**, sobrevive a cerrar la app y **se envía una sola vez** al volver la conexión; después se relee todo del servidor (fuente de verdad).
- Un cambio rechazado por el servidor (no por la red) se descarta y se explica. Los avisos siguen sonando sin internet.
- Al **cerrar sesión** o eliminar la cuenta se cancelan los avisos programados y se borran del teléfono la copia de la pauta y las fotos propias de las cajas (al volver a entrar se descargan y se programan otra vez).

## 12. Privacidad y RGPD

- Datos de salud (categoría especial, art. 9 RGPD): base jurídica = **consentimiento explícito** de la persona al usar la función; minimización (sin diagnósticos, solo la pauta y las tomas); acceso del cuidador/a **solo con permiso expreso** y revocable.
- **Derecho de supresión:** «Borrar todos mis datos de medicación» (`medication_delete_all`) y el borrado de cuenta (cascada).
- **Portabilidad:** descarga del historial de tomas (CSV) y «Descargar mis datos» (Perfil), que ahora incluye la medicación de los últimos 13 meses (tratamientos, tomas, correcciones y ajustes).
- Pantalla bloqueada sin nombre del medicamento por defecto; push al cuidador/a sin nombre del medicamento; la IA no recibe la pauta salvo en preguntas sobre «mis pastillas».
- **Fotos de las cajas:** la foto enviada para identificar no se guarda por sí sola. Solo si la persona lo elige («Foto de tu caja» en la pauta o en un medicamento guardado), se guarda **en su teléfono** (640 px), nunca en el servidor; el cuidador/a no la ve. La política de privacidad (`src/content/legal.ts`) ya lo explica.
- **Pendiente legal (propietario):** añadir «Mis pastillas» al registro de actividades y a la política de privacidad (finalidad, conservación, cuidador/a), y revisar con su asesor/a si hace falta una EIPD (evaluación de impacto) por tratar datos de salud de personas mayores.

## 13. Pruebas y resultados (09/10/2026)

| Prueba | Comando | Resultado |
|---|---|---|
| Tipos | `npx tsc --noEmit` | 0 errores |
| App completa | `npx jest` | **45 suites / 484 tests OK** (09/10 tarde, con el chat, las llamadas y el panel del propietario) |
| Lógica de dominio | `npx jest src/services/__tests__/medicationCore.test.ts` | 24 OK (calendario, Madrid/Canarias/Nueva York, cambios de hora, colores, toma doble, respuestas, «nunca indica dosis») |
| Datos y sin conexión | `npx jest src/services/__tests__/pillsPlan.test.ts` | 12 OK (offline + reinicio, idempotencia, toma doble, conflicto de versión, correcciones, cuidador/a, Premium, cierre de sesión, exportación) |
| Avisos | `npx jest src/services/__tests__/pillsReminders.test.ts` | 9 OK (repetición, aplazar, privacidad, cambio de hora, máx. 60, sincronizar, reprogramar si cambia el aviso) |
| Migración SQL | `node backend-patches/tests/sql/medication_plans.test.mjs supabase/migrations/20261009120000_medication_plans.sql` (PGlite) | `MIGRACION_MIS_PASTILLAS=OK` |
| Funciones del servidor | `deno test` con `backend-patches/tests/functions/medication.test.ts` (+ pagos y chat) | 21 OK |
| Comprobación de release | `node scripts/release-check.mjs` | FALLOS=0 (3 pendientes de configuración externa) |
| Bundles nativos | `npx expo export --platform ios --platform android` | iOS 6,2 MB · Android 6,5 MB, sin errores |
| Vista previa (navegador) | Playwright sobre la vista previa | Aviso a su hora con voz y 3 botones; aplazar; confirmación «toma confirmada a las 11:39»; doble toma; asistente con la pauta real; historial; cuidador/a; sin errores de página |

**No probado aquí (requiere teléfono):** avisos con la app cerrada y tras reiniciar el teléfono, modo silencio/No molestar, Android 14 sin alarmas exactas, push real al cuidador/a.

## 14. Despliegue (lo hace el propietario)

1. Aplicar migraciones: `npx supabase db push` (incluye `20261009100000_*` de pagos y `20261009120000_medication_plans.sql`). Requiere `pg_cron` activado (ya se usa en el proyecto).
2. Desplegar funciones (una a una): `npx supabase functions deploy chat`, `… caregiver-dispatch`, `… tts`, `… tts-preview`, `… create-checkout`, `… stripe-webhook` y `npx supabase functions deploy family-pay --no-verify-jwt`.
3. Nueva build (EAS) para tener el sonido de alarma, el permiso `SCHEDULE_EXACT_ALARM` en Android y los avisos en iPhone.
4. Probar con la lista del §15 en un iPhone y un Android reales.

## 15. Probar en iPhone y Android

Con Expo Go (avisos locales) o, mejor, con una build de desarrollo:

1. Inicia sesión con una cuenta Premium → Inicio → **Mis pastillas** → «Añadir un medicamento» (pon una hora 2 minutos más tarde).
2. Acepta el permiso de notificaciones. **Cierra la app** y bloquea el teléfono: debe sonar la **alarma** a su hora (en Expo Go, el tono normal) y el aviso no debe mostrar el nombre del medicamento.
   Con la app **abierta**: se abre el aviso solo, suena la alarma y después se lee en voz alta.
3. Toca el aviso: se abre «Aviso de tu medicamento» → «Sí, ya la he tomado» → debe quedar en verde con la hora.
4. Vuelve a abrir esa toma → «He tomado otra dosis» → debe avisar de posible toma doble.
5. Pon otra toma, deja que suene y **no** contestes: debe repetirse a los 30 min (o lo que elijas).
6. **Modo avión**: confirma una toma, cierra y abre la app (sigue en verde), quita el modo avión (se envía sola).
7. Pregunta al asistente: «¿Me he tomado las pastillas de hoy?».
8. Con un cuidador/a vinculado: activa «Puede ver mis tomas» y comprueba la vista «Pastillas de…».
9. Android: reinicia el teléfono y comprueba que el siguiente aviso suena.
10. En «Cambiar la pauta» → «Foto de tu caja», haz una foto: debe verse en la lista y en el aviso.
11. Ajustes → «Mostrar el nombre del medicamento»: el siguiente aviso ya debe llevar el nombre (se reprograman solos).

## 16. Pendientes y límites conocidos

- **Pendiente de despliegue:** sin la migración, «Mis pastillas» muestra un error claro (la app no se rompe).
- **Pruebas físicas** del §15 (notificaciones reales, reinicio, silencio, batería).
- **Android 14+:** sin el permiso de alarmas exactas el aviso puede retrasarse unos minutos.
- **iPhone:** sin Alertas críticas, el modo silencio/No molestar puede silenciar el aviso.
- **Expo Go:** suena el tono normal (el sonido de alarma propio necesita la app instalada).
- **Fotos propias:** solo en el teléfono donde se hacen (no pasan a otro móvil ni al cuidador/a).
- **Voz con la app cerrada:** no es posible (limitación de iOS/Android).
- **Push al cuidador/a:** requiere build instalada (no Expo Go) y el despliegue de `caregiver-dispatch`.
- **Legal:** actualizar la política de privacidad y el registro de actividades (§12).

## 17. Identificador de la versión candidata

`RC-2026-10-09` · app 1.0.1 · Expo SDK 57 · migraciones hasta `20261009120000_medication_plans.sql`.
