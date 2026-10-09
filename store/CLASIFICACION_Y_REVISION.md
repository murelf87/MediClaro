# MediClaro — Clasificación por edades, declaraciones de salud y notas para la revisión

> Kit de tiendas · español de España · preparado el 28-sep-2026.  
> Fuente de verdad: `COMMERCIAL_BRIEF.md`. Referencias oficiales: Apple «Age ratings values and definitions», «Set an
> app age rating», noticia «Updated age ratings in App Store Connect», «Declare regulated medical device status» y App
> Review Guidelines; Google Play «Content ratings» (IARC), «Health apps declaration», «Health Content and Services» y
> «Requirements for providing login credentials for app access».

---

## 1. Apple — cuestionario de clasificación por edades

Apple usa ahora 4+, 9+, 13+, 16+ y 18+. Dos reglas deciden el resultado de MediClaro:

- La **información médica o de tratamiento «frecuente»** lleva a **16+**.
- Apple pide tener en cuenta **todas las funciones, incluidos los asistentes de IA y chatbots**, al valorar la
  frecuencia. En MediClaro la información sobre medicamentos es el contenido principal (ficha, prospecto, resumen y
  asistente), así que es «frecuente».

Dónde: App Store Connect → la app → General → App Information → Age Ratings → *Set Up Age Ratings*.

| Sección | Pregunta (nombre oficial) | Respuesta recomendada | Por qué |
|---|---|---|---|
| In-App Controls | Parental Controls | **No** | La app no tiene controles parentales. |
| In-App Controls | Age Assurance | **No** | La app no verifica la edad. |
| Capabilities | Unrestricted Web Access | **No** | Solo abre enlaces concretos a documentos oficiales de CIMA (prospecto y ficha técnica) en el navegador del sistema; no hay navegador libre ni barra para escribir direcciones. |
| Capabilities | User-Generated Content | **No** | Nada de lo que escribe o fotografía una persona se muestra a otras. |
| Capabilities | Social Media | **No** | No hay muro, «me gusta» ni contenido compartido entre usuarios. |
| Capabilities | Messaging and Chat | **No** | El asistente es una IA, no comunica a personas entre sí. El SMS para un familiar se envía desde la app de mensajes del sistema. |
| Capabilities | Advertising | **No** | Sin publicidad. |
| Mature Themes | Profanity or Crude Humor | **None** | — |
| Mature Themes | Horror/Fear Themes | **None** | — |
| Mature Themes | Alcohol, Tobacco, or Drug Use or References | **Infrequent** (prudente) | Apple incluye referencias al consumo de sustancias «lícitas»; los prospectos oficiales mencionan el alcohol en sus advertencias. No es el tema de la app. Si preferís «None», razonad que la información de medicamentos ya está en la categoría médica. |
| Medical or Wellness | Medical or Treatment Information | **Frequent** | Es el contenido principal (incluido el asistente). Define el resultado: **16+**. |
| Medical or Wellness | Health or Wellness Topics | **Infrequent** (prudente) | La app no da consejos de estilo de vida, pero el prospecto y el asistente pueden incluir pautas generales de uso del medicamento. «None» también es defendible. |
| Sexuality or Nudity | Mature or Suggestive Themes | **None** | Los efectos adversos sexuales que puedan citar los prospectos son información clínica, cubierta por la categoría médica. |
| Sexuality or Nudity | Sexual Content or Nudity | **None** | — |
| Sexuality or Nudity | Graphic Sexual Content and Nudity | **None** | — |
| Violence | Cartoon or Fantasy Violence | **None** | — |
| Violence | Realistic Violence | **None** | — |
| Violence | Prolonged Graphic or Sadistic Realistic Violence | **None** | — |
| Violence | Guns or Other Weapons | **None** | — |
| Chance-Based Activities | Gambling | **None** | — |
| Chance-Based Activities | Simulated Gambling | **None** | — |
| Chance-Based Activities | Contests | **None** | — |
| Chance-Based Activities | Loot Boxes | **No** | — |
| Age Categories and Override | Made for Kids | **No** (Not Applicable) | No es una app infantil. |
| Age Categories and Override | Override to Higher Age Rating | **Opcional: 18+** | Solo si las condiciones fijan 18 años como edad mínima `[PENDIENTE: confirmar edad mínima con el abogado]`. Apple permite subir la clasificación cuando la política de la app exige una edad mayor. |

**Resultado esperado: 16+** (calculado por Apple). Las respuestas «prudentes» no lo cambian porque la información
médica frecuente ya lleva a 16+. Antes de guardar, comprobad en la pantalla de resumen que el cálculo es 16+.

---

## 2. Google Play — clasificación de contenido (cuestionario IARC)

Dónde: Play Console → Contenido de la aplicación (App content) → Clasificación de contenido (Content ratings). En España
la calificación la asigna **PEGI**. Google avisa de que las respuestas incorrectas pueden llevar a retirar o suspender la app. Las
preguntas exactas aparecen dentro del cuestionario; estas son las respuestas por bloque:

| Bloque | Respuesta recomendada | Por qué |
|---|---|---|
| Correo de contacto para IARC | `[PENDIENTE: correo de contacto del titular]` | Lo pide el cuestionario. |
| Categoría | **Referencia, noticias o educación** (Reference, News, or Educational) | Google pone como ejemplo las referencias médicas (WebMD, Medscape) y pide contenido clínico y neutro, como el de MediClaro. |
| Violencia, miedo, sexualidad, lenguaje soez, humor grosero | **No** en todo | No hay ese contenido. |
| Juegos de azar y apuestas | **No** | — |
| Drogas, alcohol o tabaco | **No**, si la pregunta trata de mostrar o fomentar el consumo de drogas ilegales, alcohol o tabaco. **Sí**, si pregunta por cualquier referencia (incluidas advertencias médicas), eligiendo el contexto educativo o informativo si se ofrece. | La app informa de medicamentos autorizados; el alcohol solo aparece en las advertencias de los prospectos oficiales. |
| ¿Los usuarios interactúan o intercambian contenido entre sí? | **No** | El asistente es una IA; no hay comunicación entre usuarios dentro de la app. |
| ¿La app comparte la ubicación actual del usuario con otros usuarios? | **No** | La app no muestra la ubicación a nadie. En una emergencia la persona puede enviarla ella misma por SMS desde su app de mensajes. (Si preferís señalarlo, no cambia la edad.) |
| ¿Compras de productos digitales? | **No** | No hay compras en la app. |
| ¿Navegador o acceso libre a internet? | **No** | Solo abre enlaces a documentos oficiales. |
| ¿Contenido principalmente informativo o educativo? (si se pregunta) | **Sí** | — |
| IA generativa (si el cuestionario lo pregunta) | **Sí**: resumen generado con IA a partir del prospecto oficial y asistente de texto que explica la información oficial; no genera imágenes. | Transparencia; coincide con la ficha. |

**Resultado esperado en España: PEGI 3** si todas las respuestas de contenido son «No». Si se declara alguna
referencia a sustancias, IARC puede asignar una calificación mayor: el cálculo final lo hace IARC y se ve en el resumen
antes de enviarlo.

**Público objetivo (formulario aparte en Play Console):** marcar solo **18 años o más** si se confirma que el servicio es
para mayores de edad `[PENDIENTE: confirmar edad mínima con el abogado]`.

---

## 3. Google Play — Declaración de apps de salud

Obligatoria para todas las apps publicadas. Dónde: Play Console → Contenido de la aplicación (App content) → Apps de
salud (Health apps).
Google revisa que la declaración coincida con lo que hace la app (hay rechazos por «declaración inexacta»).

| Grupo | Categoría (Play Console en español / inglés) | ¿Marcar? | Por qué (definición oficial de Google) |
|---|---|---|---|
| Medicina | Educación y referencias médicas (Medical Reference and Education) | **Sí** | «Recursos educativos para profesionales sanitarios y pacientes…»: ficha, prospecto oficial y explicación sencilla. |
| Medicina | Medicamentos y control del dolor (Medication and Treatment Management) | **Sí** | Google incluye expresamente los «identificadores de pastillas»; la app identifica medicamentos y guarda «Mis medicamentos». No tiene recordatorios ni gestiona recetas. |
| Medicina | Emergencias y primeros auxilios (Emergency and First Aid) | **Sí** | «Recursos de preparación ante emergencias»: 112 siempre visible, perfil de emergencia y mensaje preparado para el operador. |
| Medicina | Gestión y servicios sanitarios (Healthcare Services and Management) | **Sí** (prudente) | La definición incluye «ayudar en el cuidado de personas mayores»; la app está pensada para mayores y permite configurar su servicio privado de asistencia (teleasistencia). |
| Medicina | Gestión de enfermedades y afecciones | No | No sigue ni gestiona enfermedades. |
| Medicina | Ayuda a la toma de decisiones clínicas | No | Es para profesionales; la app no da pautas clínicas. |
| Medicina | Prevención de enfermedades y salud pública | No | Sin vacunación ni seguimiento de enfermedades infecciosas. |
| Medicina | Salud mental y conductual | No | El 024 solo aparece como recurso público ante una posible urgencia. |
| Medicina | Fisioterapia y rehabilitación | No | — |
| Medicina | Salud reproductiva y sexual | No | — |
| Salud y bienestar | Actividad y forma física · Nutrición y control del peso · Seguimiento del periodo menstrual · Gestión del sueño · Gestión del estrés, relajación y agudeza mental | No | Ninguna función de este tipo. |
| Aplicaciones de dispositivos médicos | (Apps regulated as medical devices) | **Solo si** la evaluación del titular concluye que es producto sanitario | En ese caso Google pide publicar nombre del producto, fabricante, descripción, advertencias, enlace a las instrucciones de uso y UDI-DI. Ver apartado 4. |
| Investigación en humanos | — | No | — |
| — | Mi aplicación no proporciona funciones de salud | No | — |

Además, la política de salud de Google exige para las apps que no son producto sanitario el aviso en la descripción
(«no es un producto sanitario y no diagnostica, trata, cura ni previene ninguna enfermedad…» y consultar a un
profesional sanitario): ya está en `FICHA_TIENDAS.md`. También exige la URL de la política de privacidad en Play Console
y un enlace o texto dentro de la app.

---

## 4. Apple — declaración de «regulated medical device» (producto sanitario regulado)

**Obligatoria para MediClaro:** Apple la exige a las apps cuya categoría principal o secundaria es Medicina o Salud y
forma física, **o** que marcan información médica «frecuente» en la clasificación por edades. Para apps nuevas es
necesaria desde el 26-mar-2026 para distribuir en el **EEE, Reino Unido o EE. UU.** (solo cuentan las regiones donde se
distribuya: `[PENDIENTE: países de distribución]`).

Dónde: App Store Connect → la app → General → App Information → *App Store Regulations & Permits* → *Declare Regulated
Medical Device* (rol Account Holder o Admin).

**Recomendación:** la respuesta **depende de la evaluación MDR del titular**
`[PENDIENTE: evaluación del titular sobre si MediClaro es producto sanitario según el MDR]`. Este kit no la decide. Los textos de tienda están escritos para el caso
«No» y habría que cambiarlos si la respuesta es «Sí».

| | Si responde **Sí** | Si responde **No** |
|---|---|---|
| Qué se muestra en la ficha | La información regulatoria aparece en la ficha del EEE, Reino Unido o EE. UU. (en unas 24 h o al aprobarse la app). | No se muestra ninguna declaración. |
| Qué hay que aportar | Por región: contacto verificado de la empresa (visible en la ficha); UE/EEE: número SRN del fabricante (coherente con EUDAMED; no se pide para Reino Unido); EE. UU.: número FDA Owner/Operator; URL de las instrucciones de uso; declaración de finalidad prevista; información de seguridad (advertencias, precauciones y contraindicaciones). Si falta algo, el estado queda como «Missing Info». | Nada más. |
| Norma 1.4.1 de Apple | Adjuntar a la revisión el enlace a la documentación regulatoria. | Mantener el recordatorio de consultar al médico (ya está en la app y en la ficha). |
| Textos de tienda | Quitar «no es un producto sanitario…» en las dos tiendas y describir la finalidad prevista. | Los textos actuales ya encajan: app informativa que no diagnostica ni trata. |
| Google Play | Marcar «Aplicaciones de dispositivos médicos» y dar nombre, fabricante, descripción, advertencias, instrucciones de uso y UDI-DI; deja de aplicarse el aviso para apps que no son producto sanitario. | Mantener el aviso obligatorio en la descripción. |
| Responsabilidad | Mantener la información al día (se edita en App Store Connect y en *Business → Compliance*). | Apple indica que, si la app **es** un producto sanitario regulado, hay que declarar «Sí»: el titular responde de que «No» sea cierto y debe cambiarlo si cambia la app o su evaluación. |

---

## 5. Notas para el revisor

### 5.1 Preparación de la cuenta de prueba (antes de enviar)

1. **Número de prueba en Supabase:** configurar un número y un código fijo en `[auth.sms.test_otp]` (en el panel:
   Auth → Providers → Phone, números de prueba). No se envía SMS: el código siempre es el mismo. El
   `supabase/config.toml` actual del proyecto solo tiene la sección de acceso por correo; si la configuración se gestiona
   por archivo, hay que añadir la de SMS.
   `[PENDIENTE: número de móvil de prueba]` · `[PENDIENTE: código de 6 cifras de prueba]`.
2. **Que no caduque:** Apple exige que la cuenta de prueba no caduque y Google que las credenciales sean reutilizables,
   estén siempre disponibles y funcionen desde cualquier país. Si el panel pide una fecha de validez para los números de
   prueba, poner una lejana.
3. **Premium para la revisión (v1.2):** identificar, el asistente, la lectura en voz alta y Mis medicamentos son de
   Premium. Dos caminos, los dos necesarios:
   - **Compra en Sandbox:** los revisores de Apple compran con su cuenta de Sandbox, así que `iap-verify` debe aceptar
     compras del entorno **Sandbox** también en producción (R-04). En Google Play, añadir las cuentas de prueba como
     *license testers* `[VERIFICAR: cómo prueba las compras el equipo de revisión de Google Play]`.
   - **Cuenta de prueba con Premium activo** (número de prueba): permite revisar todas las funciones sin comprar. Ahora sí
     es coherente, porque Premium se contrata dentro de la app. Marcarla como Premium desde el panel del servidor.
   - Enviar la **primera suscripción junto con la versión** (Apple revisa la compra integrada con la app), con su captura de
     revisión (la pantalla de planes) y sus notas.
4. **Datos de ejemplo en la cuenta:** 2 o 3 medicamentos guardados, algo de historial y un perfil de emergencia con datos
   ficticios. Servicio privado de asistencia: vacío o con un número inofensivo del titular, **nunca un servicio real**
   `[PENDIENTE: número de prueba para el servicio privado, si se configura]`.
5. **Cosas para probar la identificación:** los revisores quizá no tengan cajas españolas.
   `[PENDIENTE: 2 o 3 C.N. de ejemplo]` y, si se puede, `[PENDIENTE: URL con fotos de cajas de ejemplo]`.
6. **Servidor encendido** durante la revisión (Apple 2.1): funciones desplegadas y clave de Gemini configurada.
7. **Compilación de tienda:** perfil `production` (`EXPO_PUBLIC_PAYMENTS_MODE=store`): sin «Entrar sin verificar», sin
   hojas «SIMULACIÓN», sin tarjeta ni enlaces a Stripe; con la compra integrada, «Restaurar compra», las condiciones junto
   al botón de compra y la pantalla de permiso para la IA. `app_config.plans.storeVerification = true` y productos creados
   en las dos tiendas (si no, la app no vende y funciona como gratuita).
8. **Contacto para App Review:** `[PENDIENTE: nombre, correo y teléfono (+34) de la persona de contacto]`.

### 5.2 Notas en español (para que el titular las revise)

- **Qué es:** app en español para que las personas mayores en España entiendan sus medicamentos con datos oficiales de
  CIMA (AEMPS).
- **Cómo entrar:** no hace falta registrarse para ver la app y contratar Premium. Para entrar con la cuenta de prueba
  (que ya tiene Premium): en la bienvenida, «Ya soy Premium», país España (+34), el número de prueba, «Enviar código» y el
  código fijo (se puede escribir con el teclado grande). No se envía SMS y el código no caduca.
- **Qué hace cada parte** (pestañas Inicio, Mis meds, Asistente y Perfil; las etiquetas son las del código actual,
  revisadlas en la compilación final):
  - *Identificar un medicamento:* foto de la caja (cámara o galería), código de barras o C.N. de 6 cifras; siempre se
    valida en CIMA; si hay varios parecidos, la persona elige; si no se encuentra, se dice.
  - *Ficha:* datos oficiales, prospecto por apartados y resumen sencillo elaborado con IA a partir del prospecto
    (señalado como tal), con enlaces a los documentos oficiales.
  - *Voz alta:* voz del teléfono, velocidad ajustable.
  - *Asistente:* explica la información oficial; no diagnostica, no receta ni cambia tratamientos; remite al médico o
    farmacéutico; ante una posible urgencia muestra el 112 y recursos públicos.
  - *Mis medicamentos e Historial.*
- **Permiso para la IA (5.1.2(i)):** antes de la primera foto o pregunta, la app pide permiso para enviarlas a Google
  Gemini; se retira en Perfil → Privacidad y datos; el código de barras y el C.N. funcionan sin IA. El servidor no envía
  a Google el nombre ni el teléfono, y MediClaro no guarda las fotos ni el texto de las preguntas.
- **Emergencia (no llama sola):** el botón rojo del 112 solo abre el marcador y la persona confirma la llamada. Pedimos
  al revisor que no complete una llamada real al 112. El servicio privado es opcional e independiente del 112; antes de
  abrir el marcador para él hay una cuenta atrás que se puede cancelar
  `[PENDIENTE: confirmar que se mantiene la cuenta atrás de 5 s que tiene el código actual]`. La app prepara un mensaje para el operador (se puede leer en voz alta) y un
  SMS para un familiar que la persona envía desde Mensajes. La ubicación solo se pide durante una emergencia activa, se
  usa en el teléfono y no se envía al servidor.
- **Fuentes oficiales y 1.4.1:** app informativa; recuerda consultar al médico o farmacéutico; fuente AEMPS — CIMA.
  Estado regulatorio: `[PENDIENTE: evaluación del titular sobre si MediClaro es producto sanitario según el MDR]`.
- **Cuenta:** no se pide ningún dato antes de pagar: al contratar se crea una cuenta sin datos personales y después se
  propone añadir el teléfono («Completa tu cuenta», con «Ahora no»). **Eliminar la cuenta (5.1.1(v)):** Perfil →
  Privacidad y datos → Eliminar mi cuenta (dos confirmaciones). «Descargar mis datos» exporta los datos.
- **Compras (3.1.1 y 3.1.2):** suscripción autorrenovable MediClaro Premium con la compra integrada: mensual 4,99 €,
  trimestral 12,99 € y anual 39,99 € (IVA incluido; en la app se muestran los precios de la tienda). Junto al botón: precio,
  periodo, renovación automática, «Cancela cuando quieras. Sin permanencia.», «Restaurar compra», «Condiciones de
  suscripción» y «Política de privacidad». Sin enlaces a pagos externos. **Las emergencias y el 112 no necesitan
  suscripción.**

### 5.3 App Store Connect → App Review Information (en inglés, para pegar)

| Campo | Valor |
|---|---|
| Sign-in required | Sí (para revisar Premium sin comprar; la compra también funciona sin registrarse) |
| User name | `[PENDIENTE: número de móvil de prueba, formato +34…]` |
| Password | `[PENDIENTE: código de 6 cifras de prueba]` |
| Contact information | `[PENDIENTE: nombre, correo y teléfono (+34) de la persona de contacto]` |
| Notes | El texto siguiente (2673 caracteres, contados con Python; límite 4000) |

```text
MediClaro is a Spanish-language app that helps older adults in Spain understand their medicines with official data from CIMA, the public database of the Spanish medicines agency (AEMPS). Key labels are translated below.

SUBSCRIPTION (auto-renewable, In-App Purchase)
Identifying medicines, the assistant, read-aloud and "My medicines" are part of MediClaro Premium: monthly, quarterly or annual plans (Welcome > «Conocer MediClaro» > plans, or any locked feature > «Ver planes»). Price, period, auto-renewal, «Restaurar compra» (Restore purchases), terms and privacy links are shown next to the purchase button. No registration or personal data is required before buying; after purchase the app offers to add a phone number («Completa tu cuenta»), which can be skipped («Ahora no»). Emergency features and 112 are always available without a subscription.

TEST ACCOUNT (already Premium)
Welcome > «Ya soy Premium», keep Spain (+34), enter the test number (User name), tap «Enviar código», then type the code (Password). It is a test number set in our authentication provider: no SMS is sent and the code does not expire.

WHAT EACH PART DOES (tabs: Inicio = Home, Mis meds = My medicines, Asistente = Assistant, Perfil = Profile)
- Identify a medicine: photo of the box, barcode or 6-digit National Code (C.N.). Sample C.N. codes: [PENDIENTE]. Always checked against CIMA; if several match, the user picks one; if none is found, the app says so.
- Medicine sheet: official data, the official leaflet by sections and a plain-language summary generated with AI from it (labelled as such).
- Assistant: explains the official information. It does not diagnose, prescribe or change treatments and shows 112 if a possible emergency is detected.

THIRD-PARTY AI (Guideline 5.1.2(i))
Before the first photo or question is sent to Google Gemini, the app asks for explicit permission; it can be withdrawn in Perfil > «Privacidad y datos». Barcode and C.N. identification work without AI. Our server does not send the user's name or phone number to Google.

EMERGENCY (please do not complete a real call to 112)
The red 112 button only opens the dialer: the app never places a call by itself. The optional private assistance service is independent from 112 and has a short countdown that can be cancelled. Location is used only during an active emergency, on the device.

MEDICAL APPS (Guideline 1.4.1)
Informational app: it does not diagnose or treat and reminds users to check with their doctor or pharmacist. Source: AEMPS - CIMA (https://cima.aemps.es). Regulatory status: [PENDIENTE].

ACCOUNT DELETION (Guideline 5.1.1(v)): Perfil > «Privacidad y datos» > «Eliminar mi cuenta».
```

### 5.4 Google Play → Acceso a la aplicación (en inglés: Google pide las credenciales en inglés)

Play Console → Contenido de la aplicación (App content) → Acceso a la aplicación (App access) → opción «toda o parte de
la funcionalidad está restringida» (All or some functionality is restricted) → añadir instrucciones:

| Campo | Valor |
|---|---|
| Nombre de las instrucciones | `Test account (SMS login, Premium active)` |
| Nombre de usuario / teléfono | `[PENDIENTE: número de móvil de prueba, formato +34…]` |
| Contraseña / código | `[PENDIENTE: código de 6 cifras de prueba]` |
| Otra información necesaria | El texto siguiente (492 caracteres, contados con Python) |

```text
Test account with MediClaro Premium active. Welcome > «Ya soy Premium», Spain (+34), enter the number, tap «Enviar código», type the code. No SMS is sent; the code is fixed, reusable and does not expire. Premium (identify, assistant, read-aloud) is a Google Play subscription; emergency features and 112 are free. Photos and questions go to Google Gemini only after permission. Do not complete a real call to 112: the button only opens the dialer. Delete account: Perfil > Privacidad y datos.
```

---

## 6. Lista final de pendientes para el titular

**Datos del titular y URL**

- Del brief: `[PENDIENTE: razón social, NIF, domicilio, inscripción registral, correo de contacto, correo de privacidad, teléfono, delegado de protección de datos si procede, web]`.
- `[PENDIENTE: URL de soporte]` (Apple, con datos de contacto reales) y `[PENDIENTE: web de MediClaro]` (opcional).
- `[PENDIENTE: URL de la política de privacidad]` (las dos tiendas y dentro de la app).
- `[PENDIENTE: URL web para solicitar la eliminación de la cuenta y los datos]` (Google Play).
- `[PENDIENTE: correo de contacto del titular]` (Google Play e IARC) y, si se quiere,
  `[PENDIENTE: teléfono de contacto]` público.
- Copyright: `2026 [PENDIENTE: razón social del titular]`.
- Estado de comerciante para distribuir en la UE (Ley de Servicios Digitales): App Store Connect lo pide y muestra los
  datos de contacto en la ficha si es comerciante; revisar también si lo pide Play Console.

**Decisiones**

- `[PENDIENTE: evaluación del titular sobre si MediClaro es producto sanitario según el MDR]` → declaración de Apple
  (Sí/No), declaración de salud de Google y aviso de las descripciones.
- `[PENDIENTE: países de distribución]` (regiones de la declaración de Apple).
- `[PENDIENTE: confirmar edad mínima con el abogado]` → subir a 18+ en Apple (opcional) y público objetivo en Google.
- `[PENDIENTE: el titular debe confirmar que no hay relación con la AEMPS]` (frase de la ficha).
- Compras (v1.2): **compra integrada de Apple y Google** (decidido). Pendiente del titular: acuerdo de apps de pago y datos
  bancarios/fiscales en las dos tiendas, crear los productos de R-12, `iap-verify` y notificaciones (R-04), y activar
  `storeVerification`. La ficha y los formularios de privacidad ya incluyen la suscripción.
- Criterios prudentes de este kit que el titular puede cambiar: «vinculado» de fotos y preguntas (Apple), historial como
  dato de salud, contacto de emergencia como «Contactos», respuestas «Infrequent» del cuestionario de Apple, categoría
  «Gestión y servicios sanitarios» en Google.

**Cuenta de prueba y revisión**

- `[PENDIENTE: número de móvil de prueba]` y `[PENDIENTE: código de 6 cifras de prueba]`, sin caducidad.
- Cuenta de prueba **con Premium activo** y compras de Sandbox aceptadas por `iap-verify` (ver 5.1.3).
- `[PENDIENTE: 2 o 3 C.N. de ejemplo]` y `[PENDIENTE: URL con fotos de cajas de ejemplo]`.
- `[PENDIENTE: número de prueba para el servicio privado, si se configura]` (nunca un servicio real).
- `[PENDIENTE: nombre, correo y teléfono (+34) de la persona de contacto]` para App Review.
- `[PENDIENTE: confirmar que se mantiene la cuenta atrás de 5 s que tiene el código actual]` antes de abrir el marcador
  del servicio privado.

**Comprobaciones en la compilación que se envía**

- Pantalla de permiso para la IA antes de la primera foto o pregunta, y opción de retirarlo en Perfil → Privacidad y
  datos: **hecho en la v1.1** («Antes de usar la inteligencia artificial»; la decisión se registra con fecha en
  `consents`, `kind = 'ai_processing'`). Comprobar en la compilación que se envía.
- Compra integrada con precios de la tienda, «Restaurar compra» y enlaces legales junto al botón; sin tarjeta ni enlaces a
  Stripe; sin «Entrar sin verificar» ni hojas «SIMULACIÓN».
- En iOS, el `Info.plist` solo incluye el permiso de ubicación «mientras se usa» (el texto de «siempre» se quitó en la
  v1.1; comprobado con `expo config --type introspect`).
- `[PENDIENTE: prueba con TalkBack]` si se quiere usar la etiqueta «Compatible con lectores de pantalla».
- `[PENDIENTE: comprobar disponibilidad del nombre en App Store Connect]` y
  `[PENDIENTE: elegir etiquetas en Play Console]`.
- Datos del brief que afectan a la política de privacidad: `[PENDIENTE: proveedor de SMS, p. ej. Twilio]`,
  `[PENDIENTE: región de Supabase — recomendada UE]`, `[PENDIENTE: plazos de conservación]`,
  `[PENDIENTE: correo de privacidad]`, y confirmar las dudas de `PRIVACIDAD_TIENDAS.md` §3 (sobre todo las métricas
  con ID; los campos del perfil de emergencia y el borrado parcial quedaron resueltos en la v1.1).
