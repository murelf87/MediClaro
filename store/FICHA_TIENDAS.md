# MediClaro — Ficha de tiendas (App Store y Google Play)

> **Kit de tiendas · español de España · preparado el 28-sep-2026.**  
> Fuente de verdad: `COMMERCIAL_BRIEF.md`. Lo que no está en el brief aparece como `[PENDIENTE: …]`.  
> Normas consultadas: páginas oficiales de Apple (App Store product page, Platform version information, App Review Guidelines) y de Google Play (Store listing, Metadata policy, Health Content and Services, Requirements for apps that communicate government information).  
> **Cómo se ha contado:** con Python, `len()` sobre el texto exacto en Unicode NFC (cada salto de línea = 1 carácter). En las palabras clave de Apple se cuentan también los **bytes UTF-8**, porque Apple fija ese límite en 100 bytes (una vocal con tilde ocupa 2 bytes). Los textos de este archivo son exactamente los contados: cópialos tal cual.

## Resumen de límites

| Campo | Límite | Recuento | ¿Cumple? |
|---|---:|---:|---|
| App Store · Nombre | 30 | 27 | ✅ (3 de margen) |
| App Store · Subtítulo | 30 | 30 | ✅ (0 de margen) |
| App Store · Texto promocional | 170 | 148 | ✅ (22 de margen) |
| App Store · Descripción | 4000 | 3814 (con saltos CRLF: 3858) | ✅ (186 de margen) |
| App Store · Palabras clave | 100 bytes | 99 caracteres / **100 bytes** | ✅ (justo en el límite) |
| App Store · Novedades 1.0 | 4000 | 426 | ✅ (3574 de margen) |
| Google Play · Título | 30 | 27 | ✅ (3 de margen) |
| Google Play · Descripción breve | 80 | 75 | ✅ (5 de margen) |
| Google Play · Descripción completa | 4000 | 3814 (con saltos CRLF: 3858) | ✅ (186 de margen) |
| Google Play · Notas de la versión 1.0 | 500 | 426 | ✅ (74 de margen) |
| Captura 1. Identificar por foto | 40 | 36 | ✅ (4 de margen) |
| Captura 2. Ficha clara | 40 | 37 | ✅ (3 de margen) |
| Captura 3. Voz alta | 40 | 33 | ✅ (7 de margen) |
| Captura 4. Asistente | 40 | 37 | ✅ (3 de margen) |
| Captura 5. Mis medicamentos | 40 | 32 | ✅ (8 de margen) |
| Captura 6. Emergencia / 112 | 40 | 37 | ✅ (3 de margen) |

Comprobaciones automáticas superadas (v1.2): la suscripción se explica (qué incluye, renovación automática, dónde se cancela, enlaces legales) sin precios, «ilimitado» ni «gratis»; sin superlativos («mejor», «nº 1», «garantiza», «100 %»); sin «seguro/a» como promesa; sin nombres de otras plataformas («Android», «iPhone», «App Store», «Google Play»); presentes CIMA, AEMPS, 112, voz alta, IA, médico, farmacéutico, «nunca llama sola», permiso para la IA y eliminación de la cuenta; la frase literal de salud que exige el brief está en la descripción de Google Play.

---

## 1. App Store (App Store Connect)

### 1.1 Nombre (≤30)

```text
MediClaro: tus medicamentos
```

**27** caracteres · límite 30 · margen 3 · ✅ cumple  
Alternativa si prefieres solo la marca o el nombre no está disponible: `MediClaro` (9 caracteres). Apple exige que el nombre sea único en la tienda [PENDIENTE: comprobar disponibilidad del nombre en App Store Connect].

### 1.2 Subtítulo (≤30)

```text
Foto a la caja y te lo explica
```

**30** caracteres · límite 30 · margen 0 · ✅ cumple  
Alternativa: `Prospecto claro y en voz alta` (29 caracteres).

### 1.3 Texto promocional (≤170)

```text
Entiende tu medicamento con palabras sencillas y datos oficiales de CIMA · AEMPS. Con lectura en voz alta, letra grande y el 112 siempre a la vista.
```

**148** caracteres · límite 170 · margen 22 · ✅ cumple  
Se puede cambiar en cualquier momento sin enviar una versión nueva.

### 1.4 Descripción (≤4000)

```text
MediClaro te ayuda a saber qué medicamento tienes en la mano. Haz una foto a la caja y te lo explica con palabras sencillas, a partir de la información oficial de la AEMPS.

Está pensada para personas mayores y sus familias: letra grande, pantallas claras y lectura en voz alta.

Fuente de la información: Agencia Española de Medicamentos y Productos Sanitarios (AEMPS) — CIMA (https://cima.aemps.es). MediClaro es una app independiente: no representa a la AEMPS ni a ningún organismo público.

QUÉ PUEDES HACER

• Identificar un medicamento
Haz una foto a la caja o elige una de tu galería, escanea el código de barras o escribe el Código Nacional (C.N.). MediClaro lo comprueba siempre en CIMA, la base de datos oficial de la AEMPS. Si hay varios parecidos, eliges el tuyo; si no lo encuentra, te lo dice.

• Ver una ficha clara
Datos oficiales (laboratorio, principio activo, forma, receta y presentaciones), el prospecto por apartados y un resumen sencillo elaborado con IA a partir del prospecto, señalado como tal, con enlaces a los documentos oficiales.

• Escucharlo en voz alta
MediClaro te lee el resumen o el prospecto con la voz de tu teléfono, a la velocidad que prefieras.

• Preguntar al asistente
Te explica con palabras sencillas la información oficial del medicamento. No diagnostica, no receta y no cambia tratamientos: si tu pregunta depende de tu salud, te remite a tu médico o farmacéutico. Ante una posible urgencia, te muestra el 112.

• Tener tus medicamentos a mano
Guarda tus medicamentos, marca tus favoritos y consulta el historial de lo que has identificado.

• Emergencia: el 112 siempre a la vista
El botón rojo del 112 está siempre visible. MediClaro abre el marcador de tu teléfono: nunca llama sola. Si quieres, añade tu servicio privado de asistencia (por ejemplo, tu teleasistencia), independiente del 112. Si no contesta, tú decides: volver a intentarlo, llamar al 112 o avisar a un familiar. La app te prepara un mensaje para el operador y un SMS para un familiar, que envías tú.

• Perfil de emergencia (opcional)
Guarda tus datos importantes, como alergias, enfermedades, medicación habitual y contacto de emergencia, y elige qué se comparte.

• Fácil de leer y de usar
Texto grande o muy grande, Modo fácil con pantallas más sencillas y alto contraste.

MEDICLARO PREMIUM
Identificar medicamentos, el asistente, la lectura en voz alta y Mis medicamentos forman parte de MediClaro Premium, una suscripción mensual, trimestral o anual con renovación automática. Puedes cancelarla cuando quieras en los ajustes de tu cuenta de Apple. Las emergencias y el 112 no necesitan suscripción.
Condiciones de uso: [PENDIENTE: URL de las condiciones de uso]
Política de privacidad: [PENDIENTE: URL de la política de privacidad]

TU PRIVACIDAD
• Sin contraseñas: si quieres, entras con tu móvil y un código por SMS.
• Antes de enviar tu primera foto o pregunta a la IA (Google Gemini), te pedimos permiso. Puedes retirarlo en Perfil → Privacidad y datos y seguir usando el código de barras o el C.N.
• MediClaro no guarda tus fotos ni tus preguntas; Google conserva un registro hasta 55 días solo para detectar abusos.
• Tus datos viajan cifrados y cada persona solo accede a los suyos.
• Puedes descargar tus datos o eliminar tu cuenta desde la app.

IMPORTANTE
• MediClaro te informa, pero no sustituye la opinión de tu médico ni de tu farmacéutico. Consúltales siempre antes de tomar decisiones sobre tu salud o tu tratamiento.
• MediClaro no es un producto sanitario y no diagnostica, trata, cura ni previene ninguna enfermedad ni afección médica. Para cualquier consejo, diagnóstico o tratamiento, acude a un profesional sanitario.
• El resumen sencillo y el asistente usan IA y pueden contener errores. Ante la duda, consulta el prospecto oficial y a tu médico o farmacéutico.
• MediClaro no es un servicio de emergencias. Ante una urgencia, llama al 112.
```

**3889** caracteres · límite 4000 · margen 111 · ✅ cumple (si el formulario contara cada salto de línea como 2: 3937, también cumple). Los huecos `[PENDIENTE: URL …]` se sustituirán por las URL reales: volver a contar entonces.

Cómo cubre las normas de Apple:

- **1.4.1** (apps médicas): recuerda consultar al médico antes de tomar decisiones («Consúltales siempre antes de tomar decisiones sobre tu salud o tu tratamiento»).
- **5.1.2(i)** (datos a una IA de terceros): dice que la app pide permiso antes de enviar la primera foto o pregunta a Google Gemini y dónde se retira.
- **2.3.7 / página de producto:** la primera frase dice qué hace la app; sin precios ni listas de palabras clave.
- **2.3.2 y 3.1.2 (v1.2):** dice qué funciones requieren la suscripción, que se renueva sola, dónde se cancela y enlaza las condiciones de uso y la política de privacidad (Apple exige esos enlaces en la app y en los metadatos). Sin precios en la descripción (se muestran en la ficha y en la app). Poner además la URL de la política en su campo y, si se usan condiciones propias, la licencia (EULA) en App Store Connect.

### 1.5 Palabras clave (≤100 bytes)

```text
prospecto,pastillas,fármacos,comprimidos,identificar,escanear,mayores,abuelos,letra grande,voz alta
```

**99** caracteres y **100 bytes** UTF-8 · límite 100 bytes · ✅ cumple (sin margen: si cambias una palabra, vuelve a contar los bytes; «fármacos» ocupa 1 byte más de lo que parece).

- 10 términos, separados por comas **sin espacios**; los espacios solo van dentro de una expresión («letra grande», «voz alta»), como indica Apple.
- No repiten palabras del nombre ni del subtítulo (Apple ya indexa «mediclaro», «medicamentos», «foto», «caja», «explica»), ni plurales de términos incluidos, ni nombres de categoría («medicina»), ni la palabra «app».
- Se han dejado fuera a propósito: «AEMPS» y «CIMA» (por prudencia: son el nombre de un organismo y de su servicio, y Apple pide no usar nombres de terceros ni términos protegidos como palabra clave; sí aparecen en la descripción como fuente), «112» y «emergencia» (para no atraer a quien busca un servicio oficial de emergencias), «receta», «dosis», «pastillero» y «recordatorio» (la app no gestiona recetas, no da dosis personalizadas ni tiene recordatorios).

### 1.6 Novedades de esta versión (1.0)

```text
Primera versión de MediClaro.
• Identifica tu medicamento con una foto de la caja, el código de barras o el C.N.
• Ficha con datos oficiales de CIMA · AEMPS, prospecto por apartados y resumen sencillo elaborado con IA.
• Lectura en voz alta con velocidad ajustable.
• Asistente que te explica la información oficial.
• Mis medicamentos e historial.
• Botón del 112 siempre visible.
• Texto grande, Modo fácil y alto contraste.
• MediClaro Premium por suscripción; el 112 no la necesita.
```

**486** caracteres · límite 4000 · margen 3514 · ✅ cumple  
Apple no pide este campo en la primera versión (es obligatorio a partir de la segunda). El mismo texto sirve como «Notas de la versión» en Google Play (límite 500).

### 1.7 Categorías recomendadas

| | Categoría | Motivo (definición oficial de Apple, traducida) |
|---|---|---|
| **Principal** | **Medicina** (Medical) | «Apps centradas en educación médica, gestión de información o referencia sanitaria para pacientes o profesionales». MediClaro es una referencia de medicamentos para pacientes. |
| **Secundaria** | **Consulta** (Reference) | «Apps que ayudan a acceder a información o a consultarla». Alternativa: Salud y forma física (Health & Fitness), menos ajustada porque se centra en vida sana y ejercicio. |

Aviso: con la categoría Medicina (y con información médica «frecuente» en la clasificación por edades), App Store Connect exige la declaración de **producto sanitario regulado** antes de distribuir en el EEE, Reino Unido o EE. UU. Ver `CLASIFICACION_Y_REVISION.md`.

### 1.8 URL y copyright

| Campo | Valor | Nota |
|---|---|---|
| URL de soporte (obligatoria) | `[PENDIENTE: URL de soporte]` | Apple exige que lleve a datos de contacto reales (p. ej., correo y dirección del titular). |
| URL de marketing (opcional) | `[PENDIENTE: web de MediClaro]` | Puede quedar vacía. |
| URL de la política de privacidad (obligatoria) | `[PENDIENTE: URL de la política de privacidad]` | La misma que se enlaza dentro de la app (Perfil → Privacidad y datos → Política de privacidad). |
| Copyright | `2026 [PENDIENTE: razón social del titular]` | Apple añade el símbolo © automáticamente. |

---

## 2. Google Play (Play Console)

### 2.1 Título (≤30)

```text
MediClaro: tus medicamentos
```

**27** caracteres · límite 30 · margen 3 · ✅ cumple  
Sin emojis, sin mayúsculas completas y sin «gratis», «mejor» ni «nuevo», como pide la política de metadatos.

### 2.2 Descripción breve (≤80)

```text
Una foto a la caja y entiendes tu medicamento. Datos oficiales de la AEMPS.
```

**75** caracteres · límite 80 · margen 5 · ✅ cumple

### 2.3 Descripción completa (≤4000)

```text
MediClaro te ayuda a saber qué medicamento tienes en la mano. Haz una foto a la caja y te lo explica con palabras sencillas, a partir de la información oficial de la AEMPS.

Está pensada para personas mayores y sus familias: letra grande, pantallas claras y lectura en voz alta.

Fuente de la información: Agencia Española de Medicamentos y Productos Sanitarios (AEMPS) — CIMA (https://cima.aemps.es). MediClaro es una app independiente: no representa a la AEMPS ni a ningún organismo público.

QUÉ PUEDES HACER

• Identificar un medicamento
Haz una foto a la caja o elige una de tu galería, escanea el código de barras o escribe el Código Nacional (C.N.). MediClaro lo comprueba siempre en CIMA, la base de datos oficial de la AEMPS. Si hay varios parecidos, eliges el tuyo; si no lo encuentra, te lo dice.

• Ver una ficha clara
Datos oficiales (laboratorio, principio activo, forma, receta y presentaciones), el prospecto por apartados y un resumen sencillo elaborado con IA a partir del prospecto, señalado como tal, con enlaces a los documentos oficiales.

• Escucharlo en voz alta
MediClaro te lee el resumen o el prospecto con la voz de tu teléfono, a la velocidad que prefieras.

• Preguntar al asistente
Te explica con palabras sencillas la información oficial del medicamento. No diagnostica, no receta y no cambia tratamientos: si tu pregunta depende de tu salud, te remite a tu médico o farmacéutico. Ante una posible urgencia, te muestra el 112.

• Tener tus medicamentos a mano
Guarda tus medicamentos, marca tus favoritos y consulta el historial de lo que has identificado.

• Emergencia: el 112 siempre a la vista
El botón rojo del 112 está siempre visible. MediClaro abre el marcador de tu teléfono: nunca llama sola. Si quieres, añade tu servicio privado de asistencia (por ejemplo, tu teleasistencia), independiente del 112. Si no contesta, tú decides: volver a intentarlo, llamar al 112 o avisar a un familiar. La app te prepara un mensaje para el operador y un SMS para un familiar, que envías tú.

• Perfil de emergencia (opcional)
Guarda tus datos importantes, como alergias, enfermedades, medicación habitual y contacto de emergencia, y elige qué se comparte.

• Fácil de leer y de usar
Texto grande o muy grande, Modo fácil con pantallas más sencillas y alto contraste.

MEDICLARO PREMIUM
Identificar medicamentos, el asistente, la lectura en voz alta y Mis medicamentos forman parte de MediClaro Premium, una suscripción mensual, trimestral o anual con renovación automática. Puedes cancelarla cuando quieras en Google Play › Pagos y suscripciones. Las emergencias y el 112 no necesitan suscripción.
Condiciones de uso: [PENDIENTE: URL de las condiciones de uso]
Política de privacidad: [PENDIENTE: URL de la política de privacidad]

TU PRIVACIDAD
• Sin contraseñas: si quieres, entras con tu móvil y un código por SMS.
• Antes de enviar tu primera foto o pregunta a la IA (Google Gemini), te pedimos permiso. Puedes retirarlo en Perfil → Privacidad y datos y seguir usando el código de barras o el C.N.
• MediClaro no guarda tus fotos ni tus preguntas; Google conserva un registro hasta 55 días solo para detectar abusos.
• Tus datos viajan cifrados y cada persona solo accede a los suyos.
• Puedes descargar tus datos o eliminar tu cuenta desde la app.

IMPORTANTE
• MediClaro te informa, pero no sustituye la opinión de tu médico ni de tu farmacéutico. Consúltales siempre antes de tomar decisiones sobre tu salud o tu tratamiento.
• MediClaro no es un producto sanitario y no diagnostica, trata, cura ni previene ninguna enfermedad ni afección médica. Para cualquier consejo, diagnóstico o tratamiento, acude a un profesional sanitario.
• El resumen sencillo y el asistente usan IA y pueden contener errores. Ante la duda, consulta el prospecto oficial y a tu médico o farmacéutico.
• MediClaro no es un servicio de emergencias. Ante una urgencia, llama al 112.
```

**3891** caracteres · límite 4000 · margen 109 · ✅ cumple  
Es el mismo texto que en App Store, salvo dónde se cancela la suscripción (Google Play › Pagos y suscripciones).

- **Aviso obligatorio de salud** (política «Health Content and Services»): «MediClaro no es un producto sanitario y no diagnostica, trata, cura ni previene ninguna enfermedad ni afección médica. Para cualquier consejo, diagnóstico o tratamiento, acude a un profesional sanitario.» Contiene literalmente la frase del brief y añade «afección médica», que es el término de la versión española de la política de Google.
- **Información de un organismo público** (requisito de Google para apps que muestran información oficial sin ser un organismo público): fuente visible con enlace (`https://cima.aemps.es`) y aclaración de que MediClaro no representa a la AEMPS ni a ningún organismo público [PENDIENTE: el titular debe confirmar que no hay relación con la AEMPS].
- Si el titular concluye que la app **sí** es un producto sanitario, esta frase deja de valer y hay que cambiar la descripción en las dos tiendas (ver `CLASIFICACION_Y_REVISION.md`).

### 2.4 Notas de la versión 1.0 (≤500)

```text
Primera versión de MediClaro.
• Identifica tu medicamento con una foto de la caja, el código de barras o el C.N.
• Ficha con datos oficiales de CIMA · AEMPS, prospecto por apartados y resumen sencillo elaborado con IA.
• Lectura en voz alta con velocidad ajustable.
• Asistente que te explica la información oficial.
• Mis medicamentos e historial.
• Botón del 112 siempre visible.
• Texto grande, Modo fácil y alto contraste.
• MediClaro Premium por suscripción; el 112 no la necesita.
```

**486** caracteres · límite 500 · margen 14 · ✅ cumple

### 2.5 Categoría y etiquetas

- **Categoría:** **Medicina** (Medical). Definición de Google (traducida): «referencias de medicamentos y clínicas, calculadoras, manuales para profesionales sanitarios, revistas y noticias médicas».
- **Etiquetas** (máximo 5, elegidas de la lista de Play Console; solo las que un usuario entienda a primera vista):
  1. **Asistencia visual** (Visual assistance), etiqueta de accesibilidad: texto grande, alto contraste y lectura en voz alta.
  2. **Compatible con lectores de pantalla** (Screen reader-friendly): solo si se ha probado con TalkBack [PENDIENTE: prueba con TalkBack].
  3. a 5. Buscar en Play Console etiquetas sobre **información de medicamentos**, **referencia médica** y **personas mayores**, y usarlas solo si existen en la lista con ese sentido [PENDIENTE: elegir etiquetas en Play Console].

### 2.6 Datos de contacto y privacidad

| Campo | Valor | Nota |
|---|---|---|
| Correo de contacto (obligatorio) | `[PENDIENTE: correo de contacto del titular]` | Es público en la ficha. |
| Sitio web (recomendado) | `[PENDIENTE: web de MediClaro]` | |
| Teléfono (opcional) | `[PENDIENTE: teléfono de contacto]` (solo si se quiere publicar) | |
| URL de la política de privacidad (obligatoria) | `[PENDIENTE: URL de la política de privacidad]` | Google exige además enlace o texto de la política dentro de la app. |
| URL para pedir la eliminación de la cuenta (obligatoria) | `[PENDIENTE: URL web para solicitar la eliminación de la cuenta y los datos]` | Se pide en el formulario de Seguridad de los datos; ver `PRIVACIDAD_TIENDAS.md`. |

---

## 3. Titulares para las capturas (≤40, en este orden)

| # | Pantalla | Titular | Caracteres |
|---|---|---|---:|
| 1 | Identificar por foto | Una foto y sabrás qué medicamento es | 36 / 40 ✅ |
| 2 | Ficha clara | Información oficial, clara y sencilla | 37 / 40 ✅ |
| 3 | Voz alta | Escúchalo en voz alta, a tu ritmo | 33 / 40 ✅ |
| 4 | Asistente | Pregunta tus dudas sobre el prospecto | 37 / 40 ✅ |
| 5 | Mis medicamentos | Tus medicamentos, siempre a mano | 32 / 40 ✅ |
| 6 | Emergencia / 112 | Emergencia: el 112 siempre a la vista | 37 / 40 ✅ |

Notas para las capturas:

- Apple admite hasta 10 capturas y muestra las primeras (1 a 3) en los resultados de búsqueda: por eso la foto y la ficha van primero.
- v1.2: se puede añadir una captura de los planes («Más claridad para tu salud»), que además sirve como captura de revisión de la suscripción en App Store Connect. No mostrar hojas «SIMULACIÓN», «Entrar sin verificar» ni datos personales reales (usar un perfil de emergencia de ejemplo).
- En la captura de emergencia, que se vea que el 112 es un botón aparte del servicio privado y que la app no llama sola.
- Los mismos titulares valen para Google Play (sin «gratis», «mejor» ni rankings).

---

## 4. Criterios de redacción aplicados

- Tú, frases cortas y tono cálido, pensado para personas mayores y sus familias.
- v1.2: se explica MediClaro Premium (qué funciones requieren la suscripción, renovación, cancelación y enlaces legales), sin precios (Apple desaconseja precios en la descripción; la tienda los muestra).
- Sin «ilimitado», sin superlativos y sin prometer diagnósticos ni resultados; no se usa el lema «de forma sencilla y segura» para no presentar «segura» como promesa en una app de salud.
- La IA se presenta con sus límites: resumen marcado como elaborado con IA, puede contener errores, el asistente no diagnostica ni receta, y la app pide permiso antes de enviar nada a Google Gemini.
- Emergencia: 112 siempre visible, la app abre el marcador y **nunca llama sola**, y MediClaro no es un servicio de emergencias.
- Se cita la fuente oficial (AEMPS — CIMA) sin sugerir que la app sea oficial.
- No se nombran otras plataformas (Apple 2.3.10) y no se menciona la «central de MediClaro», porque el brief la deja a decisión del propietario.

## 5. Pendientes de esta ficha

- `[PENDIENTE: comprobar disponibilidad del nombre en App Store Connect]`
- `[PENDIENTE: URL de soporte]` (Apple, obligatoria, con datos de contacto reales)
- `[PENDIENTE: web de MediClaro]` (URL de marketing y sitio web de Google Play; opcional/recomendada)
- `[PENDIENTE: URL de la política de privacidad]` (las dos tiendas y dentro de la app)
- `[PENDIENTE: razón social del titular]` (copyright)
- `[PENDIENTE: correo de contacto del titular]` y, si se quiere, `[PENDIENTE: teléfono de contacto]` (Google Play)
- `[PENDIENTE: URL web para solicitar la eliminación de la cuenta y los datos]` (Google Play)
- `[PENDIENTE: el titular debe confirmar que no hay relación con la AEMPS]` (frase «no representa a la AEMPS»)
- `[PENDIENTE: prueba con TalkBack]` y `[PENDIENTE: elegir etiquetas en Play Console]`
- Evaluación de producto sanitario: si el resultado es «Sí», cambiar el aviso de salud en las dos descripciones.
