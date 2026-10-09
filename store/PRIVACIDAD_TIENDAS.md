# MediClaro — Privacidad en las tiendas

**App Store «App Privacy» (etiqueta de privacidad) y Google Play «Seguridad de los datos»**

> Kit de tiendas · español de España · preparado el 28-sep-2026.  
> Fuente de verdad: `COMMERCIAL_BRIEF.md`. Definiciones: Apple «App Privacy Details on the App Store» y Google Play
> «Provide information for Google Play's Data safety section», más la guía de Google sobre eliminación de cuentas.  
> **v1.2 (28-sep-2026) — situación que se declara:** versiones de tienda **con la suscripción MediClaro Premium por compra
> integrada** (Apple / Google Play). La tarjeta con Stripe solo se ofrece si el titular activa los permisos de pago
> alternativo de la UE (no en el perfil `production` actual). Cambios respecto a la 1.1: A25 / G13 (historial de compras) y
> las notas de pagos y de cuenta sin teléfono.

---

## 0. Reglas oficiales que deciden las respuestas

| Concepto | Apple | Google Play |
|---|---|---|
| **Recoger** | Enviar datos fuera del dispositivo de forma que tú o tus socios podáis acceder a ellos **más tiempo del necesario para atender la petición en tiempo real**. Lo que solo se procesa en el dispositivo no se recoge. | Transmitir datos fuera del dispositivo. No se declara lo que solo se trata en el dispositivo ni el **tratamiento efímero** (solo en memoria y durante la petición). |
| **Vinculado / compartir** | Apple pregunta si cada dato está **vinculado a la identidad**. No lo está si se quitan los identificadores directos (ID de usuario, nombre…) antes de recogerlo y nadie intenta volver a vincularlo. Apple añade que los «datos personales» según la ley se consideran vinculados. | Google pregunta si se **comparte** con terceros. No es «compartir»: enviar a **proveedores de servicios** que tratan los datos por cuenta del desarrollador; transferencias **iniciadas por la persona** o con divulgación destacada y consentimiento; fines legales; datos anonimizados. |
| **Rastreo** | Vincular datos de la app con datos de terceros para publicidad, o compartirlos con intermediarios de datos. | (No existe esta pregunta.) |
| **SDK** | Cuentan los datos que recogen los socios y SDK. | Cuentan los datos que envían las librerías y SDK. |

### Hechos del brief que deciden cada respuesta

| Dato | Qué pasa (brief) | Consecuencia |
|---|---|---|
| Fotos de la caja | Se reducen en el móvil (1280 px, JPEG, sin EXIF), van al servidor de MediClaro y de ahí a Google Gemini API. **MediClaro no las guarda**. El servidor **no envía a Google el nombre ni el teléfono**. **Google conserva registros 55 días** solo para detectar abusos; en el EEE no los usa para mejorar sus productos. | **Se recogen** (Google las conserva más allá de la petición) pero **no vinculadas** (sin identificadores). En Google: **no compartidas** (Google actúa como proveedor del servicio y además hay permiso explícito). |
| Preguntas al asistente | Máx. 10 últimos mensajes de 1000 caracteres, al servidor y a Gemini con el prospecto oficial. MediClaro **no guarda el contenido**; solo cuenta cuántas preguntas se hacen al día. | Igual que las fotos: recogidas, no vinculadas, no compartidas. El recuento diario sí está vinculado a la cuenta. |
| Últimas preguntas en el teléfono | Cifradas unos minutos (máx. 10) para incluirlas en una emergencia si la persona lo permite; luego se borran. | Solo en el dispositivo: **no se declara**. |
| Ubicación | Solo durante una emergencia activa y con permiso del sistema; se usa en el teléfono; **no se envía a los servidores**. La persona decide si la comparte (enviando el SMS o leyendo el mensaje). | **No se recoge.** Si la persona la envía por SMS, lo hace ella desde su app de mensajes (acción iniciada por la persona). |
| Servicio privado de asistencia y médico de cabecera | Solo en el teléfono, cifrados. | **No se declara.** |
| Perfil de emergencia | Opcional, con consentimiento expreso; en el servidor (solo accesible por la propia persona) y copia cifrada en el teléfono. | **Se recoge y está vinculado** (nombre, fecha de nacimiento, dirección, grupo sanguíneo, alergias, enfermedades, medicación habitual, contacto de emergencia). |
| Historial y «Mis medicamentos» | En el servidor hasta que se borra la cuenta. | Se recogen, vinculados. |
| Teléfono de acceso, ID interno, nombre para mostrar, preferencias | En el servidor (Supabase). El SMS lo envía un proveedor contratado [PENDIENTE: proveedor de SMS, p. ej. Twilio]. | Se recogen, vinculados; el proveedor de SMS es un proveedor de servicios (no es «compartir»). |
| Consentimiento para la IA | Se registra con fecha. | Se recoge, vinculado. |
| Métricas internas | Recuentos de uso y costes, errores; sin contenido médico. | Se recogen (uso y diagnóstico). |
| Pagos | Premium se paga con la **compra integrada de Apple o Google Play**: los datos de pago los recoge la tienda y MediClaro nunca los ve. Para activar Premium, la app envía al servidor de MediClaro el **comprobante de la compra** (producto, identificador de la transacción y token de la tienda), que se guarda **con la cuenta**. Si se ofrece la tarjeta, la escribe la persona en la página segura de Stripe (MediClaro tampoco la ve). | **Historial de compras: se recoge, vinculado** (funcionalidad de la app). **Información de pago: no** (la recoge el servicio de pago directamente). |
| Cuenta sin teléfono (v1.2) | Si alguien paga sin haber entrado, se crea una cuenta **sin datos personales** (solo un identificador interno); el teléfono se añade después, si la persona quiere. | Se recoge el ID de usuario (ya declarado). El teléfono pasa a ser **opcional**. |
| Seguridad | HTTPS; llavero (iOS) / Keystore (Android); seguridad por filas; claves solo en el servidor. | Cifrado en tránsito: **Sí**. |
| Eliminación | «Eliminar mi cuenta» en la app, en 2 pasos; borra todo en cascada. Las compras quedan registradas en Apple, Google o Stripe (obligaciones fiscales) y la suscripción de la tienda se cancela desde la tienda. | Eliminación a petición: **Sí**. |

---

## 1. Apple — «App Privacy» (App Store Connect)

### 1.1 Respuestas generales

| Pregunta | Respuesta |
|---|---|
| ¿Tú o tus socios recogéis datos de esta app? | **Sí** |
| ¿Se usa algún dato para rastrear (tracking)? | **No.** No hay publicidad, ni SDK de publicidad o analítica de terceros, ni cesión a intermediarios de datos. No hace falta pedir permiso de rastreo (ATT). |
| URL de la política de privacidad | `[PENDIENTE: URL de la política de privacidad]` |

### 1.2 Tabla por tipo de dato (todas las categorías oficiales de Apple)

Finalidades oficiales de Apple: *Third-Party Advertising* (publicidad de terceros), *Developer's Advertising or
Marketing* (publicidad o marketing propio), *Analytics* (analítica), *Product Personalization* (personalización),
*App Functionality* (funcionalidad de la app: autenticar, activar funciones, prevenir fraude, seguridad, mantener el
servicio…) y *Other Purposes* (otras).

| # | Categoría | Tipo de dato (Apple) | ¿Se recoge? | ¿Vinculado a la identidad? | ¿Rastreo? | Finalidades | Justificación (hechos del brief) |
|---|---|---|---|---|---|---|---|
| A1 | Contact Info | Name (nombre) | **Sí** | **Sí** | No | App Functionality | Nombre para mostrar (opcional) y nombre del perfil de emergencia (opcional), guardados en el servidor con la cuenta. |
| A2 | Contact Info | Email Address | No | — | — | — | El acceso es con móvil y código SMS; no se pide correo. |
| A3 | Contact Info | Phone Number (número de teléfono) | **Sí** | **Sí** | No | App Functionality | Acceso con número de móvil y código SMS (Supabase Auth; el SMS lo envía el proveedor contratado). |
| A4 | Contact Info | Physical Address (dirección física) | **Sí** | **Sí** | No | App Functionality | Dirección del perfil de emergencia (opcional), en el servidor. |
| A5 | Contact Info | Other User Contact Info | No | — | — | — | No hay otros datos de contacto de la persona usuaria. |
| A6 | Health & Fitness | Health (salud) | **Sí** | **Sí** | No | App Functionality | Perfil de emergencia (grupo sanguíneo, alergias, enfermedades, medicación habitual) y «Mis medicamentos», en el servidor. Las preguntas al asistente también pueden contener datos de salud. |
| A7 | Health & Fitness | Fitness | No | — | — | — | No hay datos de ejercicio ni de actividad física. |
| A8 | Financial Info | Payment Info | No | — | — | — | El pago se introduce en la hoja de Apple (o en la página segura de Stripe) y MediClaro nunca accede a él: según Apple, **no se recoge** («the payment information is entered outside your app, and you as the developer never have access to the payment information»). |
| A9 | Financial Info | Credit Info | No | — | — | — | — |
| A10 | Financial Info | Other Financial Info | No | — | — | — | — |
| A11 | Location | Precise Location | No | — | — | — | Solo se usa en el teléfono durante una emergencia; no se envía a los servidores. |
| A12 | Location | Coarse Location | No | — | — | — | Ídem. |
| A13 | Sensitive Info | Sensitive Info | No | — | — | — | La app no pide origen étnico, orientación sexual, religión, datos biométricos, etc. (ver duda 4 sobre texto libre). |
| A14 | Contacts | Contacts (contactos) | **Sí** | **Sí** | No | App Functionality | Contacto de emergencia (nombre y teléfono) del perfil de emergencia, en el servidor. La app no lee la agenda; se declara por prudencia (ver duda 3). |
| A15 | User Content | Emails or Text Messages | No | — | — | — | El SMS para un familiar lo envía la persona desde su app de mensajes; MediClaro no lo recibe. |
| A16 | User Content | Photos or Videos (fotos o vídeos) | **Sí** | **No** | No | App Functionality | Fotos de la caja: van sin EXIF al servidor y a Google Gemini para leer el envase; MediClaro no las guarda, pero Google conserva registros 55 días para detectar abusos → **recogidas**. El servidor no envía nombre, teléfono ni identificadores → **no vinculadas** (ver duda 1). |
| A17 | User Content | Audio Data | No | — | — | — | La lectura en voz alta usa la voz del teléfono; la app no graba audio. |
| A18 | User Content | Gameplay Content | No | — | — | — | — |
| A19 | User Content | Customer Support | No | — | — | — | No hay formulario de soporte dentro de la app (ver duda 7). |
| A20 | User Content | Other User Content (otro contenido) | **Sí** | **No** | No | App Functionality | Preguntas al asistente: van al servidor y a Gemini; MediClaro no guarda el contenido; Google conserva registros 55 días → recogidas, no vinculadas (ver duda 1). |
| A21 | Browsing History | Browsing History | No | — | — | — | Los enlaces oficiales (prospecto, ficha técnica) se abren en el navegador del sistema; la app no registra la navegación. |
| A22 | Search History | Search History (historial de búsqueda) | **Sí** | **Sí** | No | App Functionality | Historial de identificaciones: nombre del medicamento, n.º de registro, resultado, fecha y método; en el servidor hasta que se borra la cuenta (ver duda 2). |
| A23 | Identifiers | User ID (ID de usuario) | **Sí** | **Sí** | No | App Functionality | Identificador interno de usuario (Supabase). |
| A24 | Identifiers | Device ID | No | — | — | — | No se usa identificador publicitario ni otro identificador del dispositivo. |
| A25 | Purchases | Purchase History (historial de compras) | **Sí** | **Sí** | No | App Functionality | Comprobante de la suscripción (producto, transacción, estado y fechas) guardado con la cuenta para activar Premium, restaurarlo y gestionar renovaciones y reembolsos. |
| A26 | Usage Data | Product Interaction (interacción con el producto) | **Sí** | **Sí** | No | App Functionality, Analytics | Recuento de identificaciones al mes y de preguntas al día por cuenta para aplicar los límites; métricas internas de uso y costes, sin contenido médico. |
| A27 | Usage Data | Advertising Data | No | — | — | — | No hay publicidad. |
| A28 | Usage Data | Other Usage Data | No | — | — | — | Cubierto por A26. |
| A29 | Diagnostics | Crash Data | No | — | — | — | La app no incluye un SDK de informes de fallos. |
| A30 | Diagnostics | Performance Data | No | — | — | — | — |
| A31 | Diagnostics | Other Diagnostic Data (otros datos de diagnóstico) | **Sí** | **Sí** | No | App Functionality | Métricas internas de errores asociadas a la cuenta, sin contenido médico (ver duda 5). |
| A32 | Surroundings | Environment Scanning | No | — | — | — | La cámara solo hace la foto de la caja que la persona decide enviar (declarada en A16). |
| A33 | Body | Hands | No | — | — | — | — |
| A34 | Body | Head | No | — | — | — | — |
| A35 | Other Data | Other Data Types (otros datos) | **Sí** | **Sí** | No | App Functionality | Fecha de nacimiento (perfil de emergencia, opcional), preferencias (tamaño de texto, Modo fácil, velocidad de voz) y registro con fecha del consentimiento para la IA. |

Notas para rellenar el formulario:

- Apple pide **una sola respuesta de vinculación por tipo de dato**. Por eso «Health» va como vinculado: aunque las
  preguntas al asistente (no vinculadas) puedan contener datos de salud, el perfil de emergencia y «Mis medicamentos» sí
  están vinculados.
- **Tracking: No** en todas las filas.
- No se declaran porque se quedan en el teléfono: ubicación, servicio privado de asistencia, médico de cabecera y las
  últimas preguntas guardadas unos minutos para una emergencia.

### 1.3 Cómo quedará la etiqueta en la ficha

| Bloque de la etiqueta | Contenido |
|---|---|
| Datos usados para rastrearte | Ninguno |
| Datos vinculados a ti | Salud y forma física (Salud) · Información de contacto (Nombre, Teléfono, Dirección física) · Contactos · Historial de búsqueda · Identificadores (ID de usuario) · Datos de uso (Interacción con el producto) · Diagnóstico (Otros datos de diagnóstico) · Otros datos |
| Datos no vinculados a ti | Contenido del usuario (Fotos o vídeos, Otro contenido del usuario) |

---

## 2. Google Play — «Seguridad de los datos» (Play Console → Contenido de la aplicación)

### 2.1 Respuestas generales

| Pregunta | Respuesta |
|---|---|
| ¿Tu app recoge o comparte alguno de los tipos de datos de usuario obligatorios? | **Sí** |
| ¿Se cifran en tránsito todos los datos de usuario que recoge la app? | **Sí** (HTTPS). |
| ¿Ofreces una forma de que los usuarios soliciten la eliminación de sus datos? | **Sí.** En la app: Perfil → Privacidad y datos → Eliminar mi cuenta (2 pasos; borra los datos en cascada y cancela la suscripción si la hubiera). |
| Creación de cuenta | La app permite crear cuenta con **número de móvil y código SMS, sin contraseña**. Elegir en el formulario la opción que corresponda a ese método. |
| URL web para solicitar la eliminación de la cuenta (obligatoria si hay cuentas) | `[PENDIENTE: URL web para solicitar la eliminación de la cuenta y los datos]`. Google exige, además del camino dentro de la app, una página web que funcione, que nombre la app o al desarrollador tal como aparecen en la ficha y que permita pedir el borrado sin reinstalar la app. |
| Si el formulario pregunta por borrar parte de los datos sin eliminar la cuenta | `[PENDIENTE: confirmar si se puede borrar parte de los datos sin eliminar la cuenta]` (p. ej., quitar un medicamento guardado o vaciar el perfil de emergencia) |
| Revisión de seguridad independiente (MASA) | No |
| URL de la política de privacidad | `[PENDIENTE: URL de la política de privacidad]` (también enlazada dentro de la app). |

### 2.2 Tabla por tipo de dato (todos los tipos de Google)

Finalidades de Google: Funcionalidades de la aplicación (App functionality) · Análisis (Analytics) · Comunicaciones del
desarrollador · Publicidad o marketing · Prevención de fraudes, seguridad y cumplimiento (Fraud prevention, security,
and compliance) · Personalización · Gestión de cuentas (Account management).  
«Cifrado en tránsito» y «Eliminación a petición» se contestan una sola vez para toda la app (2.1); aquí se repiten por
fila para que se vea que cubren todos los datos recogidos.

| # | Categoría | Tipo de dato | ¿Recogido? | ¿Compartido? | Obligatorio / Opcional | Finalidades | Cifrado en tránsito | Eliminación a petición |
|---|---|---|---|---|---|---|---|---|
| G1 | Ubicación (Location) | Ubicación aproximada | No | No | — | — | — | — |
| G2 | Ubicación | Ubicación precisa | No | No | — | — | — | — |
| G3 | Información personal (Personal info) | Nombre | **Sí** | No | Opcional | Funcionalidades de la aplicación; Gestión de cuentas | Sí | Sí, en la app |
| G4 | Información personal | Dirección de correo electrónico | No | No | — | — | — | — |
| G5 | Información personal | IDs de usuario | **Sí** | No | Obligatorio | Funcionalidades de la aplicación; Gestión de cuentas; Prevención de fraudes, seguridad y cumplimiento | Sí | Sí, en la app |
| G6 | Información personal | Dirección | **Sí** | No | Opcional | Funcionalidades de la aplicación | Sí | Sí, en la app |
| G7 | Información personal | Número de teléfono | **Sí** | No | Opcional (v1.2: se puede pagar y usar Premium sin darlo) | Funcionalidades de la aplicación; Gestión de cuentas | Sí | Sí, en la app |
| G8 | Información personal | Raza y etnia | No | No | — | — | — | — |
| G9 | Información personal | Opiniones políticas o creencias religiosas | No | No | — | — | — | — |
| G10 | Información personal | Orientación sexual | No | No | — | — | — | — |
| G11 | Información personal | Otra información | **Sí** | No | Opcional | Funcionalidades de la aplicación | Sí | Sí, en la app |
| G12 | Información financiera (Financial info) | Información de pago | No | No | — | — | — | — |
| G13 | Información financiera | Historial de compras | **Sí** | No | Opcional (solo si se contrata Premium) | Funcionalidades de la aplicación; Gestión de cuentas | Sí | Sí, en la app |
| G14 | Información financiera | Calificación crediticia | No | No | — | — | — | — |
| G15 | Información financiera | Otra información financiera | No | No | — | — | — | — |
| G16 | Salud y actividad física (Health and fitness) | Información de salud | **Sí** | No | Opcional | Funcionalidades de la aplicación | Sí | Sí, en la app |
| G17 | Salud y actividad física | Información de actividad física | No | No | — | — | — | — |
| G18 | Mensajes (Messages) | Correos electrónicos | No | No | — | — | — | — |
| G19 | Mensajes | SMS o MMS | No | No | — | — | — | — |
| G20 | Mensajes | Otros mensajes en aplicaciones | **Sí** | No | Opcional | Funcionalidades de la aplicación | Sí | Sí, en la app |
| G21 | Fotos y vídeos (Photos and videos) | Fotos | **Sí** | No | Opcional | Funcionalidades de la aplicación | Sí | Sí, en la app |
| G22 | Fotos y vídeos | Vídeos | No | No | — | — | — | — |
| G23 | Archivos de audio (Audio) | Grabaciones de voz o sonido | No | No | — | — | — | — |
| G24 | Archivos de audio | Archivos de música | No | No | — | — | — | — |
| G25 | Archivos de audio | Otros archivos de audio | No | No | — | — | — | — |
| G26 | Archivos y documentos (Files and docs) | Archivos y documentos | No | No | — | — | — | — |
| G27 | Calendario (Calendar) | Eventos de calendario | No | No | — | — | — | — |
| G28 | Contactos (Contacts) | Contactos | **Sí** | No | Opcional | Funcionalidades de la aplicación | Sí | Sí, en la app |
| G29 | Actividad en la aplicación (App activity) | Interacciones con la aplicación | **Sí** | No | Obligatorio | Funcionalidades de la aplicación; Análisis; Prevención de fraudes, seguridad y cumplimiento | Sí | Sí, en la app |
| G30 | Actividad en la aplicación | Historial de búsqueda en la aplicación | **Sí** | No | Obligatorio | Funcionalidades de la aplicación | Sí | Sí, en la app |
| G31 | Actividad en la aplicación | Aplicaciones instaladas | No | No | — | — | — | — |
| G32 | Actividad en la aplicación | Otro contenido generado por usuarios | No | No | — | — | — | — |
| G33 | Actividad en la aplicación | Otras acciones | **Sí** | No | Opcional | Funcionalidades de la aplicación | Sí | Sí, en la app |
| G34 | Navegación web (Web browsing) | Historial de navegación web | No | No | — | — | — | — |
| G35 | Información y rendimiento de la aplicación (App info and performance) | Registros de fallos | No | No | — | — | — | — |
| G36 | Información y rendimiento de la aplicación | Diagnósticos | **Sí** | No | Obligatorio | Análisis | Sí | Sí, en la app |
| G37 | Información y rendimiento de la aplicación | Otros datos de rendimiento | No | No | — | — | — | — |
| G38 | IDs de dispositivo o de otro tipo (Device or other IDs) | IDs de dispositivo o de otro tipo | No | No | — | — | — | — |

Los nombres de tipo pueden variar ligeramente en la traducción de Play Console; el orden y las categorías son los de
Google.

### 2.3 Justificación de las filas recogidas

- **G3 Nombre:** nombre para mostrar (opcional) y nombre del perfil de emergencia (opcional).
- **G5 IDs de usuario:** identificador interno de Supabase; sirve para la cuenta, para que cada persona solo acceda a lo
  suyo (seguridad por filas) y para aplicar los límites de uso.
- **G6 Dirección:** dirección del perfil de emergencia (opcional).
- **G7 Número de teléfono:** acceso con móvil y código SMS. El SMS lo envía un proveedor contratado
  [PENDIENTE: proveedor de SMS, p. ej. Twilio], que actúa como proveedor de servicios: no cuenta como «compartir».
  Opcional desde la v1.2: quien paga sin haber entrado puede usar Premium sin dar el teléfono (se recomienda añadirlo para
  no perder la cuenta al cambiar de móvil).
- **G13 Historial de compras:** comprobante de la suscripción de Apple o Google Play (producto, transacción, estado y fechas)
  guardado con la cuenta para activar Premium, restaurar la compra y aplicar renovaciones, cancelaciones y reembolsos.
  Opcional: solo existe si la persona contrata Premium.
- **G11 Otra información:** fecha de nacimiento del perfil de emergencia (Google pone la fecha de nacimiento como
  ejemplo de este tipo).
- **G16 Información de salud:** perfil de emergencia (grupo sanguíneo, alergias, enfermedades, medicación habitual;
  opcional y con consentimiento expreso), «Mis medicamentos» (se guardan solo si la persona quiere) y el posible
  contenido de salud de las preguntas al asistente.
- **G20 Otros mensajes en aplicaciones:** preguntas al asistente (contenido de chat). Van al servidor y a Gemini con el
  prospecto oficial; MediClaro no guarda el contenido, pero Google conserva registros 55 días, así que no es
  «tratamiento efímero». Opcional: el asistente se usa solo si la persona quiere y tras dar permiso.
- **G21 Fotos:** fotos de la caja (1280 px, sin EXIF) enviadas a Gemini para leer el envase; mismo razonamiento que G20.
  Opcional: se puede identificar por código de barras o C.N. y se puede retirar el permiso para la IA.
- **G28 Contactos:** contacto de emergencia (nombre y teléfono) escrito a mano en el perfil de emergencia; la app no lee
  la agenda. Se declara por prudencia (ver duda 3).
- **G29 Interacciones con la aplicación:** recuentos por cuenta (identificaciones al mes, preguntas al día) para aplicar
  los límites y frenar abusos, y métricas internas de uso y costes, sin contenido médico.
- **G30 Historial de búsqueda en la aplicación:** historial de identificaciones (nombre, n.º de registro, resultado, fecha
  y método). Obligatorio: se guarda con cada identificación (ver duda 2).
- **G33 Otras acciones:** preferencias (tamaño de texto, Modo fácil, velocidad de voz), favoritos y registro con fecha
  del consentimiento para la IA.
- **G36 Diagnósticos:** errores registrados en el servidor en las métricas internas, sin contenido médico (ver duda 5).

### 2.4 Por qué «Compartido: No» en todas las filas

- **Supabase** (base de datos, autenticación, funciones), **Google Gemini API** y el **proveedor de SMS** tratan los datos
  por cuenta de MediClaro: son proveedores de servicios, que Google excluye de «compartir». En el caso de Gemini, el brief
  indica además que en el EEE se aplican los términos de datos de pago (Google no usa los datos para mejorar sus
  productos).
- Las fotos y preguntas solo se envían a Gemini **tras un permiso explícito** en la app (divulgación destacada y
  consentimiento, otra excepción de Google).
- En una emergencia, el SMS al familiar y la llamada los hace **la propia persona** desde las apps del sistema (acción
  iniciada por la persona); MediClaro no transmite esos datos.
- **Apple, Google Play y, si se activa, Stripe** cobran como servicios de pago: Google indica que no hace falta declarar
  los datos que el servicio de pago recoge para procesar la transacción si la app nunca accede a ellos y los recoge el
  propio servicio. El comprobante de la compra que guarda MediClaro sí se declara (G13), sin compartirlo.

### 2.5 Tipos que no se declaran y por qué

- **Ubicación:** solo se usa en el teléfono durante una emergencia y no se envía a los servidores.
- **SMS o MMS:** la app no lee mensajes; solo abre un borrador en la app de mensajes para que la persona lo envíe.
- **Audio:** la lectura en voz alta usa la voz del teléfono; la app no graba.
- **Información de pago** (tarjeta, cuenta): la recogen Apple, Google Play o Stripe directamente; MediClaro nunca accede a
  ella.
- **Archivos y documentos:** «Descargar mis datos» genera un archivo para la persona; no se sube ningún archivo.
- **IDs de dispositivo, registros de fallos, navegación web:** la app no incluye SDK de publicidad, analítica ni
  informes de fallos.

---

## 3. Dudas para el titular

1. **Fotos y preguntas «no vinculadas» (Apple).** Siguen el criterio del brief: el servidor no envía identificadores a
   Google. Pero Apple advierte que los «datos personales» según la ley se consideran vinculados, y las preguntas son
   texto libre en el que la persona puede escribir datos que la identifiquen. Si vuestro asesor considera que son datos
   personales en manos de Google, la opción prudente es marcar «vinculado» en A16 y A20. En Google Play no cambia nada.
2. **Historial de identificaciones.** Se declara como historial de búsqueda (Apple A22, Google G30). Si preferís
   tratarlo también como dato de salud (revela qué medicamentos consulta alguien), en Google «Información de salud»
   (G16) pasaría a **Obligatorio**, porque el historial se guarda siempre.
3. **Contacto de emergencia.** Se declara como «Contactos» (Apple A14, Google G28) por prudencia, aunque sea un único
   contacto escrito a mano y la app no lea la agenda. Confirmar que el criterio os parece bien.
4. **Campos del perfil de emergencia.** El formulario de la v1.1 pide: nombre y apellidos, fecha de nacimiento,
   dirección (calle, código postal, ciudad, provincia y país), grupo sanguíneo, alergias, enfermedades, medicación
   habitual, médico (solo se guarda en el teléfono) y un contacto de emergencia (nombre, relación y teléfono). No pide
   teléfono propio ni «información adicional». Todos encajan en tipos ya declarados; solo el texto libre de
   «Enfermedades relevantes» podría recoger algo que Apple considera «Sensitive Info» (p. ej., discapacidad o embarazo):
   el formulario no lo pide, pero conviene que el asesor lo valore.
5. **Métricas internas.** En el código actual la tabla de métricas guarda el ID de la persona junto a cada evento
   (identificación, pregunta, error y, por ejemplo, «pregunta derivada a emergencia»). Por eso se declaran uso y
   diagnóstico como vinculados. Confirmar plazo de conservación y si preferís guardar esos eventos sin ID (sobre todo el
   de emergencia). Al borrar la cuenta, esas filas se conservan sin ID (anonimizadas); conviene decirlo en la política
   de privacidad.
6. **SDK.** A 28-sep la app no incluye SDK de analítica, publicidad ni fallos. Si se añade alguno (p. ej., para
   informes de errores), hay que revisar las dos declaraciones.
7. **Soporte.** El soporte es por correo, fuera de la app. Si se añade un formulario de ayuda dentro de la app, declarar
   «Customer Support» (Apple) y el tipo equivalente en Google.
8. **Pagos.** ✅ Actualizado en la v1.2 (compra integrada): historial de compras declarado (A25, G13); información de pago
   no. Si se activa la tarjeta con Stripe en una versión de tienda, revisar si Stripe entra como proveedor de servicios
   (no «compartir») y mencionarlo en la política de privacidad.
9. **Permiso para la IA.** ✅ Hecho en la v1.1: antes de la primera foto o pregunta aparece «Antes de usar la
   inteligencia artificial» (Aceptar y continuar / Ahora no), se puede retirar y volver a dar en Perfil → Privacidad y
   datos, y cada decisión se registra con fecha. Las respuestas de fotos y preguntas («opcional», enviadas solo con
   permiso) se corresponden con ese comportamiento.
10. **Datos pendientes del brief** que no cambian estos formularios pero sí la política de privacidad:
    `[PENDIENTE: proveedor de SMS, p. ej. Twilio]`, `[PENDIENTE: región de Supabase — recomendada UE]`,
    `[PENDIENTE: plazos de conservación]`, `[PENDIENTE: correo de privacidad]`,
    `[PENDIENTE: confirmar edad mínima con el abogado]`.
11. **Web de eliminación de la cuenta:** `[PENDIENTE: URL web para solicitar la eliminación de la cuenta y los datos]`
    (obligatoria en Google Play).
12. **Borrado parcial:** `[PENDIENTE: confirmar si se puede borrar parte de los datos sin eliminar la cuenta]`.
