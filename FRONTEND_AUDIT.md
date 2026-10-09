# FRONTEND_AUDIT — MediClaro (iPhone y Android)

**Fecha:** 28 de septiembre de 2026 · **Entrega:** 1.2 — pantallas Premium y pago (versión de la app: 1.0.0, primera
publicación) · Expo SDK 57 · React Native 0.86 · React 19.2 · TypeScript estricto · `expo-iap` 5.8 (StoreKit 2 / Google Play Billing)
**Plataformas:** iPhone y Android. No hay versión web: la web solo se usa internamente para las pruebas automáticas.
**Documentos relacionados:** [`SCREEN_MAP.md`](SCREEN_MAP.md) (cada pantalla y qué botones llevan a ella) ·
[`BACKEND_REQUIREMENTS.md`](BACKEND_REQUIREMENTS.md) (lo que falta en el servidor) ·
[`COMERCIALIZACION.md`](COMERCIALIZACION.md) (qué falta para vender y en qué orden) · `store/` (fichas, privacidad,
clasificación, notas para la revisión y capturas) · `legal/` (borradores legales) · `backend-patches/` (arreglos del
servidor propuestos y probados, sin aplicar).

---

## Resumen

**TOTAL PANTALLAS:** 49 rutas → **48 pantallas visibles** + 1 redirección técnica (`/subscribe`, para enlaces antiguos de
pago). Nuevas en 1.2: bienvenida «Conocer MediClaro», explicación de 4 pasos con voz, planes, «¿Cómo quieres pagar?», «Pago con
tarjeta», «¡Bienvenido a MediClaro Premium!», «Completa tu cuenta», la consola del código SMS y la pantalla bloqueada «… con
MediClaro Premium» de las funciones reales.

**TOTAL BOTONES:** **380 controles interactivos** inventariados (botones, enlaces, iconos, tarjetas pulsables,
interruptores, pestañas, teclas y campos), incluidos 11 elementos globales (barra inferior, franja de acceso de prueba,
«Volver», permiso para la IA, pantalla bloqueada de Premium y hojas de pago simuladas de las compilaciones de prueba).

**BOTONES FUNCIONALES:** **372 / 380** con acción comprobada. Los 8 restantes **no son botones muertos**:
4 indicadores informativos sin acción por diseño (barra de progreso y puntos de la explicación, vista previa del SMS y
«Español ✓»), 1 botón oculto hasta tener el correo de soporte (C-5) y 3 filas de documentos legales «Pendiente de publicación»
hasta tener sus URL (C-3). **0 controles sin acción.**

**PANTALLAS TERMINADAS:** **49 / 49**.

**PANTALLAS PENDIENTES:** **0** en el frontend. Las funciones que dependen del servidor se muestran de forma honesta (ocultas,
guardadas solo en el teléfono con aviso, o con un mensaje claro); nunca se simulan. Los pagos simulados solo existen en las
compilaciones de prueba y se señalan como «SIMULACIÓN».

**BACKEND · actualización de integración 29-09-2026:** el árbol final ya integra por código R-01 (sincronización Stripe/sub_state), R-24 (IA solo Premium en servidor), R-04 (`iap-verify` + receptores Apple/Google que reconsultan la tienda) y la limpieza de R-21. Siguen bloqueando la publicación con cobro las **acciones externas**: R-02 SMS, R-03 desplegar migraciones/funciones, activar Anonymous sign-ins, configurar secretos/productos/notificaciones y probar Sandbox/License Testing. `app_config.plans.storeVerification` queda deliberadamente en `false` hasta completar esas pruebas. R-22 solo aplica si se habilita tarjeta dentro de una versión de tienda.

**ERRORES CONOCIDOS:** ninguno abierto en las pruebas automáticas (203/203 flujos y 28/28 comprobaciones; 0 errores de página). Quedan las
limitaciones de la sección 6 y la ronda en dispositivo físico de la sección 7 (compras reales de Apple/Google en Sandbox, cámara,
voz, marcador, SMS y teclado reales no se pueden probar desde el entorno de desarrollo).

> **Nota de integración 29-09-2026:** los 203/203 flujos y 212/212 unitarios son la evidencia de la entrega frontend v1.2 recibida. Tras integrar backend real, CIMA, IAP y la mejora GPS, este entorno no pudo reinstalar `node_modules` (sin acceso de red), por lo que no se atribuyen esos resultados antiguos al ZIP final. Sí se ha realizado parseo TypeScript/TSX de 206 archivos (0 errores sintácticos) y `scripts/release-check.mjs` (0 fallos). `COMPROBAR_MEDICLARO.bat` ejecuta de nuevo `npm ci`, typecheck, tests y Expo introspect en Windows antes de dar la integración por validada.

---

## Novedades de la entrega 1.2 (pantallas Premium y pago)

| Cambio | Por qué | Comprobado con |
|---|---|---|
| **Recorrido sin registrarse**: Bienvenida «Conocer MediClaro» → explicación de 4 pasos (Identifica · Pregunta al asistente IA · Escucha el prospecto · Emergencias y ubicación) con barra de progreso, carrusel, puntos, «Siguiente», ejemplos marcados «Ejemplo» y **voz grabada** → planes | Tableros 1–3 del propietario; entender la app antes de pagar | Flujos P01–P05, A (explicación y deslizamiento), barrido |
| **Planes** «Más claridad para tu salud»: Mensual 4,99 €/mes · Trimestral 12,99 €/3 meses («Ahorra un 13 % aprox.») · Anual 39,99 €/año («Ahorra un 33 % aprox.», cinta «RECOMENDADO», elegido al entrar); ventajas; «Continuar con Premium»; «Cancela cuando quieras. Sin permanencia.»; «Restaurar compra», «Condiciones de suscripción», «Política de privacidad» | Tablero 4; Apple 3.1.2(c) (qué se obtiene por el precio) | P01–P03, P18, D (planes, cambiar de plan, enlaces), pruebas unitarias del catálogo y de la oferta |
| **Solo se muestra lo que se puede cobrar de verdad**: cada plan aparece por las vías que pueden cobrarlo (tienda con producto creado y comprobación en el servidor; tarjeta solo si el servidor acepta el plan); con la tienda, **precio y ahorro con el precio real de la tienda** | Nunca un precio que no se pueda cobrar | Pruebas unitarias de `composeOffer` (vías, planes, precios de la tienda) |
| **«¿Cómo quieres pagar?»**: «Pagar con Apple» (iPhone) / «Pagar con Google Play» (Android) con la **hoja oficial de la tienda** (StoreKit 2 / Play Billing con `expo-iap`) y «Pagar con tarjeta» (Stripe) solo donde las tiendas lo permiten y siempre con la compra de la tienda al lado | Tableros 5–6; Apple 3.1.1 y normas de la UE (la compra integrada, visible a la vez) | P01, P04–P10, D |
| **«Pago con tarjeta»**: resumen, «Pagar 39,99 €», tarjeta guardada en Stripe para las renovaciones, «Powered by Stripe»; los datos de la tarjeta se escriben en la **página segura de Stripe** dentro de la app (la app nunca ve la tarjeta); aviso obligatorio de la tienda antes de salir al pago (UE/EEE) | Tablero 7 con las reglas del proyecto (el frontend no programa Stripe ni guarda tarjetas) | P02, D (tarjeta simulada: validación, cancelar sin cargo) |
| **Cuenta sin teléfono al pagar** y teléfono **después** del pago («Completa tu cuenta», «Ahora no», aviso permanente en Perfil) | «No pedir teléfono antes del pago»; Apple 5.1.1(v) | P01, P11–P14, P24, prueba unitaria de la protección de rutas |
| **«¡Bienvenido a MediClaro Premium!»** con confirmación **real del servidor** (nunca una confirmación falsa), confeti y lista animada; estados «confirmando», «pendiente de aprobación» (compras familiares) y «ya activo» | Tablero 8; activación inmediata | P01, P07–P10, D (resultado del pago) |
| **Verificación por SMS con aviso de envío y consola**: animación «¡Mensaje enviado!» → vista previa del SMS tal como llegará → teclado grande con casillas animadas, cambio al teclado del teléfono con autocompletado del código, temblor en rojo si el código no es correcto | Petición del propietario; personas mayores | A (acceso, código incorrecto, reenviar), P01, P24, barrido de las dos fases |
| **Funciones reales solo con Premium**: identificar, asistente IA, lectura por voz y añadir/ver medicamentos muestran la pantalla «… con MediClaro Premium» (con «Ver planes» y el 112 a mano); **las emergencias y el 112 nunca se bloquean**; «Mis medicamentos» y el historial siguen visibles (solo lectura) | «La IA real no se usa en el modo gratuito»; seguridad de las personas mayores | P15–P23, S02, barrido de pantallas bloqueadas |
| **Red de seguridad**: si la versión de tienda aún no puede cobrar (el servidor no comprueba compras), la app **no bloquea nada** ni anuncia Premium y muestra «Tu plan» | Nunca dejar una app cerrada sin forma de pagar | Flujos S03–S06 (compilación «solo tienda») |
| **Límites sin anuncios a quien ya paga**: con Premium, al agotar lo incluido se explica cuándo se renueva y «Ver mi suscripción» (uso del mes en «Tu MediClaro Premium»); el cargo por uso adicional solo se menciona a quien paga con tarjeta; si el servidor exige Premium (`PREMIUM_REQUIRED`) se dice claramente, nunca «sesión caducada» | Honestidad comercial | B (límite con Premium), C (límite del asistente), pruebas unitarias de errores |
| **Ventajas con los textos del tablero** y aclaración «“Emergencias y ubicación” y “Funciones de accesibilidad” son gratis para todos, con o sin Premium» | No vender como exclusivo lo que es gratis | Prueba unitaria + P01/D |
| **Colores, personaje y movimiento en toda la app**: paleta del tablero (#2563EB, #60A5FA, #DBEAFE, #F59E0B, #10B981, #EF4444, #6B7280, #F8FAFC; verdes y rojos de texto oscurecidos para el contraste), la guía (personaje) en bienvenida, explicación, planes y asistente; logotipo del corazón de siempre; animaciones suaves que respetan «Reducir movimiento» | Tableros; coherencia visual | Capturas de todas las pantallas, barrido |
| **Accesibilidad**: los avisos con botón ya no se agrupan (VoiceOver/TalkBack llegan al botón, también en el módulo de emergencia); tamaño de letra desde la bienvenida («Aa») | Personas mayores | Revisión de código + barrido «Muy grande» |
| **Vuelta al pago tras entrar con el teléfono** (si el servidor no permite cuentas sin teléfono) | Antes se perdía el destino y se iba al Inicio | P06 |

## Novedades de la entrega 1.1 (preparada para las tiendas)

| Cambio | Por qué | Comprobado con |
|---|---|---|
| *(Sustituido en 1.2: la versión de tienda usa ahora la compra integrada de Apple/Google; `none` sigue disponible.)* **Versión de tienda sin compras** (`EXPO_PUBLIC_PAYMENTS_MODE=none` en el perfil `production`): sin precios, sin «Ver Premium», sin enlaces de pago; `/premium` muestra **«Tu plan»** (qué incluye, uso del mes, renovación); `/payment` y `/payment-result` redirigen a «Tu plan». Stripe sigue en las compilaciones de prueba | Apple 3.1.1 / 3.1.3(b) y pagos de Google Play: cobrar con Stripe dentro de la app provoca el rechazo (R-04) | 10 flujos «sin compras» + recorrido de las 29 pantallas principales sin precios ni botones de compra |
| **Permiso explícito antes de usar la IA** («Antes de usar la inteligencia artificial»): antes de la primera foto o pregunta; «Ahora no» no envía nada (se conserva la pregunta; en la cámara se ofrece el código de barras); se puede retirar y volver a dar en Privacidad; cada decisión queda registrada con fecha (`consents`, `ai_processing`); los servicios se niegan a enviar sin permiso | Apple 5.1.2(i) (datos a una IA de terceros) y RGPD | 12 pruebas unitarias + flujos específicos (aceptar en la galería, rechazar en la galería → código de barras, «Ahora no» en el asistente conserva la pregunta, retirar en Privacidad → se vuelve a pedir) y todos los flujos del asistente, que lo aceptan por el camino |
| **Borrar mi perfil de emergencia** sin eliminar la cuenta | RGPD (datos de salud) | Flujo automático + pruebas unitarias |
| **«Descargar mis datos» completo**: incluye el perfil de emergencia y lo que solo vive en el teléfono (servicio privado, médico, avisos, pantalla, permiso de IA) | RGPD (derecho de acceso) | Flujo que descarga y valida el JSON |
| **Datos sensibles cifrados en el teléfono** (sesión, perfil de emergencia, mensajes recientes, servicio privado) en llavero/Keystore por bloques | Seguridad de datos de salud | Pruebas unitarias (cifrado y migración de copias antiguas) |
| **Fuente AEMPS literal** en la ficha («Fuente de la información: Agencia Española de Medicamentos y Productos Sanitarios www.aemps.gob.es» + fecha) y aviso de que el resumen con IA no es un texto de la AEMPS | Aviso legal del Nomenclátor de la AEMPS | Flujo automático |
| **Preparada para el backend corregido**: con R-01 aparece por sí solo el uso Premium («N de 100 incluidas»); con R-10, «No se renovará»; con R-06, usa la exportación del servidor | No depender de cambios de la app cuando se arregle el servidor | 6 flujos con escenarios «servidor corregido / sin corregir» (uso Premium, cancelación y exportación) |
| **Configuración nativa para la revisión**: ubicación solo «mientras se usa» (sin «siempre»), sin micrófono, sin segundo plano, manifiesto de privacidad de iOS, `usesNonExemptEncryption=false`, icono monocromo de Android 13, tema claro también en diálogos de Android (`expo-system-ui`), sin permiso de «mostrar sobre otras apps» | Menos permisos = menos preguntas en la revisión | `expo config --type introspect` y `expo prebuild` (Android) |
| **Ejemplos marcados «Ej.:»** en los formularios del perfil de emergencia y del servicio privado (antes, «Penicilina» o «Hipertensión» en gris podían parecer datos ya rellenados) | Claridad para personas mayores en datos de salud | Pruebas de flujo de edición y barrido de maquetación |
| **Arreglos del servidor propuestos y probados** (`backend-patches/`, sin aplicar) | R-01, R-05, R-06, R-07, R-09, R-10 | 39 pruebas SQL (PostgreSQL 18 en memoria) + 21 pruebas de funciones (Deno) |
| **Kit de tiendas y borradores legales**: fichas, privacidad (Apple y Google), clasificación por edades, declaraciones de salud, notas para la revisión, capturas en los tamaños de cada tienda; política de privacidad, condiciones y aviso legal | Publicación | Revisión de límites de caracteres y de hechos frente al código |

---

## 1. Cómo se ha verificado

| Verificación | Resultado |
|---|---|
| TypeScript estricto (`npm run typecheck`) | **0 errores** · **0 usos de `any`** en todo el código del frontend (pantallas, servicios y pruebas) |
| Pruebas unitarias (`npm test`) | **212/212 (16 suites)** — servicios (asistente, medicamentos, emergencia, contacto, ubicación, informe, permiso de IA), catálogo de planes y ahorro, oferta por vías de pago, vías de pago por compilación, protección de rutas (Premium, cuenta sin teléfono, vuelta al pago), errores del servidor (`PREMIUM_REQUIRED`), textos de medicamentos, formatos, máquina de estados de emergencia y almacenamiento cifrado |
| Pruebas de flujo automáticas (Playwright) que pulsan cada control por su texto o etiqueta accesible y comprueban la pantalla de destino o el texto esperado | P · Premium y pago (bienvenida, explicación, planes, Apple/Google, tarjeta, confirmación, completar cuenta, código SMS, bloqueos): **25/25** flujos<br>A · Acceso, verificación por SMS, información y perfil de emergencia: **31/31** flujos + **6/6** comprobaciones<br>B · Identificar medicamento: **31/31** flujos<br>C · Mis medicamentos, historial y asistente: **26/26** flujos<br>D · Planes, pago, resultado del pago, perfil y ajustes: **42/42** flujos<br>E · Emergencia (12 pasos): **23/23** flujos + **22/22** comprobaciones<br>F · Preparada para el backend corregido (R-01, R-06, R-10), borrar perfil de emergencia y fuente AEMPS: **8/8** flujos<br>S · Compilación «solo tienda» (como production) y red de seguridad: **6/6** flujos<br>N · Compilación sin compras (incluye el recorrido de 29 pantallas): **11/11** flujos<br>**Total: 203/203 flujos y 28/28 comprobaciones · 0 errores de página** |
| Barrido de maquetación (58 vistas × 3 configuraciones: Android 360×740 con texto normal, Android 360×740 con «Muy grande» + Modo fácil, iPhone 393×852 con «Muy grande» + Modo fácil), con compras en la app: incluye planes, pago, confirmación, completar cuenta, las dos fases del código SMS y las pantallas bloqueadas | **174/174** cargas sin contenido fuera de pantalla, sin desplazamiento lateral y sin errores de página |
| Configuración nativa (`npx expo config --type introspect`, perfil `production`) | **`expo-iap` 5.8 como plugin de configuración** (compra integrada: StoreKit 2 en iPhone y Google Play Billing en Android; **sin permisos de pago alternativo**, porque `production` vende solo con la tienda) · iOS: solo iPhone (`supportsTablet: false`), 3 textos de permiso en español (cámara, fotos, ubicación **solo mientras se usa**), sin micrófono, **sin modos en segundo plano**, `ITSAppUsesNonExemptEncryption = false`, `UIUserInterfaceStyle = Light`, manifiesto de privacidad, `LSApplicationQueriesSchemes` para teléfono, SMS, correo y mapas |
| Android generado (`npx expo prebuild`, perfil `production`) | Permisos: cámara, ubicación (aproximada y precisa, sin segundo plano), internet, vibración, ajustes de audio, almacenamiento solo hasta Android 12 y **compra integrada (`com.android.vending.BILLING`, añadido por `expo-iap`)**; **micrófono y «mostrar sobre otras apps» eliminados**; selector de fotos del sistema (sin `READ_MEDIA_IMAGES`); nivel de API objetivo **36** (el que exige Google Play desde el 31-08-2026) |
| Paquetes de tienda (`EXPO_PUBLIC_DEMO_ACCESS=off`, `EXPO_PUBLIC_PAYMENTS_MODE=store`, perfil `production`) | Exportados los paquetes de **iOS (4,6 MB) y Android (4,9 MB)** con Hermes: **compilan sin errores**; **no contienen los datos de ejemplo** del Modo demostración ni las hojas de pago «SIMULACIÓN» (`metro.config.js` sustituye `demoBackend` y `demoPayments` por módulos vacíos; comprobado buscando sus textos en los paquetes, presentes solo en las compilaciones de prueba); sin ninguna clave secreta (solo la URL pública de Supabase); no muestran «Entrar sin verificar» y ofrecen únicamente la compra de la tienda (flujos S) |
| Arreglos del servidor (`backend-patches/`) | **39/39** pruebas de migraciones y **21/21** de funciones (+ `deno check`), comparando siempre el código original con la propuesta |

Las pruebas de flujo y el barrido usan la app exportada a web con el backend simulado de `src/mocks/` (táctil, `es-ES`;
los flujos a tamaño iPhone 393×852 y el barrido también a Android 360×740), con escenarios: normal, vacío, error, Premium, varios parecidos, no encontrado, límite, límite del
asistente, urgencia en el asistente, sin servicio de asistencia, sin perfil, red lenta, acceso anónimo, texto grande,
servidor sin corregir (R-01), cancelación al final del periodo (R-10), servidor que exige Premium (R-24), sin catálogo,
servidor sin cuentas sin teléfono, número ya registrado, compra de otra cuenta, sin `iap-verify`, errores y compras pendientes
de la tienda, Google Play; en tres compilaciones: tienda + tarjeta, solo tienda y sin compras. Los pagos se simulan (hoja
«SIMULACIÓN» y página de tarjeta de prueba): **no se ha hecho ningún cobro real**.
Las partes nativas (cámara, voz, marcador, Mensajes, llavero, teclado) están cubiertas por revisión de código y pruebas
unitarias; deben confirmarse en dispositivos reales (sección 7).

---

## 2. Auditoría final pantalla por pantalla (apartado 19)

| Punto | Estado | Detalle |
|---|---|---|
| Safe Area | OK | `Screen` y `AppHeader` respetan los márgenes seguros (Dynamic Island, barra de gestos); la barra inferior informa de su altura real para que nada quede debajo |
| iPhone | OK\* | Todas las pantallas a 393×852; solo iPhone (sin versión nativa para iPad) |
| Android | OK\* | 360×740; el botón «atrás» del sistema equivale a «← Volver»; `queries` para Android 11+ |
| web | No aplica | La app no se publica en web |
| textos | OK | Español de España, tuteo, frases cortas; mensajes de error propios (los del servidor se traducen); sin textos en inglés |
| tamaños | OK | Texto Normal / Grande / Muy grande y Modo fácil (botones y textos más grandes, menos opciones); el escalado del sistema se limita a 1,3× para que la maquetación no se rompa |
| scroll | OK | Todas las pantallas se desplazan; los botones principales van en un pie fijo que se reduce con el teclado |
| botones | OK | 372/380 con acción, 0 muertos; áreas táctiles ≥ 48 px (56–72 px en acciones principales y Modo fácil); protección contra doble pulsación en navegación y pagos |
| iconos | OK | Ionicons precargados; los iconos pulsables tienen etiqueta accesible |
| imágenes | OK | Foto oficial del envase (CIMA) con ilustración de respaldo; logotipo de corazón azul/verde; la guía (personaje) en bienvenida, explicación, planes, asistente y completar cuenta; icono, icono adaptable (con versión monocroma) y pantalla de arranque generados desde el logotipo |
| navegación | OK | «← Volver» en todas las pantallas secundarias (con ruta de respaldo si no hay historial); ninguna pantalla sin salida; rutas protegidas según la sesión; enlaces profundos (`mediclaro://…`) |
| errores | OK | `ErrorState` según el tipo (sin conexión, sesión caducada, servicio caído, límite alcanzado, no encontrado, permiso de IA necesario…) con «Reintentar» u otra salida |
| loading | OK | Esqueletos y estados de carga; botones con indicador y bloqueo mientras trabajan |
| vacíos | OK | `EmptyState` con una acción útil (identificar, añadir, crear perfil…) |
| accesibilidad | OK | `accessibilityRole`, `Label`, `Hint` y `State` en los controles propios; cabeceras marcadas; alto contraste; Modo fácil; lectura en voz alta; la pantalla de permiso de IA es modal para los lectores de pantalla; avisos con botón accesibles; animaciones desactivadas con «Reducir movimiento»; teclado grande para el código SMS |
| zonas oscuras accidentales | OK | Tema claro fijo (también en los diálogos nativos de Android); la única pantalla oscura es «Llamada en curso», como en la referencia |
| desbordamientos | OK | Barrido de 174 cargas (360×740 y 393×852, texto normal y «Muy grande»): 0 desbordamientos |
| teclado | OK\* | `KeyboardAvoidingView` en iOS y Android; el pie de botones se compacta con el teclado abierto |
| formularios | OK | Validación en línea (teléfono según el país, código de 6 cifras, C.N. de 6 cifras, teléfonos del perfil de emergencia); aviso antes de salir con cambios sin guardar |

\* Verificado con emulación y revisión de código; confirmar en dispositivo físico (sección 7).

---

## 3. Condición de finalización (apartado 20)

| Condición | Estado |
|---|---|
| Todas las pantallas presentes | Sí: 49 rutas (índice en `SCREEN_MAP.md`), incluidas las 9 del tablero de Premium y pago |
| Coinciden visualmente con las referencias | Sí, salvo las diferencias deliberadas de la sección 5 |
| Todos los controles tienen acción | Sí: 372/380; los 8 restantes no son pulsables por diseño o esperan un dato del propietario |
| Sin desbordamientos | Sí: 0 desbordamientos en el barrido |
| Sin pantallas rotas | Sí: 0 errores de página en todas las pruebas |
| Sin botones muertos | Sí |
| Responsive revisado | Sí: 360×740 y 393×852, texto normal y «Muy grande» |
| Navegación completa | Sí: cada pantalla es alcanzable («Se llega desde» en `SCREEN_MAP.md`) y tiene salida |
| Integración preparada mediante servicios | Sí: `src/services/*` (Auth, Profile, Medication, Assistant, AiConsent, Subscription, **Purchase** y `billing/` (tienda y página segura), Emergency, Notification, Preferences). Las pantallas no importan Supabase, StoreKit, Google Play Billing, Stripe, CIMA ni ningún proveedor |
| Backend sin alterar | Sí: `supabase/` se entrega intacto; las correcciones propuestas están aparte, en `backend-patches/`, sin aplicar |

---

## 4. Pantallas y controles

| Nº | Pantalla | Ruta | Controles | Funcionales | Observaciones |
|---|---|---|---|---|---|
| 1 | Bienvenida «Conocer MediClaro» | `/welcome` | 5 | 5 | — |
| 2 | Explicación (4 pasos, con voz) | `/tour` | 11 | 9 | 2 informativo(s), sin acción por diseño |
| 3 | Explicación (ruta antigua, misma pantalla) | `/onboarding` | 0 | 0 | misma pantalla que `/tour` (contada una vez) |
| 4 | Acceso con teléfono | `/login` | 9 | 9 | — |
| 5 | Código SMS: aviso de envío y consola del código | `/verify` | 14 | 13 | 1 informativo(s), sin acción por diseño |
| 6 | Inicio | `/` | 8 | 8 | — |
| 7 | Cámara / identificar medicamento | `/scan` | 13 | 13 | — |
| 8 | Añadir medicamento (foto · código de barras · C.N.) | `/add-medication` | 6 | 6 | — |
| 9 | Procesando identificación | `/processing` | 18 | 18 | — |
| 10 | Selección si hay varias coincidencias | `/candidates` | 4 | 4 | — |
| 11 | Resultado | `/result` | 9 | 9 | — |
| 12 | Ficha completa del medicamento | `/medication/[id]` | 8 | 8 | — |
| 13 | Lectura en voz alta | `/voice` | 7 | 7 | — |
| 14 | Asistente IA (pestaña) | `/chat` | 13 | 13 | — |
| 15 | Asistente IA con contexto de medicamento | `/assistant` | — | — | misma tabla que `/chat` (contada una vez) |
| 16 | Mis medicamentos (pestaña) | `/medicines` | 8 | 8 | — |
| 17 | Detalle de medicamento guardado | `/saved/[id]` | 10 | 10 | — |
| 18 | Historial de identificaciones | `/history` | 7 | 7 | — |
| 19 | Planes «Más claridad para tu salud» · suscripción activa | `/premium` | 15 | 15 | — |
| 20 | ¿Cómo quieres pagar? | `/payment` | 11 | 11 | — |
| 21 | Pago con tarjeta (Stripe) | `/payment-card` | 5 | 5 | — |
| 22 | ¡Bienvenido a MediClaro Premium! | `/premium-success` | 3 | 3 | — |
| 23 | Completa tu cuenta (teléfono después del pago) | `/complete-account` | 5 | 5 | — |
| 24 | Vuelta del pago con tarjeta | `/payment-result` | 7 | 7 | — |
| 25 | Enlace heredado → redirección | `/subscribe` | 0 | 0 | redirección técnica sin controles |
| 26 | Perfil y ajustes (pestaña) | `/profile` | 15 | 15 | — |
| 27 | Datos de cuenta | `/account` | 10 | 10 | — |
| 28 | Accesibilidad | `/accessibility` | 7 | 7 | — |
| 29 | Modo fácil | `/easy-mode` | 3 | 3 | — |
| 30 | Idioma | `/language` | 2 | 1 | 1 informativo(s), sin acción por diseño |
| 31 | Notificaciones | `/notifications` | 3 | 3 | — |
| 32 | Privacidad y datos | `/privacy` | 9 | 9 | — |
| 33 | Ayuda | `/help` | 5 | 4 | 1 oculto(s) hasta tener el dato del propietario |
| 34 | Información legal | `/legal` | 11 | 8 | 3 no pulsable(s) «Pendiente de publicación» |
| 35 | Emergencia (principal) | `/emergency` | 8 | 8 | — |
| 36 | Emergencia · Confirmación | `/emergency/confirm` | 6 | 6 | — |
| 37 | Emergencia · Asistente (escuchando) | `/emergency/assistant` | 6 | 6 | — |
| 38 | Emergencia · Información preparada | `/emergency/prepared` | 14 | 14 | — |
| 39 | Emergencia · Cuenta atrás / preparación | `/emergency/calling` | 7 | 7 | — |
| 40 | Emergencia · Llamada en curso | `/emergency/in-call` | 9 | 9 | — |
| 41 | Emergencia · Sin respuesta del servicio privado | `/emergency/no-answer` | 7 | 7 | — |
| 42 | Emergencia · Confirmación posterior | `/emergency/call-done` | 5 | 5 | — |
| 43 | Emergencia · Avisar a familiar/cuidador | `/emergency/notify` | 8 | 8 | — |
| 44 | Emergencia · Mensaje para el operador | `/emergency/voice-message` | 4 | 4 | — |
| 45 | Perfil de emergencia | `/emergency-profile` | 12 | 12 | — |
| 46 | Editar perfil de emergencia | `/emergency-profile-edit` | 9 | 9 | — |
| 47 | Permisos para compartir información | `/emergency-sharing` | 3 | 3 | — |
| 48 | Número privado de asistencia | `/private-assistance` | 8 | 8 | — |
| 49 | Pantalla no encontrada | `+not-found` | 2 | 2 | — |
| — | Elementos globales (barra inferior, franja de acceso de prueba, «Volver», permiso de IA, pantalla bloqueada de Premium, hojas de pago simuladas) | todas | 11 | 11 | — |

La tabla completa **PANTALLA · CONTROL · ACCIÓN · DESTINO · ESTADO** está en el **Anexo A**; agrupada por pantalla y con
«Se llega desde», en `SCREEN_MAP.md`.

---

## 5. Diferencias deliberadas con las referencias

| Referencia | En la app | Motivo |
|---|---|---|
| Tablero de Premium: «Pagar con Apple» | «Pagar con Apple» abre la **hoja oficial de compra de Apple** (compra integrada con el Apple ID), no Apple Pay; en Android, «Pagar con Google Play» | Las suscripciones digitales se cobran con la compra integrada (Apple 3.1.1 / Google Play); Apple Pay no está permitido para contenido digital |
| Tablero: formulario de tarjeta (número, caducidad, CVC, nombre, «Guardar tarjeta») dentro de la pantalla | «Pago con tarjeta» con el resumen, el aviso de tarjeta guardada en Stripe y «Pagar 39,99 €», que abre la **página segura de Stripe** dentro de la app, donde se escriben los datos | Reglas del proyecto: el frontend no programa Stripe ni guarda tarjetas. Además, la tarjeta solo aparece donde las tiendas lo permiten (UE/EEE con sus permisos; en `production` solo la tienda) |
| Tablero: 2 pantallas de explicación | 4 pasos: se añaden «Escucha el prospecto» y «Emergencias y ubicación» (con el 112 real) y voz grabada | Mostrar todo lo que incluye antes de pagar; dejar claro que el 112 es gratis |
| Tablero: ventajas «Emergencias y ubicación» y «Funciones de accesibilidad» como Premium | Se muestran igual, con la nota «… son gratis para todos, con o sin Premium» | Nunca se bloquean; anunciarlas como exclusivas sería engañoso |
| Tablero: verde #10B981 y rojo #EF4444 | Se usan en rellenos grandes e iconos; en textos y bordes finos, #059669 / #047857 y #DC2626 | Contraste suficiente para personas mayores (WCAG AA) |
| Tablero: el teléfono en «Completa tu cuenta» | Igual, **después** del pago; con «Ahora no» y aviso en Perfil | Petición del propietario (no pedir el teléfono antes de pagar) |
| Tablero: cinta «MÁS POPULAR» en el plan anual | Cinta **«RECOMENDADO»** (mismo diseño); el texto se cambia sin publicar versión con `badge` en `app_config.plans` | «Más popular» es una afirmación de hecho que al salir no se puede demostrar; solo debe usarse cuando sea cierta |
| Tablero: «Ahorra un 13 % aprox.» / «Ahorra un 33 % aprox.» | Calculado con los precios reales (con la tienda, los de la tienda, que pueden variar por país) | Nunca un ahorro escrito a mano que no se corresponda con el precio |
| Premium (tablero de la 1.0): «Identificaciones ilimitadas», «Historial sin límites», «Soporte prioritario» | Condiciones reales: «Incluye 100 identificaciones al mes» (de `plan_config`) | El servidor no ofrece más; anunciarlo sería publicidad engañosa (R-18) |
| Bienvenida con fotografía de personas mayores | Ilustración vectorial de la marca | Falta una fotografía con licencia (C-9); el hueco está preparado en `src/config/brandAssets.ts` |
| Emergencia (12 pasos) | Mismo flujo, con el 112 siempre visible en rojo y separado del servicio privado (azul). Si el servicio privado no contesta, la app ofrece reintentar, llamar al 112 con una pulsación o avisar a un familiar; nunca llama sola | Regla de seguridad del proyecto («Importante») |
| Enviar la foto o la pregunta directamente a la IA | Antes, una pantalla de permiso explícito (una sola vez, retirable) | Apple 5.1.2(i) y RGPD |

---

## 6. Errores conocidos y limitaciones

1. **Prueba en dispositivo físico pendiente** (no es posible desde el entorno de desarrollo): cámara y lector de códigos,
   voz, marcador, Mensajes, teclado, llavero y permisos reales. La lógica está cubierta por pruebas y revisión de código.
2. **La voz no puede sonar dentro de una llamada telefónica** (iOS y Android no permiten que una app meta audio en la
   llamada). El «Mensaje para el operador» se reproduce por el altavoz del teléfono, antes de llamar o con el manos libres.
3. **Premium no se aplica en el servidor** hasta aplicar R-01 (arreglo probado en `backend-patches/`): hasta entonces el
   servidor aplica los límites gratuitos y la app no muestra un uso Premium que no sería real.
4. **Compras de Apple/Google**: la app está lista, pero no se ofrecen hasta que el servidor tenga `iap-verify` y las
   notificaciones de las tiendas y declare `storeVerification: true` (R-04), y existan los productos en las tiendas (C-12).
   Mientras tanto, la versión de tienda funciona como gratuita (red de seguridad). **No se ha probado ninguna compra real**:
   hace falta la ronda en Sandbox de la sección 7.
   - **Cuenta sin teléfono al pagar**: requiere activar *Anonymous sign-ins* (R-21). La app **no incluye CAPTCHA**; si se
     activa en Supabase, hay que añadirlo. Si alguien paga sin cuenta, no añade el teléfono y borra la app: con la tienda
     recupera Premium con «Restaurar compra»; con tarjeta, solo escribiendo a soporte.
   - **El número ya tiene cuenta** (`phone_exists`): la app lo explica y no une las cuentas; falta el endpoint de R-25.
5. **Acceso por SMS sin configurar** (R-02): hasta entonces solo se entra con «Entrar sin verificar» en compilaciones de
   prueba.
6. **Servicio privado de asistencia y médico** se guardan solo en este teléfono, cifrados (R-05): se pierden al cambiar de
   móvil. Sí aparecen en «Descargar mis datos» (apartado «datos de este teléfono»).
7. **Notificaciones**: las preferencias se guardan en el teléfono y no se envían avisos (R-11). La pantalla lo indica.
8. **Idioma**: solo español (la pantalla Idioma lo indica).
9. **Foto del envase**: depende de que CIMA tenga foto; si no, se muestra una ilustración.
10. **Textos legales y soporte**: «Pendiente de publicación» hasta tener las URL (C-3); «Escribir a soporte» oculto hasta
    tener el correo (C-5). Hay borradores en `legal/` pendientes de revisión jurídica.
11. **Escalado del texto del sistema** limitado a 1,3×: con tamaños extremos del sistema la app usa su propio «Muy grande».
12. **Voz de la explicación** grabada solo en español (Kokoro-82M, licencia Apache-2.0; voz `ef_dora`). Si falta el audio, se usa
    la voz del teléfono.
13. **Hojas de pago simuladas** (compilaciones de prueba sin tienda real): sirven para probar el recorrido; nunca aparecen en
    `production` (el módulo se sustituye en el paquete, como los datos de ejemplo).

---

## 7. Ronda en dispositivo antes de enviar a revisión

- iPhone con Dynamic Island y un iPhone pequeño; Android de 360 dp y uno grande; texto del sistema al máximo.
- Cámara: permiso concedido y denegado, foto, código de barras / DataMatrix, galería, linterna.
- Permiso para la IA: aparece antes de la primera foto y de la primera pregunta; «Ahora no» no envía nada; retirarlo en
  Privacidad vuelve a pedirlo.
- Voz: iPhone en silencio, velocidades, pausar/continuar, cambiar de parte, salir de la pantalla.
- Emergencia: el 112 abre el marcador (no llama solo), servicio privado, Mensajes con el texto preparado, ubicación
  concedida y denegada, sin conexión.
- Teclado: teléfono, código SMS, C.N., asistente y perfil de emergencia.
- **Compras en Sandbox** (Apple: cuenta de Sandbox; Google: *license testers*), con `iap-verify` desplegada: comprar los tres
  planes; cancelar en la hoja; compra pendiente («Pedir permiso» de En familia / pago pendiente de Google); cerrar la app a
  mitad y volver a abrirla (la compra se confirma sola); «Restaurar compra» en un segundo teléfono; cambiar de plan en el mismo
  grupo; renovación acelerada de Sandbox; reembolso; «Gestionar suscripción» abre la gestión de la tienda.
- Tarjeta (solo si se ofrece): hoja de aviso de Apple / programa de ofertas externas de Google, página segura de Stripe en modo
  de prueba (4242…), vuelta a la app, confirmación y «Gestionar suscripción» (portal de Stripe).
- Cuenta sin teléfono: pagar sin cuenta → «Completa tu cuenta» → SMS real con la plantilla de R-23 (autocompletar el código en
  iPhone y Android) → cerrar sesión y volver a entrar con el número.
- Explicación: voz con el iPhone en silencio, con «Reducir movimiento» y con VoiceOver/TalkBack.
- Cerrar sesión, eliminar la cuenta, borrar el perfil de emergencia y descargar los datos.
- Compilación `production`: no aparece «Entrar sin verificar» ni ninguna hoja «SIMULACIÓN»; con `storeVerification: false`,
  nada bloqueado ni anunciado; con `true`, planes con los precios de la tienda.

---

## 8. Decisiones de seguridad y producto

- Sin claves ni secretos en la app: solo la URL y la clave pública (anon) de Supabase; el resto vive en el servidor.
- Las pantallas no conocen Supabase, Stripe, Twilio, CIMA ni ningún proveedor: solo llaman a `src/services/*`.
- Cifrado en el teléfono (llavero de iOS / Keystore de Android): sesión, perfil de emergencia (datos de salud), mensajes
  recientes al asistente y datos privados de asistencia. Se borran al cerrar sesión; los de la cuenta, también al eliminarla.
- IA solo con permiso explícito: sin él, la app y sus servicios no envían fotos ni preguntas; identificar por código de
  barras o C.N. sigue funcionando sin IA.
- Compras con la hoja oficial de Apple/Google; la compra se liga a la cuenta con su id (`appAccountToken` /
  `obfuscatedAccountId`) y **solo se cierra cuando el servidor la confirma**: nunca se pierde un pago ni se activa Premium sin
  comprobarlo en el servidor. La tarjeta, solo en la página segura de Stripe: la app nunca ve ni guarda tarjetas.
- Nunca se cobra dos veces: con Premium activo, «¿Cómo quieres pagar?» y «Pago con tarjeta» muestran «Ya tienes una
  suscripción activa»; si no se puede comprobar Premium, los planes avisan de no volver a pagar.
- Cuenta sin teléfono solo para pagar (nunca el acceso de prueba), teléfono después; el acceso de prueba sigue siendo solo de
  las compilaciones de prueba.
- Red de seguridad: sin forma de pagar, nada se bloquea.
- Emergencia: el 112 siempre visible y separado del servicio privado; la app abre el marcador y nunca llama sola; el mensaje
  para el operador se construye en el teléfono, sin diagnósticos, solo con datos declarados y con los permisos concedidos.
- Fotos: se reducen a 1280 px (JPEG) y se envían sin EXIF; las copias temporales se borran en cuanto se ha preparado el envío.
- Datos de ejemplo aislados en `src/mocks/` y excluidos del paquete de tienda; «Entrar sin verificar» solo en compilaciones
  de prueba.
- iOS sin modos en segundo plano ni micrófono y con ubicación solo mientras se usa; Android sin micrófono, sin servicios en
  primer plano y sin «mostrar sobre otras apps» (menos permisos y menos motivos de rechazo en revisión).

---

## 9. Información necesaria del propietario

Resumen (detalle en `COMERCIALIZACION.md` §2 y `BACKEND_REQUIREMENTS.md` §4): empresa con D-U-N-S y cuentas de
organización en Apple y Google · URL y clave pública de Supabase (C-1) · activar el SMS y números de prueba para la revisión
(R-02, C-10) · aplicar los arreglos de `backend-patches/` · URL de los textos legales revisados (C-3) · datos del titular
(C-4) · correo de soporte (C-5) · número de la central de asistencia, si la hay (C-7) · fotografía de marca (C-9) ·
evaluación de producto sanitario · productos de suscripción y acuerdos de las tiendas (C-12) · `iap-verify` y notificaciones
(R-04) · `app_config.plans` (R-12, C-13) · *Anonymous sign-ins* (R-21) · plantilla del SMS (R-23) · IA solo para Premium en el
servidor (R-24) · permisos de pago alternativo, solo si se quiere ofrecer la tarjeta en tienda (C-14, R-22).

---

## Anexo A — PANTALLA · CONTROL · ACCIÓN · DESTINO · ESTADO

| PANTALLA | CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|---|
| Bienvenida «Conocer MediClaro» (`/welcome`) | «Aa» (arriba a la derecha) | Cambia el tamaño de la letra (Normal → Grande → Muy grande) al momento | — | OK |
| Bienvenida «Conocer MediClaro» (`/welcome`) | «Conocer MediClaro» (botón azul con latido suave) | Abre la explicación | `/tour` | OK |
| Bienvenida «Conocer MediClaro» (`/welcome`) | «Ya soy Premium» (sin compras en la app: «Entrar con mi teléfono») | Entrar con el teléfono | `/login` | OK |
| Bienvenida «Conocer MediClaro» (`/welcome`) | «Restaurar compra» (solo con compras en la app) | `PurchaseService.restore()` → si hay compra de la tienda o Premium en la cuenta: confirmación; si no: aviso «No hemos encontrado ninguna compra» | `/premium-success?status=restored` | OK |
| Bienvenida «Conocer MediClaro» (`/welcome`) | «¿Es una urgencia? Pulsa aquí» (rojo) | Abre la emergencia (pública, sin cuenta) | `/emergency` | OK |
| Explicación (4 pasos, con voz) (`/tour`) | Flecha atrás (cabecera) | Paso anterior; en el primero, vuelve (sin historial: Inicio con sesión o `/welcome`) | paso anterior / `/welcome` | OK |
| Explicación (4 pasos, con voz) (`/tour`) | Barra de progreso (cabecera) | Indica el paso (1 de 4 …), animada | — | Informativo |
| Explicación (4 pasos, con voz) (`/tour`) | Altavoz (cabecera, interruptor «Voz de la explicación») | Activa o silencia la voz grabada del paso (voz del sistema si no hay grabación) | — | OK |
| Explicación (4 pasos, con voz) (`/tour`) | Deslizar con el dedo | Cambia de paso; puntos y barra lo siguen | — | OK |
| Explicación (4 pasos, con voz) (`/tour`) | Puntos de página | Indicador (no pulsable) | — | Informativo |
| Explicación (4 pasos, con voz) (`/tour`) | «Siguiente» | Paso siguiente | paso n+1 | OK |
| Explicación (4 pasos, con voz) (`/tour`) | «Ver planes» (último paso, sin Premium y con compras) | Guarda «explicación vista» | `/premium` | OK |
| Explicación (4 pasos, con voz) (`/tour`) | «Terminar» (último paso, ya Premium) · «Empezar» (sin compras en la app) | Guarda «explicación vista» y vuelve (con sesión) o va al acceso (sin sesión) | anterior / `/(tabs)` / `/login` | OK |
| Explicación (4 pasos, con voz) (`/tour`) | «Saltar la explicación» (oculto en el último paso) | Sin sesión → planes (sin compras: acceso); con sesión → vuelve | `/premium` · `/login` · anterior | OK |
| Explicación (4 pasos, con voz) (`/tour`) | Paso 1 · ejemplo «Identifica»: flechas «Ejemplo anterior» / «Ejemplo siguiente» | Cambia el ejemplo del carrusel (caja → información) | — | OK |
| Explicación (4 pasos, con voz) (`/tour`) | Paso 4 · «Llamar al 112» del ejemplo de emergencia | Abre la emergencia real (el 112 nunca es de ejemplo) | `/emergency` | OK |
| Acceso con teléfono (`/login`) | Volver (flecha) | Atrás; sin historial → `/welcome` | Bienvenida | OK |
| Acceso con teléfono (`/login`) | Prefijo "🇪🇸 +34 ⌄" | Abre el selector de país (PhoneInput) | Hoja de países | OK |
| Acceso con teléfono (`/login`) | País de la lista / "Cerrar" | Cambia el prefijo / cierra | — | OK (componente compartido) |
| Acceso con teléfono (`/login`) | Campo "Número de móvil" | Número nacional; "Hecho" del teclado = Enviar | — | OK |
| Acceso con teléfono (`/login`) | "Enviar código →" | Valida (`validateNationalPhone` + `PHONE_ERROR_MESSAGES`) → `AuthService.requestOtp(e164)` | `/verify?phone=+34…` | OK · deshabilitado solo con el campo vacío |
| Acceso con teléfono (`/login`) | "Entrar sin verificar" (⚡, solo si `DemoMode.available()`) | `AuthService.enterWithoutVerification()` | Inicio `/(tabs)` | OK · TEMPORAL (se desactiva en tienda con `EXPO_PUBLIC_DEMO_ACCESS=off`) |
| Acceso con teléfono (`/login`) | Enlace "Condiciones de uso" | — | `/legal?section=terms` | OK |
| Acceso con teléfono (`/login`) | Enlace "Política de privacidad" | — | `/legal?section=privacy` | OK |
| Acceso con teléfono (`/login`) | "¿Es una urgencia? Pulsa aquí" (pie, rojo discreto) | — | `/emergency` (pública) | OK |
| Código SMS: aviso de envío y consola del código (`/verify`) | Volver (flecha) | Atrás; sin historial → `/login` (o `/complete-account` al añadir el teléfono) | anterior | OK |
| Código SMS: aviso de envío y consola del código (`/verify`) | «Escribir el código» (pie, durante la animación «¡Mensaje enviado!») | Salta la animación | consola del código | OK |
| Código SMS: aviso de envío y consola del código (`/verify`) | (automático) fin de la animación (~3 s; al momento con «Reducir movimiento») | Muestra la consola | — | OK |
| Código SMS: aviso de envío y consola del código (`/verify`) | «Cambiar número» | `router.back()` (o `/login`) | acceso con el número escrito | OK |
| Código SMS: aviso de envío y consola del código (`/verify`) | Vista previa del SMS («Así verás el mensaje en tu teléfono») | Informativa: el texto real de la plantilla con el código tapado | — | Informativo |
| Código SMS: aviso de envío y consola del código (`/verify`) | Teclado grande 1–9, 0 | Escribe la cifra (casilla con pequeño rebote y cursor parpadeante) | — | OK |
| Código SMS: aviso de envío y consola del código (`/verify`) | «Borrar» (tecla con flecha) | Borra la última cifra | — | OK |
| Código SMS: aviso de envío y consola del código (`/verify`) | «Usar el teclado del teléfono» / «Usar el teclado grande» | Cambia entre el teclado del sistema (con autocompletar del SMS) y el teclado grande | — | OK |
| Código SMS: aviso de envío y consola del código (`/verify`) | Campo oculto del código (autocompletar SMS: `oneTimeCode` / `sms-otp`) | El código llega solo desde el aviso del SMS | — | OK |
| Código SMS: aviso de envío y consola del código (`/verify`) | (automático) al completar 6 cifras | `verifyOtp` (acceso) o `verifyPhoneLink` (añadir teléfono tras pagar) | Inicio `/(tabs)` · tras vincular: aviso «Teléfono guardado» e Inicio | OK |
| Código SMS: aviso de envío y consola del código (`/verify`) | «Verificar» (pie; nombre accesible «Verificar el código») | Igual que al completar (reintento manual tras un fallo de red) | Inicio | OK · habilitado con 6 cifras |
| Código SMS: aviso de envío y consola del código (`/verify`) | «Reenviar código» (tras 60 s) | Pide otro código; aviso verde «Te hemos enviado un código nuevo» | — | OK |
| Código SMS: aviso de envío y consola del código (`/verify`) | «Pedir un código nuevo» (pie, código caducado) | Igual que «Reenviar código» | — | OK |
| Código SMS: aviso de envío y consola del código (`/verify`) | «¿No te llega el SMS? Entrar sin verificar» (solo compilaciones de prueba; no al añadir el teléfono) | `enterWithoutVerification()` | Inicio | OK · TEMPORAL |
| Inicio (`/`) | Avatar (arriba a la derecha) | Abre el perfil | `/(tabs)/profile` | OK |
| Inicio (`/`) | Tarjeta «PREMIUM · Activa MediClaro Premium · Ver planes» (solo sin Premium y con compras en la app) | — | `/premium` | OK |
| Inicio (`/`) | «Ver Premium» (línea de uso, solo si se puede contratar y sin candados) | — | `/premium` | OK |
| Inicio (`/`) | «Identificar un medicamento» (con candado sin Premium) | Abre la cámara (sin Premium: pantalla «… es de MediClaro Premium») | `/scan` | OK |
| Inicio (`/`) | «Mis medicamentos» | Lista guardada (siempre visible, también sin Premium) | `/(tabs)/medicines` | OK |
| Inicio (`/`) | «Preguntar a la IA» (con candado sin Premium) | Abre el asistente (sin Premium: pantalla de Premium) | `/(tabs)/chat` | OK |
| Inicio (`/`) | «Historial de búsquedas» (oculto en Modo fácil) | — | `/history` | OK |
| Inicio (`/`) | «Emergencia · Ayuda inmediata · 112» | Nunca bloqueado | `/emergency` | OK |
| Cámara / identificar medicamento (`/scan`) | «Cancelar» (texto blanco) | Apaga la linterna y vuelve | Pantalla anterior; sin historial → `/(tabs)` | OK |
| Cámara / identificar medicamento (`/scan`) | Linterna (icono flash / flash-off) | Enciende/apaga `enableTorch` | — | OK (solo cámara trasera; se apaga al salir, al disparar y al abrir la galería) |
| Cámara / identificar medicamento (`/scan`) | Selector «Foto de la caja» / «Código de barras» (radio) | Cambia el modo y el parámetro `?mode=` | — | OK |
| Cámara / identificar medicamento (`/scan`) | Disparador «Hacer la foto» / «Hacer una foto del código» | Si aún no hay permiso para la IA: pantalla «Antes de usar la inteligencia artificial» (ver Elementos globales). Con permiso: `takePictureAsync({quality:0.8})` → 1280 px JPEG 0,7 base64 → `setPendingIdentification({imageBase64})` | `replace('/processing')` | OK (deshabilitado hasta `onCameraReady`; indicador mientras prepara) |
| Cámara / identificar medicamento (`/scan`) | «Ahora no» en el permiso para la IA | Aviso «Sin permiso no podemos leer la foto» con «Escanear el código» / «Ahora no» | «Escanear el código» → modo código de barras (`?mode=barcode`, no usa IA) | OK |
| Cámara / identificar medicamento (`/scan`) | Lectura automática del código (ean13, ean8, datamatrix, code128) | Solo la 1.ª lectura (bloqueo con ref) → `setPendingIdentification({barcode})` | `replace('/processing')` | OK (solo en modo código de barras) |
| Cámara / identificar medicamento (`/scan`) | «Elegir una foto de la galería» (botón redondo) | Primero el permiso para la IA (igual que la foto); después permiso de fotos → `launchImageLibraryAsync` → misma preparación | `replace('/processing')` | OK (denegado: aviso; denegado permanente: «Abrir ajustes») |
| Cámara / identificar medicamento (`/scan`) | «Usar la cámara delantera/trasera» | Cambia `facing` | — | OK |
| Cámara / identificar medicamento (`/scan`) | «Permitir cámara» (sin permiso, se puede pedir) | `requestPermission()` | — | OK |
| Cámara / identificar medicamento (`/scan`) | «Abrir ajustes» (denegado permanente) | `openAppSettings()`; al volver se comprueba el permiso | Ajustes del sistema | OK (si no abre, aviso con la ruta) |
| Cámara / identificar medicamento (`/scan`) | «Reintentar» (error al abrir la cámara, `onMountError`) | Vuelve a montar la cámara | — | OK |
| Cámara / identificar medicamento (`/scan`) | «Elegir una foto de la galería» (alternativa) | Igual que la galería | `replace('/processing')` | OK |
| Cámara / identificar medicamento (`/scan`) | «Escribir el código de la caja» (alternativa) | — | `replace('/add-medication')` | OK |
| Añadir medicamento (foto · código de barras · C.N.) (`/add-medication`) | Volver (cabecera) | Atrás | Anterior; sin historial → `/(tabs)` | OK |
| Añadir medicamento (foto · código de barras · C.N.) (`/add-medication`) | «Hacer una foto a la caja» | — | `push('/scan?mode=photo')` | OK |
| Añadir medicamento (foto · código de barras · C.N.) (`/add-medication`) | «Escanear el código de barras» | — | `push('/scan?mode=barcode')` | OK |
| Añadir medicamento (foto · código de barras · C.N.) (`/add-medication`) | «Escribir el código nacional» | Despliega/pliega el formulario (enfoca el campo) | — | OK |
| Añadir medicamento (foto · código de barras · C.N.) (`/add-medication`) | Campo «Código nacional (C.N.)» | Numérico; acepta 6 cifras, 7 (con control) o «712729.4» → 6 primeras; 13 cifras → se envía como código de barras | — | OK (error en línea) |
| Añadir medicamento (foto · código de barras · C.N.) (`/add-medication`) | «Buscar medicamento» | Valida → `setPendingIdentification({nationalCode})` | `push('/processing')` | OK |
| Procesando identificación (`/processing`) | Volver (cabecera) | Cancela: la respuesta tardía se ignora y se borra la entrada pendiente | Anterior; sin historial → `/(tabs)` | OK |
| Procesando identificación (`/processing`) | (automático) identificado | Pasos completados → | `replace('/result?id=<id>')` | OK |
| Procesando identificación (`/processing`) | (automático) varios parecidos | → | `replace('/candidates')` | OK |
| Procesando identificación (`/processing`) | (automático) sin entrada pendiente | → | `replace('/scan')` | OK |
| Procesando identificación (`/processing`) | No encontrado · «Hacer otra foto» | — | `replace('/scan')` | OK |
| Procesando identificación (`/processing`) | No encontrado · «Escanear el código de barras» | — | `replace('/scan?mode=barcode')` | OK |
| Procesando identificación (`/processing`) | No encontrado · «Escribir el código nacional» | — | `replace('/add-medication')` | OK |
| Procesando identificación (`/processing`) | Límite (sin Premium y con compras) · «Ver MediClaro Premium» | — | `push('/premium')` | OK |
| Procesando identificación (`/processing`) | Límite (con Premium) · «Ver mi suscripción» | Uso del mes y gestión (nunca un anuncio de Premium) | `push('/premium')` | OK |
| Procesando identificación (`/processing`) | Límite · «Volver al inicio» | — | `replace('/(tabs)')` | OK |
| Procesando identificación (`/processing`) | Solo Premium según el servidor (`PREMIUM_REQUIRED`) · «Ver MediClaro Premium» (sin Premium) | — | `push('/premium')` | OK |
| Procesando identificación (`/processing`) | Solo Premium según el servidor, con Premium ya en la app · «Intentar de nuevo» | Repite con la misma entrada («Estamos confirmando tu suscripción») | — | OK |
| Procesando identificación (`/processing`) | Permiso de IA necesario · «Dar permiso y continuar» | Abre la pantalla de permiso; si se acepta, repite con la misma foto | — | OK |
| Procesando identificación (`/processing`) | Permiso de IA necesario · «Usar el código de la caja» | — | `replace('/add-medication')` | OK |
| Procesando identificación (`/processing`) | Error pasajero · «Reintentar» | Repite con la MISMA entrada | — | OK |
| Procesando identificación (`/processing`) | Otro error · «Intentarlo de otra forma» | — | `replace('/add-medication')` | OK |
| Procesando identificación (`/processing`) | Error · «Volver al inicio» | — | `replace('/(tabs)')` | OK |
| Procesando identificación (`/processing`) | Sesión caducada · «Volver a entrar» | `signOut()` | `replace('/welcome')` | OK |
| Selección si hay varias coincidencias (`/candidates`) | Volver (cabecera) | Atrás | Anterior; sin historial → `/(tabs)` | OK |
| Selección si hay varias coincidencias (`/candidates`) | Tarjeta de cada parecido (imagen, nombre tal y como aparece en la caja, forma, laboratorio, «Coincidencia alta/media») | — | `replace('/result?id=<id>')` | OK |
| Selección si hay varias coincidencias (`/candidates`) | «Ninguno coincide · Hacer otra foto» | — | `replace('/scan')` | OK |
| Selección si hay varias coincidencias (`/candidates`) | «Escribir el código nacional» | — | `replace('/add-medication')` | OK |
| Resultado (`/result`) | Volver (cabecera) | Atrás | Anterior; sin historial → `/(tabs)` | OK |
| Resultado (`/result`) | Corazón (Marcar/Quitar de favoritos) | Sin guardar → `saveMedication(med,{favorite:true})`; guardado → `setFavorite` | — | OK |
| Resultado (`/result`) | «Ver información completa» | — | `push('/medication/<id>')` | OK |
| Resultado (`/result`) | «Leer en voz alta» | — | `push('/voice?id=&name=')` | OK |
| Resultado (`/result`) | «Preguntar a la IA» | — | `push('/assistant?medicationId=&medicationName=')` | OK |
| Resultado (`/result`) | «Guardar» / «Guardado» | Guarda en Mis medicamentos / pregunta (`confirmAsync`) y lo quita | — | OK (errores con `showAlert`) |
| Resultado (`/result`) | «¿No es este? Ver otros parecidos» | Solo si hay otros parecidos | `push('/candidates')` | OK |
| Resultado (`/result`) | «Identificar otro medicamento» | — | `replace('/scan')` | OK |
| Resultado (`/result`) | «Identificar un medicamento» (estado vacío) | — | `replace('/scan')` | OK |
| Ficha completa del medicamento (`/medication/[id]`) | Volver (cabecera) | Atrás | Anterior; sin historial → `/(tabs)` | OK |
| Ficha completa del medicamento (`/medication/[id]`) | Corazón (favorito) | Igual que en el resultado | — | OK |
| Ficha completa del medicamento (`/medication/[id]`) | Apartados del «Prospecto oficial» (acordeón) | Despliega/pliega cada apartado | — | OK (desplegados si no hay resumen sencillo) |
| Ficha completa del medicamento (`/medication/[id]`) | «Ver prospecto oficial» | `openExternalUrl(leafletUrl)` | Web oficial AEMPS | OK (solo si hay URL) |
| Ficha completa del medicamento (`/medication/[id]`) | «Ficha técnica» | `openExternalUrl(sheetUrl)` | Web oficial AEMPS | OK (solo si hay URL) |
| Ficha completa del medicamento (`/medication/[id]`) | «Leer en voz alta» (pie) | — | `push('/voice?id=&name=')` | OK |
| Ficha completa del medicamento (`/medication/[id]`) | «Preguntar a la IA» (pie) | — | `push('/assistant?medicationId=&medicationName=')` | OK |
| Ficha completa del medicamento (`/medication/[id]`) | «Reintentar» / «Volver» (error) | Recarga / atrás | — | OK |
| Lectura en voz alta (`/voice`) | Volver (cabecera) | Atrás (la lectura se detiene) | Anterior; sin historial → `/(tabs)` | OK |
| Lectura en voz alta (`/voice`) | Corazón (favorito) | Igual que en el resultado | — | OK |
| Lectura en voz alta (`/voice`) | Reproducir / Pausar / Continuar / Volver a escuchar | `play()` / `pause()` | — | OK (empieza sola al cargar) |
| Lectura en voz alta (`/voice`) | «Parte anterior» / «Parte siguiente» | `goTo()` | — | OK (deshabilitados en los extremos) |
| Lectura en voz alta (`/voice`) | «Más lento» / «Velocidad normal» / «Más rápido» | `setSpeechRate(0.7/0.85/1.0)` + `restartWithNewRate()` | — | OK |
| Lectura en voz alta (`/voice`) | Filas «¿Qué se está leyendo?» (1 Qué es · 2 Para qué se utiliza · 3 Cómo tomarlo · 4 Advertencias) | Salta a esa parte | — | OK (parte actual resaltada) |
| Lectura en voz alta (`/voice`) | «Reintentar» / «Volver» (error de carga) | Recarga / atrás | — | OK |
| Asistente IA (`/chat` y `/assistant`) | "Volver" (solo `/chat`) | `back`; sin historial `replace` | anterior / `/(tabs)` | OK |
| Asistente IA (`/chat` y `/assistant`) | Icono "Nueva conversación" | Confirma y vacía (si hay respuesta en curso, avisa) | — | OK |
| Asistente IA (`/chat` y `/assistant`) | 4 sugerencias | Envían la pregunta | — | OK |
| Asistente IA (`/chat` y `/assistant`) | Campo "Escribe tu pregunta…" | Máx. 1000, contador desde 800 | — | OK |
| Asistente IA (`/chat` y `/assistant`) | "Enviar pregunta" | Primera vez: permiso para la IA; «Ahora no» conserva el borrador | — | OK |
| Asistente IA (`/chat` y `/assistant`) | "Escuchar" / "Detener" (cada respuesta) | Voz a la velocidad elegida | — | OK |
| Asistente IA (`/chat` y `/assistant`) | "Ver prospecto oficial" | Abre el prospecto de CIMA | prospecto CIMA | OK |
| Asistente IA (`/chat` y `/assistant`) | "Reintentar" (pregunta fallida o «Estamos confirmando tu suscripción») | Repite la pregunta | — | OK |
| Asistente IA (`/chat` y `/assistant`) | Límite diario → "Ver MediClaro Premium" (solo sin Premium y si se puede contratar; con Premium: «Mañana podrás volver a preguntar») | `router.push` | `/premium` | OK |
| Asistente IA (`/chat` y `/assistant`) | Solo Premium según el servidor → "Ver MediClaro Premium" | `router.push` | `/premium` | OK |
| Asistente IA (`/chat` y `/assistant`) | Urgencia → "Llamar al 112" (ROJO) | `callPhone` | teléfono | OK |
| Asistente IA (`/chat` y `/assistant`) | Urgencia → otros recursos ("Llamar al 91 562 04 20", "Llamar al 024") | `callPhone` | teléfono | OK |
| Asistente IA (`/chat` y `/assistant`) | Urgencia → "Abrir la pantalla de emergencia" | `router.push` | `/emergency` | OK |
| Mis medicamentos (pestaña) (`/medicines`) | Aviso «Tu lista sigue guardada» · «Ver planes» (solo sin Premium, con compras) | — | `/premium` | OK |
| Mis medicamentos (pestaña) (`/medicines`) | Estrella de favorito (cada fila) | Marca / desmarca | — | OK |
| Mis medicamentos (pestaña) (`/medicines`) | Fila de medicamento | Detalle (sin Premium: pantalla de Premium) | `/saved/<id>` | OK |
| Mis medicamentos (pestaña) (`/medicines`) | «+» / «Añadir medicamento» | (sin Premium: pantalla de Premium) | `/add-medication` | OK |
| Mis medicamentos (pestaña) (`/medicines`) | Pestañas «Todos» / «Favoritos», búsqueda | Filtran | — | OK |
| Mis medicamentos (pestaña) (`/medicines`) | «Historial de identificaciones» | — | `/history` | OK |
| Mis medicamentos (pestaña) (`/medicines`) | Vacío → «Identificar un medicamento» / «Ver historial» | — | `/scan` · `/history` | OK |
| Mis medicamentos (pestaña) (`/medicines`) | Error → «Reintentar» | recarga | — | OK |
| Detalle de medicamento guardado (`/saved/[id]`) | "Volver" (AppHeader) | `back`; sin historial `replace` | pantalla anterior / `/(tabs)/medicines` | OK |
| Detalle de medicamento guardado (`/saved/[id]`) | Estrella de cabecera ("Marcar como favorito" / "Quitar de favoritos") | `setFavorite` optimista con reversión + aviso | — | OK |
| Detalle de medicamento guardado (`/saved/[id]`) | Interruptor "Favorito" | `setFavorite` (deshabilitado mientras guarda) | — | OK |
| Detalle de medicamento guardado (`/saved/[id]`) | "Ver ficha completa" | `router.push` | `/medication/<id>` | OK |
| Detalle de medicamento guardado (`/saved/[id]`) | "Leer en voz alta" | `router.push({ pathname: '/voice', params: { id, name } })` | `/voice?id=&name=` | OK |
| Detalle de medicamento guardado (`/saved/[id]`) | "Preguntar a la IA" | `router.push({ pathname: '/assistant', params: { medicationId, medicationName } })` | `/assistant?medicationId=&medicationName=` | OK |
| Detalle de medicamento guardado (`/saved/[id]`) | "Quitar de mis medicamentos" | `confirmAsync` destructivo → `removeMedication` → `back` | Mis medicamentos | OK |
| Detalle de medicamento guardado (`/saved/[id]`) | Ya no está → "Ver ficha" | `router.push` | `/medication/<id>` | OK |
| Detalle de medicamento guardado (`/saved/[id]`) | Ya no está → "Volver" | `back` / `replace` | `/(tabs)/medicines` | OK |
| Detalle de medicamento guardado (`/saved/[id]`) | Error → "Reintentar" | `reload` | — | OK |
| Historial de identificaciones (`/history`) | "Volver" (AppHeader) | `back`; sin historial `replace` | anterior / `/(tabs)` | OK |
| Historial de identificaciones (`/history`) | "Ver Premium" (tarjeta de uso, solo sin Premium y si se puede contratar) | `router.push` | `/premium` | OK |
| Historial de identificaciones (`/history`) | Fila identificada (✓ verde, con flecha) | `router.push` (sin Premium: pantalla de Premium) | `/medication/<medicationId>` | OK |
| Historial de identificaciones (`/history`) | Filas "Varias coincidencias" y "No identificado" | No pulsables | — | OK (por diseño) |
| Historial de identificaciones (`/history`) | Vacío → "Identificar un medicamento" | `router.push` | `/scan` | OK |
| Historial de identificaciones (`/history`) | Error → "Reintentar" | recarga historial y uso | — | OK |
| Historial de identificaciones (`/history`) | Deslizar hacia abajo | refresca | — | OK |
| Planes «Más claridad para tu salud» · suscripción activa (`/premium`) | Volver (cabecera con el logo) | Atrás; sin historial → Inicio (con sesión) o `/welcome` | anterior | OK |
| Planes «Más claridad para tu salud» · suscripción activa (`/premium`) | Plan «Mensual · 4,99 €/mes» (tarjeta) | Selecciona el plan | — | OK |
| Planes «Más claridad para tu salud» · suscripción activa (`/premium`) | Plan «Trimestral · 12,99 €/3 meses · Ahorra un 13 % aprox.» | Selecciona el plan | — | OK |
| Planes «Más claridad para tu salud» · suscripción activa (`/premium`) | Plan «Anual · 39,99 €/año · Ahorra un 33 % aprox.» (cinta «RECOMENDADO», elegido al entrar) | Selecciona el plan | — | OK |
| Planes «Más claridad para tu salud» · suscripción activa (`/premium`) | «Continuar con Premium» (pie, con la nota de precio y renovación) | Con 2 formas de pago → elegir; solo tienda → hoja de compra de Apple/Google; solo tarjeta → pago con tarjeta | `/payment?plan=<id>` · hoja de la tienda · `/payment-card?plan=<id>` | OK |
| Planes «Más claridad para tu salud» · suscripción activa (`/premium`) | «Restaurar compra» | Compras de la tienda de este teléfono + Premium de la cuenta → confirmación; si no, aviso | `/premium-success?status=restored` | OK |
| Planes «Más claridad para tu salud» · suscripción activa (`/premium`) | «Condiciones de suscripción» | — | `/legal?section=subscription` | OK |
| Planes «Más claridad para tu salud» · suscripción activa (`/premium`) | «Política de privacidad» | — | `/legal?section=privacy` | OK |
| Planes «Más claridad para tu salud» · suscripción activa (`/premium`) | «Comprobar de nuevo» (aviso: no se ha podido comprobar si ya tienes Premium) | Vuelve a consultar | — | OK |
| Planes «Más claridad para tu salud» · suscripción activa (`/premium`) | «Continuar con mi teléfono» (aviso: el servidor no permite cuentas sin teléfono) | Guarda volver aquí tras entrar | `/login` → `/premium?plan=<id>` | OK |
| Planes «Más claridad para tu salud» · suscripción activa (`/premium`) | «Intentar de nuevo» (Premium no disponible ahora) | Recarga los planes | — | OK |
| Planes «Más claridad para tu salud» · suscripción activa (`/premium`) | Reintentar (error al cargar) | Recarga | — | OK |
| Planes «Más claridad para tu salud» · suscripción activa (`/premium`) | Con Premium · «Gestionar suscripción» | Tienda (Apple/Google) o portal seguro de Stripe (tarjeta) | gestión de la suscripción | OK |
| Planes «Más claridad para tu salud» · suscripción activa (`/premium`) | Con Premium · «Ayuda» | — | `/help` | OK |
| Planes «Más claridad para tu salud» · suscripción activa (`/premium`) | Sin compras en la app (o sin forma de pagar): «Tu plan» · «Ayuda» | Plan, uso del mes y renovación, sin precios | `/help` | OK |
| ¿Cómo quieres pagar? (`/payment`) | Volver (cabecera con el logo) | Atrás; sin historial → `/premium` | `/premium` | OK |
| ¿Cómo quieres pagar? (`/payment`) | «Cambiar» (resumen del plan) | Vuelve a elegir plan | `/premium` | OK |
| ¿Cómo quieres pagar? (`/payment`) | «Pagar con Apple» (iPhone) / «Pagar con Google Play» (Android) | Crea la cuenta si hace falta (sin teléfono) → hoja oficial de la tienda → comprobación en el servidor | `/premium-success?plan=<id>` | OK |
| ¿Cómo quieres pagar? (`/payment`) | «Pagar con tarjeta» (Visa, Mastercard…; solo donde las tiendas lo permiten) | — | `/payment-card?plan=<id>` | OK |
| ¿Cómo quieres pagar? (`/payment`) | «Restaurar compra» | Igual que en planes | `/premium-success?status=restored` | OK |
| ¿Cómo quieres pagar? (`/payment`) | «Condiciones de suscripción» / «Política de privacidad» | — | `/legal?section=subscription` · `/legal?section=privacy` | OK |
| ¿Cómo quieres pagar? (`/payment`) | Con Premium · «Ver mi suscripción» | Nunca se cobra dos veces | `/premium` | OK |
| ¿Cómo quieres pagar? (`/payment`) | Con Premium · «Volver al inicio» | — | `/(tabs)` | OK |
| ¿Cómo quieres pagar? (`/payment`) | Plan no disponible · «Ver los planes» | — | `/premium` | OK |
| ¿Cómo quieres pagar? (`/payment`) | «Continuar con mi teléfono» (aviso sin cuentas sin teléfono) | — | `/login` → `/premium?plan=<id>` | OK |
| ¿Cómo quieres pagar? (`/payment`) | Reintentar (error) | Recarga | — | OK |
| Pago con tarjeta (Stripe) (`/payment-card`) | Volver (cabecera con el logo) | Atrás; sin historial → `/premium` | `/payment` | OK |
| Pago con tarjeta (Stripe) (`/payment-card`) | «Pagar 39,99 €» (el importe del plan) | Aviso obligatorio de la tienda (UE/EEE) → `create-checkout` → página segura de Stripe dentro de la app (la tarjeta se escribe allí; «Guardar tarjeta» para renovaciones) → espera la activación | `/premium-success?plan=<id>` | OK |
| Pago con tarjeta (Stripe) (`/payment-card`) | Con Premium · «Ver mi suscripción» / «Volver al inicio» | — | `/premium` · `/(tabs)` | OK |
| Pago con tarjeta (Stripe) (`/payment-card`) | Sin pago con tarjeta para este plan · «Ver los planes» | — | `/premium` | OK |
| Pago con tarjeta (Stripe) (`/payment-card`) | Reintentar (error) | Recarga | — | OK |
| ¡Bienvenido a MediClaro Premium! (`/premium-success`) | «Continuar» | Cuenta sin teléfono → completar la cuenta; con teléfono → Inicio | `/complete-account` · `/(tabs)` | OK |
| ¡Bienvenido a MediClaro Premium! (`/premium-success`) | Pendiente · «Comprobar de nuevo» | Reenvía las compras pendientes y consulta (10 s) | — | OK |
| ¡Bienvenido a MediClaro Premium! (`/premium-success`) | Pendiente · «Seguir más tarde» | La activación sigue sola | `/(tabs)` | OK |
| Completa tu cuenta (teléfono después del pago) (`/complete-account`) | Volver (cabecera con el logo) | Atrás; sin historial → Inicio | anterior | OK |
| Completa tu cuenta (teléfono después del pago) (`/complete-account`) | Prefijo «🇪🇸 +34» | Selector de país | hoja de países | OK |
| Completa tu cuenta (teléfono después del pago) (`/complete-account`) | Campo «Número de teléfono» | Número nacional; «Hecho» = Continuar | — | OK |
| Completa tu cuenta (teléfono después del pago) (`/complete-account`) | «Continuar» | Valida → `requestPhoneLink` (SMS al número) | `/verify?phone=…&purpose=link` | OK |
| Completa tu cuenta (teléfono después del pago) (`/complete-account`) | «Ahora no» | Se puede completar después desde Perfil | `/(tabs)` | OK |
| Vuelta del pago con tarjeta (`/payment-result`) | Volver | back / Inicio | anterior | OK |
| Vuelta del pago con tarjeta (`/payment-result`) | (automático) pago confirmado | — | `/premium-success` | OK |
| Vuelta del pago con tarjeta (`/payment-result`) | «Comprobar de nuevo» (pendiente / sin pago) | Espera la confirmación (10 s) | — | OK |
| Vuelta del pago con tarjeta (`/payment-result`) | «Volver al inicio» | — | `/(tabs)` | OK |
| Vuelta del pago con tarjeta (`/payment-result`) | «Volver a Premium» (cancelado) | — | `/premium` | OK |
| Vuelta del pago con tarjeta (`/payment-result`) | «Ver Premium» (sin pago) | — | `/premium` | OK |
| Vuelta del pago con tarjeta (`/payment-result`) | Reintentar (error) | vuelve a consultar | — | OK |
| Perfil y ajustes (pestaña) (`/profile`) | Aviso «Completa tu cuenta» · «Añadir mi teléfono» (cuenta creada al pagar, sin teléfono) | — | `/complete-account` | OK |
| Perfil y ajustes (pestaña) (`/profile`) | Tarjeta de usuario (avatar, nombre, teléfono o «Sin teléfono · completa tu cuenta») | push | /account | OK |
| Perfil y ajustes (pestaña) (`/profile`) | MediClaro Premium (Activo / Mejorar) · sin compras: «Tu plan» (Premium / Gratuito) | push | /premium | OK |
| Perfil y ajustes (pestaña) (`/profile`) | Tamaño del texto (valor) | push | /accessibility | OK |
| Perfil y ajustes (pestaña) (`/profile`) | Modo fácil (interruptor) | `setEasyMode` | — | OK |
| Perfil y ajustes (pestaña) (`/profile`) | Idioma (Español) | push | /language | OK |
| Perfil y ajustes (pestaña) (`/profile`) | Notificaciones | push | /notifications | OK |
| Perfil y ajustes (pestaña) (`/profile`) | Privacidad y datos | push | /privacy | OK |
| Perfil y ajustes (pestaña) (`/profile`) | Ayuda | push | /help | OK |
| Perfil y ajustes (pestaña) (`/profile`) | Mi perfil de emergencia | push | /emergency-profile | OK |
| Perfil y ajustes (pestaña) (`/profile`) | Número privado de asistencia | push | /private-assistance | OK |
| Perfil y ajustes (pestaña) (`/profile`) | Qué compartir en una emergencia | push | /emergency-sharing | OK |
| Perfil y ajustes (pestaña) (`/profile`) | Información legal | push | /legal | OK |
| Perfil y ajustes (pestaña) (`/profile`) | Cerrar sesión (rojo) | Confirma → `signOut()` | `/welcome` | OK |
| Perfil y ajustes (pestaña) (`/profile`) | Tirar para refrescar | refresca perfil y suscripción | — | OK |
| Datos de cuenta (`/account`) | ← Volver | back | Perfil | OK |
| Datos de cuenta (`/account`) | Editar (nombre) | abre el campo | — | OK |
| Datos de cuenta (`/account`) | Campo "Tu nombre" | validación en línea (vacío, < 2, > 60) | — | OK |
| Datos de cuenta (`/account`) | Guardar | `ProfileService.updateProfile({ displayName })` | — | OK |
| Datos de cuenta (`/account`) | Cancelar | cierra la edición | — | OK |
| Datos de cuenta (`/account`) | Plan (Premium / Gratuito) | push | /premium | OK (uso del mes también con Premium: «incluidas este mes») |
| Datos de cuenta (`/account`) | Descargar mis datos | `exportData()` → `shareOrDownloadText('mediclaro-mis-datos.json', …)` + alerta | archivo JSON | OK |
| Datos de cuenta (`/account`) | Cerrar sesión | confirmación → `signOut()` → bienvenida | `/welcome` | OK |
| Datos de cuenta (`/account`) | Eliminar mi cuenta | 2 confirmaciones → `deleteAccount()` → alerta → bienvenida | `/welcome` | OK (en demo: aviso de que no hay cuenta real) |
| Datos de cuenta (`/account`) | Reintentar (ErrorState) | recarga | — | OK |
| Accesibilidad (`/accessibility`) | ← Volver | back | anterior | OK |
| Accesibilidad (`/accessibility`) | Normal / Grande / Muy grande (tarjetas radio con "Aa") | `setFontSize` | — | OK |
| Accesibilidad (`/accessibility`) | Ajustar Modo fácil (aviso, solo con Modo fácil activo) | push | /easy-mode | OK |
| Accesibilidad (`/accessibility`) | Alto contraste (interruptor) | `setHighContrast` | — | OK |
| Accesibilidad (`/accessibility`) | Modo fácil (Activado/Desactivado) | push | /easy-mode | OK |
| Accesibilidad (`/accessibility`) | Más lento / Normal / Más rápido | `setSpeechRate(0.7 / 0.85 / 1.0)` | — | OK |
| Accesibilidad (`/accessibility`) | Probar voz / Detener | `useSimpleSpeech` a la velocidad elegida | — | OK |
| Modo fácil (`/easy-mode`) | ← Volver | back | anterior | OK |
| Modo fácil (`/easy-mode`) | Activar Modo fácil (tarjeta interruptor) | `setEasyMode` | — | OK |
| Modo fácil (`/easy-mode`) | Ir al Inicio para verlo (solo activado) | `router.replace('/(tabs)')` | Inicio | OK |
| Idioma (`/language`) | Volver (flecha) | Atrás; sin historial → `/(tabs)/profile` | Perfil | OK |
| Idioma (`/language`) | Fila "Español ✓" | No pulsable (única opción disponible) | — | Informativo |
| Notificaciones (`/notifications`) | ← Volver | back | Perfil | OK |
| Notificaciones (`/notifications`) | Avisos de tu cuenta / Avisos de seguridad de tus medicamentos / Consejos (interruptores) | `updatePreferences` optimista y en cola; revierte y avisa si falla | — | OK (se guardan en el teléfono: el backend aún no envía avisos) |
| Notificaciones (`/notifications`) | Reintentar (ErrorState) | recarga | — | OK |
| Privacidad y datos (`/privacy`) | ← Volver | back | Perfil | OK |
| Privacidad y datos (`/privacy`) | Abrir ajustes del teléfono | `openAppSettings()`; si falla → alerta con instrucciones | Ajustes del sistema | OK |
| Privacidad y datos (`/privacy`) | «Retirar el permiso» (tarjeta «Inteligencia artificial», con permiso: «Has dado permiso el …») | Confirmación → deja de enviarse nada a la IA; queda registrado con fecha («Has retirado el permiso el …») | — | OK |
| Privacidad y datos (`/privacy`) | «Dar el permiso» (tarjeta «Inteligencia artificial», sin permiso o retirado) | Concede y lo registra con fecha | — | OK |
| Privacidad y datos (`/privacy`) | «Más información» (permiso de IA) | push | /legal?section=ai | OK |
| Privacidad y datos (`/privacy`) | Descargar mis datos | helper compartido (`accountActions.ts`): datos del servidor + perfil de emergencia + lo que solo está en el teléfono (`dataOnThisPhone`) | archivo JSON | OK |
| Privacidad y datos (`/privacy`) | Qué compartir en una emergencia | push | /emergency-sharing | OK |
| Privacidad y datos (`/privacy`) | Política de privacidad | push | /legal?section=privacy | OK |
| Privacidad y datos (`/privacy`) | Eliminar mi cuenta | helper compartido (2 confirmaciones) | `/welcome` | OK |
| Ayuda (`/help`) | Volver (flecha) | Atrás; sin historial → Inicio (con sesión) o `/` | — | OK |
| Ayuda (`/help`) | 8 preguntas desplegables (flecha que gira, `expanded`) | Abrir / cerrar la respuesta. Sin compras en la app (versión de tienda), «¿Qué incluye Premium y cómo lo cancelo?» se sustituye por «¿Cuántas identificaciones puedo hacer?» (remite a Perfil → Tu plan) | — | OK |
| Ayuda (`/help`) | "Ver el tutorial otra vez" | — | `/onboarding` | OK |
| Ayuda (`/help`) | "Escribir a soporte" | `composeEmail(SUPPORT_EMAIL, 'Ayuda con MediClaro')` | App de correo | OCULTO: falta `EXPO_PUBLIC_SUPPORT_EMAIL` (INFORMACIÓN NECESARIA) |
| Ayuda (`/help`) | "Información legal" | — | `/legal` | OK |
| Información legal (`/legal`) | Volver (flecha) | Atrás; sin historial → Inicio o `/` | — | OK |
| Información legal (`/legal`) | Tarjeta "Aviso médico" (`medical`) | Abrir / cerrar | — | OK |
| Información legal (`/legal`) | Tarjeta "Origen de la información" (`sources`) | Abrir / cerrar | — | OK |
| Información legal (`/legal`) | "Abrir CIMA" | `openExternalUrl('https://cima.aemps.es')` | Navegador | OK |
| Información legal (`/legal`) | Tarjeta "Uso de inteligencia artificial" (`ai`) | Abrir / cerrar: qué se envía a Gemini (Google), con permiso previo, conservación de 55 días solo contra abusos y cómo retirar el permiso | — | OK |
| Información legal (`/legal`) | Tarjeta "Condiciones de uso" (`terms`) | Abrir / cerrar | — | OK |
| Información legal (`/legal`) | "Leer las Condiciones de uso" | `openExternalUrl(LEGAL_URLS.terms)` | Navegador | PENDIENTE: sin URL → fila NO pulsable "Pendiente de publicación" |
| Información legal (`/legal`) | Tarjeta "Política de privacidad" (`privacy`) | Abrir / cerrar | — | OK |
| Información legal (`/legal`) | "Leer la Política de privacidad" | `openExternalUrl(LEGAL_URLS.privacy)` | Navegador | PENDIENTE (igual) |
| Información legal (`/legal`) | Tarjeta "Aviso legal" (`notice`) + datos del titular (`COMPANY_INFO`) | Abrir / cerrar | — | OK · titular vacío → no se muestra |
| Información legal (`/legal`) | "Leer el Aviso legal" | `openExternalUrl(LEGAL_URLS.legalNotice)` | Navegador | PENDIENTE (igual) |
| Emergencia (principal) (`/emergency`) | Flecha «Volver» | `router.back()`; sin historial → `/` | anterior o `/` | OK |
| Emergencia (principal) (`/emergency`) | «Llamar al 112» (rojo) | `EmergencyService.callOfficialEmergency()`; si la config remota tarda >1,5 s marca el 112 con `callPhone`. Con sesión: `EmergencySession.start('unsure')` + `callStarted('official')`. Si falla: aviso «No se ha podido abrir el teléfono · Marca el 112 desde tu teléfono.» | marcador; con sesión → `/emergency/in-call?target=official` | OK |
| Emergencia (principal) (`/emergency`) | «Llamar a {servicio}» (azul contorno; con sesión y servicio) | `EmergencySession.start('unsure')` | `/emergency/calling` | OK |
| Emergencia (principal) (`/emergency`) | «Asistente de emergencia» (con sesión) | — | `/emergency/confirm` | OK |
| Emergencia (principal) (`/emergency`) | Fila «Instituto Nacional de Toxicología · 91 562 04 20» | `callPhone('915620420')` (si falla, aviso) | marcador | OK |
| Emergencia (principal) (`/emergency`) | Fila «Tu médico de cabecera» (si hay teléfono) | `callPhone` | marcador | OK (dato solo en el teléfono) |
| Emergencia (principal) (`/emergency`) | Fila «{familiar} ({relación})» | `callPhone` | marcador | OK (demo: no marca, aviso) |
| Emergencia (principal) (`/emergency`) | Fila «Prepara tu perfil de emergencia» (perfil vacío) | — | `/emergency-profile` | OK |
| Emergencia · Confirmación (`/emergency/confirm`) | Flecha «Volver» | back; sin historial → `/emergency` | anterior | OK |
| Emergencia · Confirmación (`/emergency/confirm`) | «Sí, puedo hablar» | `EmergencySession.start('can_speak')` | `/emergency/assistant?mode=can_speak` | OK |
| Emergencia · Confirmación (`/emergency/confirm`) | «No puedo hablar» | `start('cannot_speak')` | `/emergency/prepared` | OK |
| Emergencia · Confirmación (`/emergency/confirm`) | «No estoy seguro» | `start('unsure')` | `/emergency/assistant?mode=unsure` | OK |
| Emergencia · Confirmación (`/emergency/confirm`) | «Llamar al 112 ahora» (rojo, pie) | 112 como arriba + `callStarted('official')` | `/emergency/in-call?target=official` | OK |
| Emergencia · Confirmación (`/emergency/confirm`) | «Cancelar» | `EmergencySession.finish()` | back (o `/emergency`) | OK |
| Emergencia · Asistente (escuchando) (`/emergency/assistant`) | Flecha «Volver» | back; sin historial → `/emergency/confirm` | anterior | OK |
| Emergencia · Asistente (escuchando) (`/emergency/assistant`) | 7 chips (medicamento equivocado, medicación de más, mareo/malestar, dolor en el pecho, me cuesta respirar, no puedo hablar bien, otra situación) | `EmergencySession.toggleSymptom(id)` (rojo al marcar) | — | OK |
| Emergencia · Asistente (escuchando) (`/emergency/assistant`) | Tocar cualquier punto | reinicia el temporizador de inactividad; si había «¿Sigues ahí?» → `markResponsive()` | — | OK |
| Emergencia · Asistente (escuchando) (`/emergency/assistant`) | «Estoy aquí» (tras 60 s sin toques) | `EmergencySession.markResponsive()` | — | OK (nunca llama a nadie) |
| Emergencia · Asistente (escuchando) (`/emergency/assistant`) | «Preparar mi información» | — (si vino de «Tu información», vuelve a ella) | `/emergency/prepared` | OK |
| Emergencia · Asistente (escuchando) (`/emergency/assistant`) | «Llamar al 112 ahora» (rojo) | 112 | `/emergency/in-call?target=official` | OK |
| Emergencia · Información preparada (`/emergency/prepared`) | Flecha «Volver» | back; sin historial → `/emergency` | anterior | OK |
| Emergencia · Información preparada (`/emergency/prepared`) | «Actualizar» | `EmergencySession.prepare(true)` | — | OK |
| Emergencia · Información preparada (`/emergency/prepared`) | «Completar mi perfil» (perfil vacío) | — | `/emergency-profile-edit` | OK |
| Emergencia · Información preparada (`/emergency/prepared`) | «Ver en el mapa» (con GPS) | `openMaps(lat,lng)` (si falla, aviso) | app de mapas | OK |
| Emergencia · Información preparada (`/emergency/prepared`) | «Activar ubicación» (sin GPS) | `openAppSettings()` (si falla, aviso con instrucciones) | ajustes del sistema | OK |
| Emergencia · Información preparada (`/emergency/prepared`) | «Reintentar» (sin GPS) | `prepare(true)` | — | OK |
| Emergencia · Información preparada (`/emergency/prepared`) | «Cambiar qué se comparte» (si algo no se comparte) | — | `/emergency-sharing` | OK |
| Emergencia · Información preparada (`/emergency/prepared`) | «Indicar / Cambiar lo que te pasa» | — | `/emergency/assistant?mode=…&from=prepared` | OK |
| Emergencia · Información preparada (`/emergency/prepared`) | «Configurarlo» (sin servicio privado) | — | `/private-assistance` | OK |
| Emergencia · Información preparada (`/emergency/prepared`) | «Escuchar el mensaje para el operador» | — | `/emergency/voice-message` | OK |
| Emergencia · Información preparada (`/emergency/prepared`) | «Avisar a {nombre}» (si hay mensaje para el contacto) | — | `/emergency/notify` | OK |
| Emergencia · Información preparada (`/emergency/prepared`) | «Llamar a {servicio}» (azul, pie) | — | `/emergency/calling` | OK |
| Emergencia · Información preparada (`/emergency/prepared`) | «Llamar al 112» (rojo, pie) | 112 | `/emergency/in-call?target=official` | OK |
| Emergencia · Información preparada (`/emergency/prepared`) | «Reintentar» (error) | `prepare(true)` | — | OK |
| Emergencia · Cuenta atrás / preparación (`/emergency/calling`) | Flecha «Volver» | back (la cuenta atrás se detiene; no llama) | anterior | OK |
| Emergencia · Cuenta atrás / preparación (`/emergency/calling`) | Cuenta atrás 5 s | `EmergencyService.callPrivateAssistance()`: success → `callStarted('private')`; failed → `callStarted` + `callNotAnswered()`; not_configured → estado sin servicio | `/emergency/in-call?target=private` · `/emergency/no-answer?reason=failed` | OK |
| Emergencia · Cuenta atrás / preparación (`/emergency/calling`) | «Llamar ya» | igual que la cuenta atrás, sin esperar | igual | OK |
| Emergencia · Cuenta atrás / preparación (`/emergency/calling`) | «Cancelar» | detiene la cuenta atrás | back (o `/emergency`) | OK |
| Emergencia · Cuenta atrás / preparación (`/emergency/calling`) | «Prefiero llamar al 112» (rojo suave) | detiene; 112 | `/emergency/in-call?target=official` (replace) | OK |
| Emergencia · Cuenta atrás / preparación (`/emergency/calling`) | «Configurarlo» (sin servicio) | — | `/private-assistance` | OK |
| Emergencia · Cuenta atrás / preparación (`/emergency/calling`) | «Llamar al 112» (sin servicio) | 112 | in-call official | OK |
| Emergencia · Llamada en curso (`/emergency/in-call`) | Flecha «Volver» (blanca) | back | anterior | OK |
| Emergencia · Llamada en curso (`/emergency/in-call`) | «Llamar al 112» (solo destino privado) | 112 | in-call official (replace) | OK |
| Emergencia · Llamada en curso (`/emergency/in-call`) | «Mensaje» | — | `/emergency/voice-message` | OK |
| Emergencia · Llamada en curso (`/emergency/in-call`) | «Mi información» | — | `/emergency/prepared` | OK |
| Emergencia · Llamada en curso (`/emergency/in-call`) | «Avisar familiar» (si hay contacto) | — | `/emergency/notify` | OK |
| Emergencia · Llamada en curso (`/emergency/in-call`) | «Volver a llamar» (azul privado / rojo 112) | privado: `callPrivateAssistance()` + `callStarted` (not_configured → `/emergency/calling`, failed → aviso); 112: `callOfficialEmergency()` | marcador | OK |
| Emergencia · Llamada en curso (`/emergency/in-call`) | «Sí, me han atendido» | `callAnswered()` | `/emergency/call-done?target=…` (replace) | OK |
| Emergencia · Llamada en curso (`/emergency/in-call`) | «No contestan» | privado: `callNotAnswered()`; 112: muestra «Vuelve a intentarlo» | privado → `/emergency/no-answer` (replace); 112 → misma pantalla | OK |
| Emergencia · Llamada en curso (`/emergency/in-call`) | «Volver a llamar al 112» (112 sin respuesta) | `callOfficialEmergency()` | marcador | OK |
| Emergencia · Sin respuesta del servicio privado (`/emergency/no-answer`) | Flecha «Volver» | back | anterior | OK |
| Emergencia · Sin respuesta del servicio privado (`/emergency/no-answer`) | «Volver a llamar a {servicio}» (azul) | `callPrivateAssistance()` → `callStarted('private')` (failed → aviso; not_configured → calling) | `/emergency/in-call?target=private` (replace) | OK |
| Emergencia · Sin respuesta del servicio privado (`/emergency/no-answer`) | «Llamar al 112» (sección roja «¿Es grave o no mejora?») | 112 (decisión explícita) | in-call official (replace) | OK |
| Emergencia · Sin respuesta del servicio privado (`/emergency/no-answer`) | «Avisar a {nombre}» | — | `/emergency/notify` | OK |
| Emergencia · Sin respuesta del servicio privado (`/emergency/no-answer`) | «Escuchar el mensaje para el operador» | — | `/emergency/voice-message` | OK |
| Emergencia · Sin respuesta del servicio privado (`/emergency/no-answer`) | «Ver mi información» | — | `/emergency/prepared` | OK |
| Emergencia · Sin respuesta del servicio privado (`/emergency/no-answer`) | «Terminar y volver al inicio» | `confirmAsync` → `finish()` | Inicio `/(tabs)` | OK |
| Emergencia · Confirmación posterior (`/emergency/call-done`) | Flecha «Volver» | `confirmAsync` → `finish()` | Inicio | OK |
| Emergencia · Confirmación posterior (`/emergency/call-done`) | «Ver mi información» | — | `/emergency/prepared` | OK |
| Emergencia · Confirmación posterior (`/emergency/call-done`) | «Avisar a familiar» (si hay contacto) | — | `/emergency/notify` | OK |
| Emergencia · Confirmación posterior (`/emergency/call-done`) | «Llamar al 112» / «Volver a llamar al 112» (rojo suave) | 112 | in-call official (replace) | OK |
| Emergencia · Confirmación posterior (`/emergency/call-done`) | «Volver al inicio» | `finish()` | Inicio (`dismissTo`; si no está en la pila, se abre) | OK |
| Emergencia · Avisar a familiar/cuidador (`/emergency/notify`) | Flecha «Volver» | back | anterior | OK |
| Emergencia · Avisar a familiar/cuidador (`/emergency/notify`) | «Enviar mensaje a {nombre}» → «Enviar otro aviso» | `EmergencyService.notifyCaregiver(report)` → ok: `caregiverNotified()` + aviso verde; error: aviso rojo | app de Mensajes con el texto (la persona pulsa Enviar) | OK (demo: no se envía SMS, aviso) |
| Emergencia · Avisar a familiar/cuidador (`/emergency/notify`) | «Llamar a {nombre}» | `callPhone` | marcador | OK (demo: no marca, aviso) |
| Emergencia · Avisar a familiar/cuidador (`/emergency/notify`) | «Cambiar permisos» (aviso desactivado) | — | `/emergency-sharing` | OK |
| Emergencia · Avisar a familiar/cuidador (`/emergency/notify`) | «Completar mi perfil» (contacto sin teléfono) | — | `/emergency-profile-edit` | OK |
| Emergencia · Avisar a familiar/cuidador (`/emergency/notify`) | «Añadir contacto» (sin contacto) | — | `/emergency-profile-edit` | OK |
| Emergencia · Avisar a familiar/cuidador (`/emergency/notify`) | «Llamar al 112» (rojo suave, pie) | 112 | in-call official | OK |
| Emergencia · Avisar a familiar/cuidador (`/emergency/notify`) | «Reintentar» (error) | `prepare(true)` | — | OK |
| Emergencia · Mensaje para el operador (`/emergency/voice-message`) | Flecha «Volver» | back (la voz se detiene) | anterior | OK |
| Emergencia · Mensaje para el operador (`/emergency/voice-message`) | Botón redondo «Reproducir / Detener el mensaje» | `useSimpleSpeech().speak('op', voiceMessage, 0.8)` / `stop()` (onda activa) | — | OK |
| Emergencia · Mensaje para el operador (`/emergency/voice-message`) | «Llamar al 112» (rojo, pie) | detiene la voz; 112 | in-call official | OK |
| Emergencia · Mensaje para el operador (`/emergency/voice-message`) | «Reintentar» (error) | `prepare(true)` | — | OK |
| Perfil de emergencia (`/emergency-profile`) | Volver (flecha) | Atrás; sin historial → `/(tabs)` | Inicio | OK |
| Perfil de emergencia (`/emergency-profile`) | "Editar" (cabecera) | — | `/emergency-profile-edit` | OK |
| Perfil de emergencia (`/emergency-profile`) | "Medicamentos habituales · N ⌄" | Despliega / oculta la lista | — | OK (no pulsable si no hay medicamentos) |
| Perfil de emergencia (`/emergency-profile`) | Llamar al médico de cabecera (icono) | `callPhone(teléfono)` | Marcador | OK · solo si hay teléfono (en demostración avisa y no marca) |
| Perfil de emergencia (`/emergency-profile`) | Llamar al contacto de emergencia (icono) | `callPhone(teléfono)` | Marcador | OK · ídem |
| Perfil de emergencia (`/emergency-profile`) | Mini mapa / "Ver en el mapa" | `openAddressInMaps(dirección completa)` | App de mapas | OK · solo si hay dirección |
| Perfil de emergencia (`/emergency-profile`) | "Qué compartir en una emergencia" | — | `/emergency-sharing` | OK |
| Perfil de emergencia (`/emergency-profile`) | "Número privado de asistencia" | — | `/private-assistance` | OK |
| Perfil de emergencia (`/emergency-profile`) | "Borrar mi perfil de emergencia" (rojo, al final) | Confirmación destructiva → borra la fila del servidor, la copia cifrada del teléfono y el médico guardado en el teléfono. No elimina la cuenta | Estado vacío ("Aún no has preparado tu perfil de emergencia") | OK · si falla, aviso y no se borra nada |
| Perfil de emergencia (`/emergency-profile`) | "Crear mi perfil" (estado vacío) | — | `/emergency-profile-edit` | OK |
| Perfil de emergencia (`/emergency-profile`) | "Reintentar" (estado error) | `reload()` | — | OK |
| Perfil de emergencia (`/emergency-profile`) | Deslizar hacia abajo | `refresh()` | — | OK |
| Editar perfil de emergencia (`/emergency-profile-edit`) | Volver (flecha) | Con cambios: `confirmAsync('¿Salir sin guardar?', destructive)`; sin cambios: sale | Atrás o `/emergency-profile` | OK · también botón atrás de Android; gesto de iOS desactivado con cambios |
| Editar perfil de emergencia (`/emergency-profile-edit`) | Nombre y apellidos* · Fecha de nacimiento (DD/MM/AAAA, barras automáticas) | Validación en línea al guardar | — | OK |
| Editar perfil de emergencia (`/emergency-profile-edit`) | Calle y número · Código postal (5 cifras) · Ciudad · Provincia · País ("España") | — | — | OK |
| Editar perfil de emergencia (`/emergency-profile-edit`) | Medicamentos habituales (varias líneas) · Alergias · Enfermedades relevantes | — | — | OK |
| Editar perfil de emergencia (`/emergency-profile-edit`) | Chips grupo sanguíneo A+ A− B+ B− AB+ AB− 0+ 0− "No lo sé" | Seleccionar / quitar | — | OK |
| Editar perfil de emergencia (`/emergency-profile-edit`) | Nombre del médico · Teléfono del médico ("Se guarda solo en este teléfono") | — | — | OK |
| Editar perfil de emergencia (`/emergency-profile-edit`) | Nombre del contacto · chips Hija/Hijo/Pareja/Hermana/Hermano/Amistad/Otra (+ texto si "Otra") · Teléfono del contacto | — | — | OK |
| Editar perfil de emergencia (`/emergency-profile-edit`) | "Guardar" | `EmergencyService.updateEmergencyProfile(input)` (conserva `permissions`) → `showAlert` → atrás | `/emergency-profile` | OK · `synced=false` → muestra el mensaje del servicio |
| Editar perfil de emergencia (`/emergency-profile-edit`) | "Reintentar" (error de carga) | `reload()` | — | OK |
| Permisos para compartir información (`/emergency-sharing`) | Volver (flecha) | Atrás; sin historial → `/emergency-profile` | Perfil de emergencia | OK |
| Permisos para compartir información (`/emergency-sharing`) | 7 interruptores (ubicación, dirección y datos personales, medicamentos, alergias, enfermedades y datos médicos, conversación previa, avisar al contacto) | `EmergencyService.updateSharingPermissions` al momento (optimista, en orden; si falla vuelve atrás y avisa) | — | OK |
| Permisos para compartir información (`/emergency-sharing`) | "Reintentar" (error) | `reload()` | — | OK |
| Número privado de asistencia (`/private-assistance`) | Volver (flecha) | Atrás; sin historial → `/emergency-profile` | Perfil de emergencia | OK |
| Número privado de asistencia (`/private-assistance`) | "Cambiar" (servicio propio) | Abre el formulario relleno | — | OK |
| Número privado de asistencia (`/private-assistance`) | "Quitar" (servicio propio) | `confirmAsync` → `clearPrivateAssistanceService()` | — | OK |
| Número privado de asistencia (`/private-assistance`) | "Usar otro número" (central de MediClaro) | Abre el formulario vacío | — | OK |
| Número privado de asistencia (`/private-assistance`) | "Nombre del servicio" · "Teléfono" | — | — | OK |
| Número privado de asistencia (`/private-assistance`) | "Guardar" | `setPrivateAssistanceService({name, phone})`; `invalid_input` en línea (p. ej. 112) | — | OK |
| Número privado de asistencia (`/private-assistance`) | "Cancelar" (si ya hay un número) | Cierra el formulario | — | OK |
| Número privado de asistencia (`/private-assistance`) | "Reintentar" (error) | `reload()` | — | OK |
| Pantalla no encontrada (`+not-found`) | Volver (flecha) | Atrás; sin historial → `/` | Inicio / bienvenida | OK |
| Pantalla no encontrada (`+not-found`) | "Volver al inicio" | `router.replace('/')` | Inicio (con sesión) o bienvenida | OK |
| Elementos globales | Barra inferior "Inicio" | Pestaña | `/(tabs)` | OK |
| Elementos globales | Barra inferior "Mis meds" | Pestaña | `/(tabs)/medicines` | OK |
| Elementos globales | Barra inferior "Asistente" | Pestaña | `/(tabs)/chat` | OK |
| Elementos globales | Barra inferior "Perfil" | Pestaña | `/(tabs)/profile` | OK |
| Elementos globales | Franja amarilla "Modo demostración · Salir" / "Acceso de prueba · Salir" (solo compilaciones de prueba) | Confirma y cierra la sesión | `/welcome` | OK |
| Elementos globales | "Volver" (flecha de la cabecera) | Atrás; sin historial → ruta de respaldo de cada pantalla | anterior | OK |
| Elementos globales | Pantalla «Antes de usar la inteligencia artificial» · «Aceptar y continuar» / «Ahora no» | Concede el permiso (registrado) / no envía nada | la misma pantalla | OK |
| Elementos globales | Pantalla bloqueada «… con MediClaro Premium» (identificar, asistente, lectura por voz, añadir y ver medicamentos) · «Ver planes» | — | `/premium` | OK |
| Elementos globales | Pantalla bloqueada · «Volver al inicio» | — | `/(tabs)` (sin sesión: `/welcome`) | OK |
| Elementos globales | Pantalla bloqueada · «¿Es una urgencia? El 112 siempre está disponible» | — | `/emergency` | OK |
| Elementos globales | Hoja «SIMULACIÓN» de la tienda / página de tarjeta simulada (solo compilaciones de prueba sin tienda real) · «Suscribirse» / «Pagar» / «Cancelar» | Simula la compra sin cobrar nada (tarjeta de prueba 4242…) | la pantalla de origen | OK · solo pruebas |
