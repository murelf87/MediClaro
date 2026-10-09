# SCREEN_MAP — MediClaro (iPhone y Android)

Mapa completo de pantallas: **cada pantalla, qué botones llevan a ella** y todos sus controles con su acción y destino.
Generado a partir del inventario de controles de cada pantalla (tablas de la sección 2) y verificado con pruebas de flujo automáticas que pulsan cada control (ver FRONTEND_AUDIT.md).

**Total de rutas:** 49 (48 pantallas visibles + 1 redirección técnica `/subscribe`). `/onboarding` muestra la misma explicación que `/tour`.

Notas de navegación: `/` es el Inicio (pestañas); la bienvenida vive en `/welcome`. Las pestañas son `/`, `/medicines`, `/chat` y `/profile` (en el código `/(tabs)/…`). El asistente con contexto de un medicamento es `/assistant?medicationId=…&medicationName=…`.

**Versión 1.2 (28-09-2026) — pantallas Premium y pago.** Recorrido sin cuenta: `/welcome` → `/tour` → `/premium` → `/payment` (o directamente la hoja de Apple/Google) → `/payment-card` (tarjeta, donde se permite) → `/premium-success` → `/complete-account` (teléfono **después** del pago) → `/verify?purpose=link`. Con compras en la app (`EXPO_PUBLIC_PAYMENTS_MODE` = `store`, `stripe` o `store,stripe`), identificar, el asistente, la lectura por voz y añadir/ver medicamentos son de Premium: sin él, esas rutas muestran la pantalla bloqueada «… con MediClaro Premium» (sección 3); **las emergencias y el 112 nunca se bloquean**. Sin compras (`none`) la app es gratuita como la 1.1 («Tu plan»). Antes de enviar la primera foto o pregunta a la IA aparece la pantalla de permiso «Antes de usar la inteligencia artificial».

## 1. Índice de pantallas

| Nº | Ruta | Pantalla | Archivo | Acceso | Área |
|---|---|---|---|---|---|
| 1 | `/welcome` | Bienvenida «Conocer MediClaro» | `src/screens/premium/WelcomeScreen.tsx` | Pública | Acceso |
| 2 | `/tour` | Explicación (4 pasos, con voz) | `src/screens/premium/TourScreen.tsx` | Pública | Acceso |
| 3 | `/onboarding` | Explicación (ruta antigua, misma pantalla) | `src/screens/premium/TourScreen.tsx` | Pública | Acceso |
| 4 | `/login` | Acceso con teléfono | `src/screens/auth/LoginScreen.tsx` | Pública | Acceso |
| 5 | `/verify` | Código SMS: aviso de envío y consola del código | `src/screens/auth/VerifyScreen.tsx` | Pública | Acceso |
| 6 | `/` | Inicio | `src/screens/home/HomeScreen.tsx` | Con sesión | Principal |
| 7 | `/scan` | Cámara / identificar medicamento | `src/screens/identify/ScanScreen.tsx` | Con sesión | Identificar |
| 8 | `/add-medication` | Añadir medicamento (foto · código de barras · C.N.) | `src/screens/identify/AddMedicationScreen.tsx` | Con sesión | Identificar |
| 9 | `/processing` | Procesando identificación | `src/screens/identify/ProcessingScreen.tsx` | Con sesión | Identificar |
| 10 | `/candidates` | Selección si hay varias coincidencias | `src/screens/identify/CandidatesScreen.tsx` | Con sesión | Identificar |
| 11 | `/result` | Resultado | `src/screens/identify/ResultScreen.tsx` | Con sesión | Identificar |
| 12 | `/medication/[id]` | Ficha completa del medicamento | `src/screens/identify/MedicationDetailScreen.tsx` | Con sesión | Identificar |
| 13 | `/voice` | Lectura en voz alta | `src/screens/identify/VoiceScreen.tsx` | Con sesión | Identificar |
| 14 | `/chat` | Asistente IA (pestaña) | `src/screens/assistant/AssistantTabScreen.tsx` | Con sesión | Asistente |
| 15 | `/assistant` | Asistente IA con contexto de medicamento | `src/screens/assistant/AssistantChatScreen.tsx` | Con sesión | Asistente |
| 16 | `/medicines` | Mis medicamentos (pestaña) | `src/screens/medications/MedicinesScreen.tsx` | Con sesión | Mis medicamentos |
| 17 | `/saved/[id]` | Detalle de medicamento guardado | `src/screens/medications/SavedMedicationScreen.tsx` | Con sesión | Mis medicamentos |
| 18 | `/history` | Historial de identificaciones | `src/screens/medications/HistoryScreen.tsx` | Con sesión | Mis medicamentos |
| 19 | `/premium` | Planes «Más claridad para tu salud» · suscripción activa | `src/screens/premium/PremiumScreen.tsx` | Pública | Premium |
| 20 | `/payment` | ¿Cómo quieres pagar? | `src/screens/premium/PaymentScreen.tsx` | Pública | Premium |
| 21 | `/payment-card` | Pago con tarjeta (Stripe) | `src/screens/premium/CardPaymentScreen.tsx` | Pública | Premium |
| 22 | `/premium-success` | ¡Bienvenido a MediClaro Premium! | `src/screens/premium/PremiumSuccessScreen.tsx` | Con sesión (también sin teléfono) | Premium |
| 23 | `/complete-account` | Completa tu cuenta (teléfono después del pago) | `src/screens/premium/CompleteAccountScreen.tsx` | Con sesión (también sin teléfono) | Premium |
| 24 | `/payment-result` | Vuelta del pago con tarjeta | `src/screens/premium/PaymentResultScreen.tsx` | Con sesión | Premium |
| 25 | `/subscribe` | Enlace heredado → redirección | `src/screens/premium/SubscribeScreen.tsx` | Con sesión | Premium |
| 26 | `/profile` | Perfil y ajustes (pestaña) | `src/screens/profile/ProfileScreen.tsx` | Con sesión | Perfil |
| 27 | `/account` | Datos de cuenta | `src/screens/profile/AccountScreen.tsx` | Con sesión | Perfil |
| 28 | `/accessibility` | Accesibilidad | `src/screens/profile/AccessibilityScreen.tsx` | Con sesión | Perfil |
| 29 | `/easy-mode` | Modo fácil | `src/screens/profile/EasyModeScreen.tsx` | Con sesión | Perfil |
| 30 | `/language` | Idioma | `src/screens/info/LanguageScreen.tsx` | Con sesión | Perfil |
| 31 | `/notifications` | Notificaciones | `src/screens/profile/NotificationsScreen.tsx` | Con sesión | Perfil |
| 32 | `/privacy` | Privacidad y datos | `src/screens/profile/PrivacyScreen.tsx` | Con sesión | Perfil |
| 33 | `/help` | Ayuda | `src/screens/info/HelpScreen.tsx` | Pública | Información |
| 34 | `/legal` | Información legal | `src/screens/info/LegalScreen.tsx` | Pública | Información |
| 35 | `/emergency` | Emergencia (principal) | `src/screens/emergency/EmergencyScreen.tsx` | Pública | Emergencia |
| 36 | `/emergency/confirm` | Emergencia · Confirmación | `src/screens/emergency/EmergencyConfirmScreen.tsx` | Con sesión | Emergencia |
| 37 | `/emergency/assistant` | Emergencia · Asistente (escuchando) | `src/screens/emergency/EmergencyAssistantScreen.tsx` | Con sesión | Emergencia |
| 38 | `/emergency/prepared` | Emergencia · Información preparada | `src/screens/emergency/EmergencyPreparedScreen.tsx` | Con sesión | Emergencia |
| 39 | `/emergency/calling` | Emergencia · Cuenta atrás / preparación | `src/screens/emergency/EmergencyCallingScreen.tsx` | Con sesión | Emergencia |
| 40 | `/emergency/in-call` | Emergencia · Llamada en curso | `src/screens/emergency/EmergencyInCallScreen.tsx` | Con sesión | Emergencia |
| 41 | `/emergency/no-answer` | Emergencia · Sin respuesta del servicio privado | `src/screens/emergency/EmergencyNoAnswerScreen.tsx` | Con sesión | Emergencia |
| 42 | `/emergency/call-done` | Emergencia · Confirmación posterior | `src/screens/emergency/EmergencyCallDoneScreen.tsx` | Con sesión | Emergencia |
| 43 | `/emergency/notify` | Emergencia · Avisar a familiar/cuidador | `src/screens/emergency/EmergencyNotifyScreen.tsx` | Con sesión | Emergencia |
| 44 | `/emergency/voice-message` | Emergencia · Mensaje para el operador | `src/screens/emergency/EmergencyVoiceMessageScreen.tsx` | Con sesión | Emergencia |
| 45 | `/emergency-profile` | Perfil de emergencia | `src/screens/emergencyProfile/EmergencyProfileScreen.tsx` | Con sesión | Emergencia |
| 46 | `/emergency-profile-edit` | Editar perfil de emergencia | `src/screens/emergencyProfile/EmergencyProfileEditScreen.tsx` | Con sesión | Emergencia |
| 47 | `/emergency-sharing` | Permisos para compartir información | `src/screens/emergencyProfile/EmergencySharingScreen.tsx` | Con sesión | Emergencia |
| 48 | `/private-assistance` | Número privado de asistencia | `src/screens/emergencyProfile/PrivateAssistanceScreen.tsx` | Con sesión | Emergencia |
| 49 | `+not-found` | Pantalla no encontrada | `src/screens/auth/NotFoundScreen.tsx` | Pública | Sistema |
| 50 | `/caregiver-chat?link=` | Chat con el cuidador/a (o con el familiar) | `src/screens/caregiver/CareChatScreen.tsx` | Con sesión | Cuidador/a |
| 51 | `/caregiver-call?link=&call=&incoming=` | Llamada de voz | `src/screens/caregiver/CareCallScreen.tsx` | Con sesión | Cuidador/a |
| 52 | `/owner` | Panel: acceso privado «Acceso exclusivo» (código / Face ID) — diseño 1 | `src/screens/owner/OwnerAccessScreen.tsx` | Propietario | Panel |
| 53 | `/owner/dashboard` | Dashboard (panel de administración) — diseño 2 | `src/screens/owner/OwnerHomeScreen.tsx` | Propietario | Panel |
| 54 | `/owner/vouchers` | Bonos Premium gratuitos — diseño 3 | `src/screens/owner/OwnerVouchersScreen.tsx` | Propietario | Panel |
| 55 | `/owner/voucher-new` | Crear bono gratuito (Premium completo / familiar) — diseño 4 | `src/screens/owner/OwnerVoucherNewScreen.tsx` | Propietario | Panel |
| 56 | `/owner/voucher?id=` | Detalle de bono | `src/screens/owner/OwnerVoucherScreen.tsx` | Propietario | Panel |
| 57 | `/owner/grant` | Conceder Premium a usuario — diseño 5 | `src/screens/owner/OwnerGrantScreen.tsx` | Propietario | Panel |
| 58 | `/owner/users` | Usuarios — diseño 6 | `src/screens/owner/OwnerUsersScreen.tsx` | Propietario | Panel |
| 59 | `/owner/user?id=` | Ficha de usuario | `src/screens/owner/OwnerUserScreen.tsx` | Propietario | Panel |
| 60 | `/owner/subscriptions` | Suscripciones — diseño 7 | `src/screens/owner/OwnerSubscriptionsScreen.tsx` | Propietario | Panel |
| 61 | `/owner/stats` | Estadísticas — diseño 9 | `src/screens/owner/OwnerStatsScreen.tsx` | Propietario | Panel |
| 62 | `/owner/audit` | Registro y auditoría — diseño 10 | `src/screens/owner/OwnerAuditScreen.tsx` | Propietario | Panel |
| 63 | `/owner/settings` | Configuración — diseño 8 | `src/screens/owner/OwnerSettingsScreen.tsx` | Propietario | Panel |
| 64 | `/owner/security` | Seguridad (código, Face ID y cerrar el panel) | `src/screens/owner/OwnerSecurityScreen.tsx` | Propietario | Panel |
| 65 | `/owner/notice` | Notificaciones (aviso en la app) | `src/screens/owner/OwnerNoticeScreen.tsx` | Propietario | Panel |
| 66 | `/owner/backup` | Respaldos (exportar CSV) | `src/screens/owner/OwnerBackupScreen.tsx` | Propietario | Panel |
| 67 | `/owner/system` | Mantenimiento · Estado del sistema | `src/screens/owner/OwnerSystemScreen.tsx` | Propietario | Panel |
| 68 | `/owner/account` | Mi cuenta — diseño 11 | `src/screens/owner/OwnerAccountScreen.tsx` | Propietario | Panel |
| 69 | `/owner/info` | Acceso privado del propietario (información) — diseño 12 | `src/screens/owner/OwnerInfoScreen.tsx` | Propietario | Panel |
| 70 | `/owner-dashboard` | Ruta antigua → acceso privado | `app/owner-dashboard.tsx` | Propietario | Panel |

## 2. Pantallas: cómo se llega y qué hace cada control

### 1. `/welcome` — Bienvenida «Conocer MediClaro»

Archivo: `src/screens/premium/WelcomeScreen.tsx` · Acceso: Pública

**Se llega desde:**

- Apertura de la app sin sesión (redirección automática)
- `/profile`, `/account`, `/privacy` → **Cerrar sesión** / **Eliminar mi cuenta**
- Cuenta creada al pagar que aún no tiene Premium (pago cancelado o pendiente) al abrir la app
- `/tour` Explicación (4 pasos, con voz) → **Flecha atrás (cabecera)**
- `/processing` Procesando identificación → **Sesión caducada · «Volver a entrar»**
- `/premium` Planes «Más claridad para tu salud» · suscripción activa → **Volver (cabecera con el logo)**
- `/profile` Perfil y ajustes (pestaña) → **Cerrar sesión (rojo)**
- Elementos globales (en varias pantallas) → **Franja amarilla "Modo demostración · Salir" / "Acceso de prueba · Salir" (solo compilaciones de prueba)**
- Elementos globales (en varias pantallas) → **Pantalla bloqueada · «Volver al inicio»**
- `/login` Acceso con teléfono → **Volver (flecha)**
- `/account` Datos de cuenta → **Cerrar sesión**
- `/account` Datos de cuenta → **Eliminar mi cuenta**
- `/privacy` Privacidad y datos → **Eliminar mi cuenta**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| «Aa» (arriba a la derecha) | Cambia el tamaño de la letra (Normal → Grande → Muy grande) al momento | — | OK |
| «Conocer MediClaro» (botón azul con latido suave) | Abre la explicación | `/tour` | OK |
| «Ya soy Premium» (sin compras en la app: «Entrar con mi teléfono») | Entrar con el teléfono | `/login` | OK |
| «Restaurar compra» (solo con compras en la app) | `PurchaseService.restore()` → si hay compra de la tienda o Premium en la cuenta: confirmación; si no: aviso «No hemos encontrado ninguna compra» | `/premium-success?status=restored` | OK |
| «¿Es una urgencia? Pulsa aquí» (rojo) | Abre la emergencia (pública, sin cuenta) | `/emergency` | OK |

Estados: carga de sesión (logo); con sesión y teléfono → Inicio; cuenta sin teléfono creada al pagar sin Premium → se queda aquí; con Premium → Inicio. Guía (personaje) con halo y movimiento suave; 5 funciones con icono; texto «Muy grande» sin desbordes.

### 2. `/tour` — Explicación (4 pasos, con voz)

Archivo: `src/screens/premium/TourScreen.tsx` · Acceso: Pública

**Se llega desde:**

- `/welcome` Bienvenida «Conocer MediClaro» → **«Conocer MediClaro» (botón azul con latido suave)**
- `/onboarding` Explicación (ruta antigua, misma pantalla) → **(los mismos controles que `/tour`)**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Flecha atrás (cabecera) | Paso anterior; en el primero, vuelve (sin historial: Inicio con sesión o `/welcome`) | paso anterior / `/welcome` | OK |
| Barra de progreso (cabecera) | Indica el paso (1 de 4 …), animada | — | Informativo |
| Altavoz (cabecera, interruptor «Voz de la explicación») | Activa o silencia la voz grabada del paso (voz del sistema si no hay grabación) | — | OK |
| Deslizar con el dedo | Cambia de paso; puntos y barra lo siguen | — | OK |
| Puntos de página | Indicador (no pulsable) | — | Informativo |
| «Siguiente» | Paso siguiente | paso n+1 | OK |
| «Ver planes» (último paso, sin Premium y con compras) | Guarda «explicación vista» | `/premium` | OK |
| «Terminar» (último paso, ya Premium) · «Empezar» (sin compras en la app) | Guarda «explicación vista» y vuelve (con sesión) o va al acceso (sin sesión) | anterior / `/(tabs)` / `/login` | OK |
| «Saltar la explicación» (oculto en el último paso) | Sin sesión → planes (sin compras: acceso); con sesión → vuelve | `/premium` · `/login` · anterior | OK |
| Paso 1 · ejemplo «Identifica»: flechas «Ejemplo anterior» / «Ejemplo siguiente» | Cambia el ejemplo del carrusel (caja → información) | — | OK |
| Paso 4 · «Llamar al 112» del ejemplo de emergencia | Abre la emergencia real (el 112 nunca es de ejemplo) | `/emergency` | OK |

Estados: 4 pasos (Identifica tus medicamentos · Pregunta al asistente IA · Escucha el prospecto · Emergencias y ubicación) con ejemplos marcados «Ejemplo»; voz grabada (Kokoro-82M) a la velocidad de voz elegida; con «Reducir movimiento» del sistema no hay animaciones. `/onboarding` muestra la misma explicación (enlaces antiguos y Ayuda → «Ver el tutorial otra vez»).
Llega desde: Bienvenida «Conocer MediClaro», Ayuda «Ver el tutorial otra vez».

### 3. `/onboarding` — Explicación (ruta antigua, misma pantalla)

Archivo: `src/screens/premium/TourScreen.tsx` · Acceso: Pública

**Se llega desde:**

- `/help` Ayuda → **"Ver el tutorial otra vez"**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| (los mismos controles que `/tour`) | — | igual que `/tour` | OK |

Llega desde: Ayuda «Ver el tutorial otra vez».

### 4. `/login` — Acceso con teléfono

Archivo: `src/screens/auth/LoginScreen.tsx` · Acceso: Pública

**Se llega desde:**

- `/welcome` Bienvenida «Conocer MediClaro» → **«Ya soy Premium» (sin compras en la app: «Entrar con mi teléfono»)**
- `/tour` Explicación (4 pasos, con voz) → **«Terminar» (último paso, ya Premium) · «Empezar» (sin compras en la app)**
- `/tour` Explicación (4 pasos, con voz) → **«Saltar la explicación» (oculto en el último paso)**
- `/verify` Código SMS: aviso de envío y consola del código → **Volver (flecha)**
- `/verify` Código SMS: aviso de envío y consola del código → **«Cambiar número»**
- `/premium` Planes «Más claridad para tu salud» · suscripción activa → **«Continuar con mi teléfono» (aviso: el servidor no permite cuentas sin teléfono)**
- `/payment` ¿Cómo quieres pagar? → **«Continuar con mi teléfono» (aviso sin cuentas sin teléfono)**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Volver (flecha) | Atrás; sin historial → `/welcome` | Bienvenida | OK |
| Prefijo "🇪🇸 +34 ⌄" | Abre el selector de país (PhoneInput) | Hoja de países | OK |
| País de la lista / "Cerrar" | Cambia el prefijo / cierra | — | OK (componente compartido) |
| Campo "Número de móvil" | Número nacional; "Hecho" del teclado = Enviar | — | OK |
| "Enviar código →" | Valida (`validateNationalPhone` + `PHONE_ERROR_MESSAGES`) → `AuthService.requestOtp(e164)` | `/verify?phone=+34…` | OK · deshabilitado solo con el campo vacío |
| "Entrar sin verificar" (⚡, solo si `DemoMode.available()`) | `AuthService.enterWithoutVerification()` | Inicio `/(tabs)` | OK · TEMPORAL (se desactiva en tienda con `EXPO_PUBLIC_DEMO_ACCESS=off`) |
| Enlace "Condiciones de uso" | — | `/legal?section=terms` | OK |
| Enlace "Política de privacidad" | — | `/legal?section=privacy` | OK |
| "¿Es una urgencia? Pulsa aquí" (pie, rojo discreto) | — | `/emergency` (pública) | OK |

Estados: error de validación en línea (vacío, faltan cifras, demasiadas, no es móvil); `InfoBanner` por `AppError` — gris si `offline`, rojo si `rate_limited`, `not_configured` (con "Mientras tanto, puedes usar «Entrar sin verificar»"), `invalid_input`, `provider_down`, `timeout`; `loading` en ambos botones; si la sesión no llega en 8 s → aviso "No hemos podido abrir la sesión".
Llega desde: Bienvenida "Comenzar" (tutorial ya visto) · Tutorial "Saltar"/"Empezar" (sin sesión) · Verificar "Cambiar número"/Volver.

### 5. `/verify` — Código SMS: aviso de envío y consola del código

Archivo: `src/screens/auth/VerifyScreen.tsx` · Acceso: Pública

**Se llega desde:**

- `/complete-account` Completa tu cuenta (teléfono después del pago) → **«Continuar»**
- `/login` Acceso con teléfono → **"Enviar código →"**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Volver (flecha) | Atrás; sin historial → `/login` (o `/complete-account` al añadir el teléfono) | anterior | OK |
| «Escribir el código» (pie, durante la animación «¡Mensaje enviado!») | Salta la animación | consola del código | OK |
| (automático) fin de la animación (~3 s; al momento con «Reducir movimiento») | Muestra la consola | — | OK |
| «Cambiar número» | `router.back()` (o `/login`) | acceso con el número escrito | OK |
| Vista previa del SMS («Así verás el mensaje en tu teléfono») | Informativa: el texto real de la plantilla con el código tapado | — | Informativo |
| Teclado grande 1–9, 0 | Escribe la cifra (casilla con pequeño rebote y cursor parpadeante) | — | OK |
| «Borrar» (tecla con flecha) | Borra la última cifra | — | OK |
| «Usar el teclado del teléfono» / «Usar el teclado grande» | Cambia entre el teclado del sistema (con autocompletar del SMS) y el teclado grande | — | OK |
| Campo oculto del código (autocompletar SMS: `oneTimeCode` / `sms-otp`) | El código llega solo desde el aviso del SMS | — | OK |
| (automático) al completar 6 cifras | `verifyOtp` (acceso) o `verifyPhoneLink` (añadir teléfono tras pagar) | Inicio `/(tabs)` · tras vincular: aviso «Teléfono guardado» e Inicio | OK |
| «Verificar» (pie; nombre accesible «Verificar el código») | Igual que al completar (reintento manual tras un fallo de red) | Inicio | OK · habilitado con 6 cifras |
| «Reenviar código» (tras 60 s) | Pide otro código; aviso verde «Te hemos enviado un código nuevo» | — | OK |
| «Pedir un código nuevo» (pie, código caducado) | Igual que «Reenviar código» | — | OK |
| «¿No te llega el SMS? Entrar sin verificar» (solo compilaciones de prueba; no al añadir el teléfono) | `enterWithoutVerification()` | Inicio | OK · TEMPORAL |

Estados: «¡Mensaje enviado!» (teléfono → burbuja del SMS volando → check verde) · consola · código incorrecto (las casillas tiemblan en rojo, «El código no es correcto» y se vacían) · caducado (aviso ámbar) · sin conexión / demasiados intentos (aviso) · comprobando · sin `?phone` → acceso.
Llega desde: Acceso «Enviar código» · «Completa tu cuenta» «Continuar» (`purpose=link`).

### 6. `/` — Inicio

Archivo: `src/screens/home/HomeScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- Apertura de la app con sesión (redirección automática)
- Tras verificar el código SMS o «Entrar sin verificar»
- `/tour` Explicación (4 pasos, con voz) → **Flecha atrás (cabecera)**
- `/tour` Explicación (4 pasos, con voz) → **«Terminar» (último paso, ya Premium) · «Empezar» (sin compras en la app)**
- `/verify` Código SMS: aviso de envío y consola del código → **(automático) al completar 6 cifras**
- `/verify` Código SMS: aviso de envío y consola del código → **«Verificar» (pie; nombre accesible «Verificar el código»)**
- `/verify` Código SMS: aviso de envío y consola del código → **«¿No te llega el SMS? Entrar sin verificar» (solo compilaciones de prueba; no al añadir el teléfono)**
- `/processing` Procesando identificación → **Volver (cabecera)**
- `/processing` Procesando identificación → **Límite · «Volver al inicio»**
- `/processing` Procesando identificación → **Error · «Volver al inicio»**
- `/history` Historial de identificaciones → **"Volver" (AppHeader)**
- `/chat` Asistente IA (pestaña) → **"Volver" (solo `/chat`)**
- `/premium` Planes «Más claridad para tu salud» · suscripción activa → **Volver (cabecera con el logo)**
- `/payment` ¿Cómo quieres pagar? → **Con Premium · «Volver al inicio»**
- `/payment-card` Pago con tarjeta (Stripe) → **Con Premium · «Ver mi suscripción» / «Volver al inicio»**
- `/premium-success` ¡Bienvenido a MediClaro Premium! → **«Continuar»**
- `/premium-success` ¡Bienvenido a MediClaro Premium! → **Pendiente · «Seguir más tarde»**
- `/complete-account` Completa tu cuenta (teléfono después del pago) → **Volver (cabecera con el logo)**
- `/complete-account` Completa tu cuenta (teléfono después del pago) → **«Ahora no»**
- `/payment-result` Vuelta del pago con tarjeta → **Volver**
- `/payment-result` Vuelta del pago con tarjeta → **«Volver al inicio»**
- Elementos globales (en varias pantallas) → **Barra inferior "Inicio"**
- Elementos globales (en varias pantallas) → **Pantalla bloqueada · «Volver al inicio»**
- `/login` Acceso con teléfono → **"Entrar sin verificar" (⚡, solo si `DemoMode.available()`)**
- `+not-found` Pantalla no encontrada → **Volver (flecha)**
- `+not-found` Pantalla no encontrada → **"Volver al inicio"**
- `/help` Ayuda → **Volver (flecha)**
- `/legal` Información legal → **Volver (flecha)**
- `/emergency-profile` Perfil de emergencia → **Volver (flecha)**
- `/scan` Cámara / identificar medicamento → **«Cancelar» (texto blanco)**
- `/add-medication` Añadir medicamento (foto · código de barras · C.N.) → **Volver (cabecera)**
- `/candidates` Selección si hay varias coincidencias → **Volver (cabecera)**
- `/result` Resultado → **Volver (cabecera)**
- `/medication/[id]` Ficha completa del medicamento → **Volver (cabecera)**
- `/voice` Lectura en voz alta → **Volver (cabecera)**
- `/easy-mode` Modo fácil → **Ir al Inicio para verlo (solo activado)**
- `/emergency` Emergencia (principal) → **Flecha «Volver»**
- `/emergency/no-answer` Emergencia · Sin respuesta del servicio privado → **«Terminar y volver al inicio»**
- `/emergency/call-done` Emergencia · Confirmación posterior → **Flecha «Volver»**
- `/emergency/call-done` Emergencia · Confirmación posterior → **«Volver al inicio»**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Avatar (arriba a la derecha) | Abre el perfil | `/(tabs)/profile` | OK |
| Tarjeta «PREMIUM · Activa MediClaro Premium · Ver planes» (solo sin Premium y con compras en la app) | — | `/premium` | OK |
| «Ver Premium» (línea de uso, solo si se puede contratar y sin candados) | — | `/premium` | OK |
| «Identificar un medicamento» (con candado sin Premium) | Abre la cámara (sin Premium: pantalla «… es de MediClaro Premium») | `/scan` | OK |
| «Mis medicamentos» | Lista guardada (siempre visible, también sin Premium) | `/(tabs)/medicines` | OK |
| «Preguntar a la IA» (con candado sin Premium) | Abre el asistente (sin Premium: pantalla de Premium) | `/(tabs)/chat` | OK |
| «Historial de búsquedas» (oculto en Modo fácil) | — | `/history` | OK |
| «Emergencia · Ayuda inmediata · 112» | Nunca bloqueado | `/emergency` | OK |

Estados: saludo con el nombre ("Hola 👋" si no); uso del mes (gratuito o «incluidas» con Premium); candados solo cuando se sabe que no hay Premium; refresco al volver; Modo fácil = menos opciones.

### 7. `/scan` — Cámara / identificar medicamento

Archivo: `src/screens/identify/ScanScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/` Inicio → **«Identificar un medicamento» (con candado sin Premium)**
- `/processing` Procesando identificación → **(automático) sin entrada pendiente**
- `/processing` Procesando identificación → **No encontrado · «Hacer otra foto»**
- `/processing` Procesando identificación → **No encontrado · «Escanear el código de barras»**
- `/history` Historial de identificaciones → **Vacío → "Identificar un medicamento"**
- `/medicines` Mis medicamentos (pestaña) → **Vacío → «Identificar un medicamento» / «Ver historial»**
- `/add-medication` Añadir medicamento (foto · código de barras · C.N.) → **«Hacer una foto a la caja»**
- `/add-medication` Añadir medicamento (foto · código de barras · C.N.) → **«Escanear el código de barras»**
- `/candidates` Selección si hay varias coincidencias → **«Ninguno coincide · Hacer otra foto»**
- `/result` Resultado → **«Identificar otro medicamento»**
- `/result` Resultado → **«Identificar un medicamento» (estado vacío)**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| «Cancelar» (texto blanco) | Apaga la linterna y vuelve | Pantalla anterior; sin historial → `/(tabs)` | OK |
| Linterna (icono flash / flash-off) | Enciende/apaga `enableTorch` | — | OK (solo cámara trasera; se apaga al salir, al disparar y al abrir la galería) |
| Selector «Foto de la caja» / «Código de barras» (radio) | Cambia el modo y el parámetro `?mode=` | — | OK |
| Disparador «Hacer la foto» / «Hacer una foto del código» | Si aún no hay permiso para la IA: pantalla «Antes de usar la inteligencia artificial» (ver Elementos globales). Con permiso: `takePictureAsync({quality:0.8})` → 1280 px JPEG 0,7 base64 → `setPendingIdentification({imageBase64})` | `replace('/processing')` | OK (deshabilitado hasta `onCameraReady`; indicador mientras prepara) |
| «Ahora no» en el permiso para la IA | Aviso «Sin permiso no podemos leer la foto» con «Escanear el código» / «Ahora no» | «Escanear el código» → modo código de barras (`?mode=barcode`, no usa IA) | OK |
| Lectura automática del código (ean13, ean8, datamatrix, code128) | Solo la 1.ª lectura (bloqueo con ref) → `setPendingIdentification({barcode})` | `replace('/processing')` | OK (solo en modo código de barras) |
| «Elegir una foto de la galería» (botón redondo) | Primero el permiso para la IA (igual que la foto); después permiso de fotos → `launchImageLibraryAsync` → misma preparación | `replace('/processing')` | OK (denegado: aviso; denegado permanente: «Abrir ajustes») |
| «Usar la cámara delantera/trasera» | Cambia `facing` | — | OK |
| «Permitir cámara» (sin permiso, se puede pedir) | `requestPermission()` | — | OK |
| «Abrir ajustes» (denegado permanente) | `openAppSettings()`; al volver se comprueba el permiso | Ajustes del sistema | OK (si no abre, aviso con la ruta) |
| «Reintentar» (error al abrir la cámara, `onMountError`) | Vuelve a montar la cámara | — | OK |
| «Elegir una foto de la galería» (alternativa) | Igual que la galería | `replace('/processing')` | OK |
| «Escribir el código de la caja» (alternativa) | — | `replace('/add-medication')` | OK |

Estados: cargando permiso · sin permiso (explicación + «Permitir cámara») · denegado permanente («Abrir ajustes») · error de cámara · «Preparando la foto…» · visor activo. Siempre hay alternativas (galería / escribir el código).
Llega desde: Inicio «Identificar un medicamento», Mis medicamentos y Historial, `/add-medication` (foto / código de barras), `/processing` no encontrado («Hacer otra foto», «Escanear el código de barras»), `/candidates` («Ninguno coincide»), `/result` («Identificar otro medicamento»), redirección de `/processing` y `/candidates` sin datos.

### 8. `/add-medication` — Añadir medicamento (foto · código de barras · C.N.)

Archivo: `src/screens/identify/AddMedicationScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/processing` Procesando identificación → **No encontrado · «Escribir el código nacional»**
- `/processing` Procesando identificación → **Permiso de IA necesario · «Usar el código de la caja»**
- `/processing` Procesando identificación → **Otro error · «Intentarlo de otra forma»**
- `/medicines` Mis medicamentos (pestaña) → **«+» / «Añadir medicamento»**
- `/scan` Cámara / identificar medicamento → **«Escribir el código de la caja» (alternativa)**
- `/candidates` Selección si hay varias coincidencias → **«Escribir el código nacional»**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Volver (cabecera) | Atrás | Anterior; sin historial → `/(tabs)` | OK |
| «Hacer una foto a la caja» | — | `push('/scan?mode=photo')` | OK |
| «Escanear el código de barras» | — | `push('/scan?mode=barcode')` | OK |
| «Escribir el código nacional» | Despliega/pliega el formulario (enfoca el campo) | — | OK |
| Campo «Código nacional (C.N.)» | Numérico; acepta 6 cifras, 7 (con control) o «712729.4» → 6 primeras; 13 cifras → se envía como código de barras | — | OK (error en línea) |
| «Buscar medicamento» | Valida → `setPendingIdentification({nationalCode})` | `push('/processing')` | OK |

Estados: formulario plegado/desplegado, error de validación en línea, teclado (`<Screen keyboard>`).
Llega desde: Mis medicamentos «+», `/scan` («Escribir el código de la caja»), `/processing` («Escribir el código nacional», «Intentarlo de otra forma»), `/candidates` («Escribir el código nacional»).

### 9. `/processing` — Procesando identificación

Archivo: `src/screens/identify/ProcessingScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/scan` Cámara / identificar medicamento → **Disparador «Hacer la foto» / «Hacer una foto del código»**
- `/scan` Cámara / identificar medicamento → **Lectura automática del código (ean13, ean8, datamatrix, code128)**
- `/scan` Cámara / identificar medicamento → **«Elegir una foto de la galería» (botón redondo)**
- `/scan` Cámara / identificar medicamento → **«Elegir una foto de la galería» (alternativa)**
- `/add-medication` Añadir medicamento (foto · código de barras · C.N.) → **«Buscar medicamento»**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Volver (cabecera) | Cancela: la respuesta tardía se ignora y se borra la entrada pendiente | Anterior; sin historial → `/(tabs)` | OK |
| (automático) identificado | Pasos completados → | `replace('/result?id=<id>')` | OK |
| (automático) varios parecidos | → | `replace('/candidates')` | OK |
| (automático) sin entrada pendiente | → | `replace('/scan')` | OK |
| No encontrado · «Hacer otra foto» | — | `replace('/scan')` | OK |
| No encontrado · «Escanear el código de barras» | — | `replace('/scan?mode=barcode')` | OK |
| No encontrado · «Escribir el código nacional» | — | `replace('/add-medication')` | OK |
| Límite (sin Premium y con compras) · «Ver MediClaro Premium» | — | `push('/premium')` | OK |
| Límite (con Premium) · «Ver mi suscripción» | Uso del mes y gestión (nunca un anuncio de Premium) | `push('/premium')` | OK |
| Límite · «Volver al inicio» | — | `replace('/(tabs)')` | OK |
| Solo Premium según el servidor (`PREMIUM_REQUIRED`) · «Ver MediClaro Premium» (sin Premium) | — | `push('/premium')` | OK |
| Solo Premium según el servidor, con Premium ya en la app · «Intentar de nuevo» | Repite con la misma entrada («Estamos confirmando tu suscripción») | — | OK |
| Permiso de IA necesario · «Dar permiso y continuar» | Abre la pantalla de permiso; si se acepta, repite con la misma foto | — | OK |
| Permiso de IA necesario · «Usar el código de la caja» | — | `replace('/add-medication')` | OK |
| Error pasajero · «Reintentar» | Repite con la MISMA entrada | — | OK |
| Otro error · «Intentarlo de otra forma» | — | `replace('/add-medication')` | OK |
| Error · «Volver al inicio» | — | `replace('/(tabs)')` | OK |
| Sesión caducada · «Volver a entrar» | `signOut()` | `replace('/welcome')` | OK |

Estados: trabajando · no encontrado · límite (gratuito: «Se renuevan el 1 de …» o Premium; con Premium: «Has usado las identificaciones incluidas este mes · Tus identificaciones incluidas se renuevan cada mes») · solo Premium · confirmando suscripción · permiso de IA · error con reintento · sesión caducada.
Llega desde: `/scan` (foto, galería, código de barras), `/add-medication` («Buscar medicamento»).

### 10. `/candidates` — Selección si hay varias coincidencias

Archivo: `src/screens/identify/CandidatesScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/processing` Procesando identificación → **(automático) varios parecidos**
- `/result` Resultado → **«¿No es este? Ver otros parecidos»**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Volver (cabecera) | Atrás | Anterior; sin historial → `/(tabs)` | OK |
| Tarjeta de cada parecido (imagen, nombre tal y como aparece en la caja, forma, laboratorio, «Coincidencia alta/media») | — | `replace('/result?id=<id>')` | OK |
| «Ninguno coincide · Hacer otra foto» | — | `replace('/scan')` | OK |
| «Escribir el código nacional» | — | `replace('/add-medication')` | OK |

Estados: lista · sin resultado en memoria → `replace('/scan')`.
Llega desde: `/processing` (ambiguo), `/result` («¿No es este? Ver otros parecidos»).

### 11. `/result` — Resultado

Archivo: `src/screens/identify/ResultScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/processing` Procesando identificación → **(automático) identificado**
- `/candidates` Selección si hay varias coincidencias → **Tarjeta de cada parecido (imagen, nombre tal y como aparece en la caja, forma, laboratorio, «Coincidencia alta/media»)**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Volver (cabecera) | Atrás | Anterior; sin historial → `/(tabs)` | OK |
| Corazón (Marcar/Quitar de favoritos) | Sin guardar → `saveMedication(med,{favorite:true})`; guardado → `setFavorite` | — | OK |
| «Ver información completa» | — | `push('/medication/<id>')` | OK |
| «Leer en voz alta» | — | `push('/voice?id=&name=')` | OK |
| «Preguntar a la IA» | — | `push('/assistant?medicationId=&medicationName=')` | OK |
| «Guardar» / «Guardado» | Guarda en Mis medicamentos / pregunta (`confirmAsync`) y lo quita | — | OK (errores con `showAlert`) |
| «¿No es este? Ver otros parecidos» | Solo si hay otros parecidos | `push('/candidates')` | OK |
| «Identificar otro medicamento» | — | `replace('/scan')` | OK |
| «Identificar un medicamento» (estado vacío) | — | `replace('/scan')` | OK |

Estados: «Medicamento identificado» / «Elegido por ti» · carga por id si no está en memoria (esqueleto) · error con reintento / «No encontramos este medicamento en la base oficial» · vacío.
Llega desde: `/processing`, `/candidates`.

### 12. `/medication/[id]` — Ficha completa del medicamento

Archivo: `src/screens/identify/MedicationDetailScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/history` Historial de identificaciones → **Fila identificada (✓ verde, con flecha)**
- `/result` Resultado → **«Ver información completa»**
- `/saved/[id]` Detalle de medicamento guardado → **"Ver ficha completa"**
- `/saved/[id]` Detalle de medicamento guardado → **Ya no está → "Ver ficha"**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Volver (cabecera) | Atrás | Anterior; sin historial → `/(tabs)` | OK |
| Corazón (favorito) | Igual que en el resultado | — | OK |
| Apartados del «Prospecto oficial» (acordeón) | Despliega/pliega cada apartado | — | OK (desplegados si no hay resumen sencillo) |
| «Ver prospecto oficial» | `openExternalUrl(leafletUrl)` | Web oficial AEMPS | OK (solo si hay URL) |
| «Ficha técnica» | `openExternalUrl(sheetUrl)` | Web oficial AEMPS | OK (solo si hay URL) |
| «Leer en voz alta» (pie) | — | `push('/voice?id=&name=')` | OK |
| «Preguntar a la IA» (pie) | — | `push('/assistant?medicationId=&medicationName=')` | OK |
| «Reintentar» / «Volver» (error) | Recarga / atrás | — | OK |

Estados: esqueleto · contenido (¿Qué es? · ¿Para qué se utiliza? · ¿Cómo se toma? · Advertencias · Conservación · aviso IA · prospecto · presentaciones con C.N. · fuente CIMA·AEMPS con fecha) · sin resumen («Te mostramos el prospecto oficial») · no comercializado · no encontrado · sin conexión/servicio caído con reintento · sesión caducada.
Llega desde: `/result`, Historial y Medicamento guardado.

### 13. `/voice` — Lectura en voz alta

Archivo: `src/screens/identify/VoiceScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/result` Resultado → **«Leer en voz alta»**
- `/medication/[id]` Ficha completa del medicamento → **«Leer en voz alta» (pie)**
- `/saved/[id]` Detalle de medicamento guardado → **"Leer en voz alta"**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Volver (cabecera) | Atrás (la lectura se detiene) | Anterior; sin historial → `/(tabs)` | OK |
| Corazón (favorito) | Igual que en el resultado | — | OK |
| Reproducir / Pausar / Continuar / Volver a escuchar | `play()` / `pause()` | — | OK (empieza sola al cargar) |
| «Parte anterior» / «Parte siguiente» | `goTo()` | — | OK (deshabilitados en los extremos) |
| «Más lento» / «Velocidad normal» / «Más rápido» | `setSpeechRate(0.7/0.85/1.0)` + `restartWithNewRate()` | — | OK |
| Filas «¿Qué se está leyendo?» (1 Qué es · 2 Para qué se utiliza · 3 Cómo tomarlo · 4 Advertencias) | Salta a esa parte | — | OK (parte actual resaltada) |
| «Reintentar» / «Volver» (error de carga) | Recarga / atrás | — | OK |

Estados: carga (nombre del parámetro + esqueletos) · leyendo / en pausa / terminada · error de voz (aviso con cómo solucionarlo) · error de carga con reintento. Sin resumen sencillo lee el prospecto por apartados (trozos ≤ 3000 caracteres por el límite de Android).
Llega desde: `/result`, `/medication/<id>`, Medicamento guardado.

### 14. `/chat` — Asistente IA (pestaña)

Archivo: `src/screens/assistant/AssistantTabScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/` Inicio → **«Preguntar a la IA» (con candado sin Premium)**
- Elementos globales (en varias pantallas) → **Barra inferior "Asistente"**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| "Volver" (solo `/chat`) | `back`; sin historial `replace` | anterior / `/(tabs)` | OK |
| Icono "Nueva conversación" | Confirma y vacía (si hay respuesta en curso, avisa) | — | OK |
| 4 sugerencias | Envían la pregunta | — | OK |
| Campo "Escribe tu pregunta…" | Máx. 1000, contador desde 800 | — | OK |
| "Enviar pregunta" | Primera vez: permiso para la IA; «Ahora no» conserva el borrador | — | OK |
| "Escuchar" / "Detener" (cada respuesta) | Voz a la velocidad elegida | — | OK |
| "Ver prospecto oficial" | Abre el prospecto de CIMA | prospecto CIMA | OK |
| "Reintentar" (pregunta fallida o «Estamos confirmando tu suscripción») | Repite la pregunta | — | OK |
| Límite diario → "Ver MediClaro Premium" (solo sin Premium y si se puede contratar; con Premium: «Mañana podrás volver a preguntar») | `router.push` | `/premium` | OK |
| Solo Premium según el servidor → "Ver MediClaro Premium" | `router.push` | `/premium` | OK |
| Urgencia → "Llamar al 112" (ROJO) | `callPhone` | teléfono | OK |
| Urgencia → otros recursos ("Llamar al 91 562 04 20", "Llamar al 024") | `callPhone` | teléfono | OK |
| Urgencia → "Abrir la pantalla de emergencia" | `router.push` | `/emergency` | OK |

Estados: vacío / enviando / respuesta / error / límite diario / solo Premium / confirmando suscripción / urgencia / contexto de medicamento / teclado. Sin Premium, la ruta muestra la pantalla «Pregunta al asistente IA con Premium».
Llega desde: pestaña "Asistente"; Inicio → "Preguntar a la IA"; `/saved/<id>`, `/result` y `/medication/<id>` → "Preguntar a la IA" (`/chat?medicationId=…`).

### 15. `/assistant` — Asistente IA con contexto de medicamento

Archivo: `src/screens/assistant/AssistantChatScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/result` Resultado → **«Preguntar a la IA»**
- `/medication/[id]` Ficha completa del medicamento → **«Preguntar a la IA» (pie)**
- `/saved/[id]` Detalle de medicamento guardado → **"Preguntar a la IA"**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| "Volver" (solo `/chat`) | `back`; sin historial `replace` | anterior / `/(tabs)` | OK |
| Icono "Nueva conversación" | Confirma y vacía (si hay respuesta en curso, avisa) | — | OK |
| 4 sugerencias | Envían la pregunta | — | OK |
| Campo "Escribe tu pregunta…" | Máx. 1000, contador desde 800 | — | OK |
| "Enviar pregunta" | Primera vez: permiso para la IA; «Ahora no» conserva el borrador | — | OK |
| "Escuchar" / "Detener" (cada respuesta) | Voz a la velocidad elegida | — | OK |
| "Ver prospecto oficial" | Abre el prospecto de CIMA | prospecto CIMA | OK |
| "Reintentar" (pregunta fallida o «Estamos confirmando tu suscripción») | Repite la pregunta | — | OK |
| Límite diario → "Ver MediClaro Premium" (solo sin Premium y si se puede contratar; con Premium: «Mañana podrás volver a preguntar») | `router.push` | `/premium` | OK |
| Solo Premium según el servidor → "Ver MediClaro Premium" | `router.push` | `/premium` | OK |
| Urgencia → "Llamar al 112" (ROJO) | `callPhone` | teléfono | OK |
| Urgencia → otros recursos ("Llamar al 91 562 04 20", "Llamar al 024") | `callPhone` | teléfono | OK |
| Urgencia → "Abrir la pantalla de emergencia" | `router.push` | `/emergency` | OK |

Estados: vacío / enviando / respuesta / error / límite diario / solo Premium / confirmando suscripción / urgencia / contexto de medicamento / teclado. Sin Premium, la ruta muestra la pantalla «Pregunta al asistente IA con Premium».
Llega desde: pestaña "Asistente"; Inicio → "Preguntar a la IA"; `/saved/<id>`, `/result` y `/medication/<id>` → "Preguntar a la IA" (`/chat?medicationId=…`).

### 16. `/medicines` — Mis medicamentos (pestaña)

Archivo: `src/screens/medications/MedicinesScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/` Inicio → **«Mis medicamentos»**
- Elementos globales (en varias pantallas) → **Barra inferior "Mis meds"**
- `/saved/[id]` Detalle de medicamento guardado → **"Volver" (AppHeader)**
- `/saved/[id]` Detalle de medicamento guardado → **Ya no está → "Volver"**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Aviso «Tu lista sigue guardada» · «Ver planes» (solo sin Premium, con compras) | — | `/premium` | OK |
| Estrella de favorito (cada fila) | Marca / desmarca | — | OK |
| Fila de medicamento | Detalle (sin Premium: pantalla de Premium) | `/saved/<id>` | OK |
| «+» / «Añadir medicamento» | (sin Premium: pantalla de Premium) | `/add-medication` | OK |
| Pestañas «Todos» / «Favoritos», búsqueda | Filtran | — | OK |
| «Historial de identificaciones» | — | `/history` | OK |
| Vacío → «Identificar un medicamento» / «Ver historial» | — | `/scan` · `/history` | OK |
| Error → «Reintentar» | recarga | — | OK |

Estados: carga · lista · favoritos · búsqueda sin resultados · vacío · error · sin Premium (lista visible de solo lectura con aviso).
Llega desde: barra inferior "Mis meds", Inicio "Mis medicamentos".

### 17. `/saved/[id]` — Detalle de medicamento guardado

Archivo: `src/screens/medications/SavedMedicationScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/medicines` Mis medicamentos (pestaña) → **Fila de medicamento**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| "Volver" (AppHeader) | `back`; sin historial `replace` | pantalla anterior / `/(tabs)/medicines` | OK |
| Estrella de cabecera ("Marcar como favorito" / "Quitar de favoritos") | `setFavorite` optimista con reversión + aviso | — | OK |
| Interruptor "Favorito" | `setFavorite` (deshabilitado mientras guarda) | — | OK |
| "Ver ficha completa" | `router.push` | `/medication/<id>` | OK |
| "Leer en voz alta" | `router.push({ pathname: '/voice', params: { id, name } })` | `/voice?id=&name=` | OK |
| "Preguntar a la IA" | `router.push({ pathname: '/assistant', params: { medicationId, medicationName } })` | `/assistant?medicationId=&medicationName=` | OK |
| "Quitar de mis medicamentos" | `confirmAsync` destructivo → `removeMedication` → `back` | Mis medicamentos | OK |
| Ya no está → "Ver ficha" | `router.push` | `/medication/<id>` | OK |
| Ya no está → "Volver" | `back` / `replace` | `/(tabs)/medicines` | OK |
| Error → "Reintentar" | `reload` | — | OK |

Estados: loading (esqueleto) / success / vacío (`null`: "Este medicamento ya no está en tu lista") / id no válido / error / guardando favorito / quitando (botón con `loading`) / se actualiza al volver.
Llega desde: `/(tabs)/medicines` (tarjeta).

### 18. `/history` — Historial de identificaciones

Archivo: `src/screens/medications/HistoryScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/` Inicio → **«Historial de búsquedas» (oculto en Modo fácil)**
- `/medicines` Mis medicamentos (pestaña) → **«Historial de identificaciones»**
- `/medicines` Mis medicamentos (pestaña) → **Vacío → «Identificar un medicamento» / «Ver historial»**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| "Volver" (AppHeader) | `back`; sin historial `replace` | anterior / `/(tabs)` | OK |
| "Ver Premium" (tarjeta de uso, solo sin Premium y si se puede contratar) | `router.push` | `/premium` | OK |
| Fila identificada (✓ verde, con flecha) | `router.push` (sin Premium: pantalla de Premium) | `/medication/<medicationId>` | OK |
| Filas "Varias coincidencias" y "No identificado" | No pulsables | — | OK (por diseño) |
| Vacío → "Identificar un medicamento" | `router.push` | `/scan` | OK |
| Error → "Reintentar" | recarga historial y uso | — | OK |
| Deslizar hacia abajo | refresca | — | OK |

Estados: carga / por días / vacío / error / uso gratuito o Premium («incluidas»; el precio de cada identificación adicional solo se menciona a quien paga con tarjeta) / se actualiza al volver. Siempre visible, también sin Premium.
Llega desde: Inicio → "Historial de búsquedas"; Mis medicamentos → "Historial de identificaciones" y "Ver historial".

### 19. `/premium` — Planes «Más claridad para tu salud» · suscripción activa

Archivo: `src/screens/premium/PremiumScreen.tsx` · Acceso: Pública

**Se llega desde:**

- `/tour` Explicación (4 pasos, con voz) → **«Ver planes» (último paso, sin Premium y con compras)**
- `/tour` Explicación (4 pasos, con voz) → **«Saltar la explicación» (oculto en el último paso)**
- `/` Inicio → **Tarjeta «PREMIUM · Activa MediClaro Premium · Ver planes» (solo sin Premium y con compras en la app)**
- `/` Inicio → **«Ver Premium» (línea de uso, solo si se puede contratar y sin candados)**
- `/processing` Procesando identificación → **Límite (sin Premium y con compras) · «Ver MediClaro Premium»**
- `/processing` Procesando identificación → **Límite (con Premium) · «Ver mi suscripción»**
- `/processing` Procesando identificación → **Solo Premium según el servidor (`PREMIUM_REQUIRED`) · «Ver MediClaro Premium» (sin Premium)**
- `/history` Historial de identificaciones → **"Ver Premium" (tarjeta de uso, solo sin Premium y si se puede contratar)**
- `/medicines` Mis medicamentos (pestaña) → **Aviso «Tu lista sigue guardada» · «Ver planes» (solo sin Premium, con compras)**
- `/chat` Asistente IA (pestaña) → **Límite diario → "Ver MediClaro Premium" (solo sin Premium y si se puede contratar; con Premium: «Mañana podrás volver a preguntar»)**
- `/chat` Asistente IA (pestaña) → **Solo Premium según el servidor → "Ver MediClaro Premium"**
- `/payment` ¿Cómo quieres pagar? → **Volver (cabecera con el logo)**
- `/payment` ¿Cómo quieres pagar? → **«Cambiar» (resumen del plan)**
- `/payment` ¿Cómo quieres pagar? → **Con Premium · «Ver mi suscripción»**
- `/payment` ¿Cómo quieres pagar? → **Plan no disponible · «Ver los planes»**
- `/payment` ¿Cómo quieres pagar? → **«Continuar con mi teléfono» (aviso sin cuentas sin teléfono)**
- `/payment-card` Pago con tarjeta (Stripe) → **Volver (cabecera con el logo)**
- `/payment-card` Pago con tarjeta (Stripe) → **Con Premium · «Ver mi suscripción» / «Volver al inicio»**
- `/payment-card` Pago con tarjeta (Stripe) → **Sin pago con tarjeta para este plan · «Ver los planes»**
- `/payment-result` Vuelta del pago con tarjeta → **«Volver a Premium» (cancelado)**
- `/payment-result` Vuelta del pago con tarjeta → **«Ver Premium» (sin pago)**
- `/profile` Perfil y ajustes (pestaña) → **MediClaro Premium (Activo / Mejorar) · sin compras: «Tu plan» (Premium / Gratuito)**
- Elementos globales (en varias pantallas) → **Pantalla bloqueada «… con MediClaro Premium» (identificar, asistente, lectura por voz, añadir y ver medicamentos) · «Ver planes»**
- `/subscribe` Enlace heredado → redirección → **(sin controles)**
- `/account` Datos de cuenta → **Plan (Premium / Gratuito)**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Volver (cabecera con el logo) | Atrás; sin historial → Inicio (con sesión) o `/welcome` | anterior | OK |
| Plan «Mensual · 4,99 €/mes» (tarjeta) | Selecciona el plan | — | OK |
| Plan «Trimestral · 12,99 €/3 meses · Ahorra un 13 % aprox.» | Selecciona el plan | — | OK |
| Plan «Anual · 39,99 €/año · Ahorra un 33 % aprox.» (cinta «RECOMENDADO», elegido al entrar) | Selecciona el plan | — | OK |
| «Continuar con Premium» (pie, con la nota de precio y renovación) | Con 2 formas de pago → elegir; solo tienda → hoja de compra de Apple/Google; solo tarjeta → pago con tarjeta | `/payment?plan=<id>` · hoja de la tienda · `/payment-card?plan=<id>` | OK |
| «Restaurar compra» | Compras de la tienda de este teléfono + Premium de la cuenta → confirmación; si no, aviso | `/premium-success?status=restored` | OK |
| «Condiciones de suscripción» | — | `/legal?section=subscription` | OK |
| «Política de privacidad» | — | `/legal?section=privacy` | OK |
| «Comprobar de nuevo» (aviso: no se ha podido comprobar si ya tienes Premium) | Vuelve a consultar | — | OK |
| «Continuar con mi teléfono» (aviso: el servidor no permite cuentas sin teléfono) | Guarda volver aquí tras entrar | `/login` → `/premium?plan=<id>` | OK |
| «Intentar de nuevo» (Premium no disponible ahora) | Recarga los planes | — | OK |
| Reintentar (error al cargar) | Recarga | — | OK |
| Con Premium · «Gestionar suscripción» | Tienda (Apple/Google) o portal seguro de Stripe (tarjeta) | gestión de la suscripción | OK |
| Con Premium · «Ayuda» | — | `/help` | OK |
| Sin compras en la app (o sin forma de pagar): «Tu plan» · «Ayuda» | Plan, uso del mes y renovación, sin precios | `/help` | OK |

Estados: carga (esqueleto) · planes (1, 2 o 3 según lo que se puede cobrar de verdad; ahorro calculado con los precios reales, también los de la tienda) · aviso de modo demostración · pago cancelado («No se ha realizado ningún cargo») · error de pago · no se pudo comprobar Premium · sin planes («Premium no está disponible ahora mismo») · con Premium: «Suscripción activa», «Se renueva el …», proveedor, uso del mes, «Has cancelado la renovación», problema de pago, ventajas · «Tu plan» sin compras. Nota bajo las ventajas: «Emergencias y ubicación» y «Funciones de accesibilidad» son gratis para todos.
Llega desde: explicación «Ver planes»/«Saltar», Inicio (tarjeta Premium, «Ver Premium»), Perfil «MediClaro Premium», Datos de cuenta «Plan», pantallas bloqueadas «Ver planes», límites, pago cancelado.

### 20. `/payment` — ¿Cómo quieres pagar?

Archivo: `src/screens/premium/PaymentScreen.tsx` · Acceso: Pública

**Se llega desde:**

- `/premium` Planes «Más claridad para tu salud» · suscripción activa → **«Continuar con Premium» (pie, con la nota de precio y renovación)**
- `/payment-card` Pago con tarjeta (Stripe) → **Volver (cabecera con el logo)**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Volver (cabecera con el logo) | Atrás; sin historial → `/premium` | `/premium` | OK |
| «Cambiar» (resumen del plan) | Vuelve a elegir plan | `/premium` | OK |
| «Pagar con Apple» (iPhone) / «Pagar con Google Play» (Android) | Crea la cuenta si hace falta (sin teléfono) → hoja oficial de la tienda → comprobación en el servidor | `/premium-success?plan=<id>` | OK |
| «Pagar con tarjeta» (Visa, Mastercard…; solo donde las tiendas lo permiten) | — | `/payment-card?plan=<id>` | OK |
| «Restaurar compra» | Igual que en planes | `/premium-success?status=restored` | OK |
| «Condiciones de suscripción» / «Política de privacidad» | — | `/legal?section=subscription` · `/legal?section=privacy` | OK |
| Con Premium · «Ver mi suscripción» | Nunca se cobra dos veces | `/premium` | OK |
| Con Premium · «Volver al inicio» | — | `/(tabs)` | OK |
| Plan no disponible · «Ver los planes» | — | `/premium` | OK |
| «Continuar con mi teléfono» (aviso sin cuentas sin teléfono) | — | `/login` → `/premium?plan=<id>` | OK |
| Reintentar (error) | Recarga | — | OK |

Estados: carga · métodos · comprando (spinner en el método) · cancelado · pendiente de aprobación (compra familiar) · error · ya activa · plan no disponible · demostración. «Tu pago es seguro y encriptado.» y la nota de renovación siempre a la vista.
Llega desde: planes «Continuar con Premium» (con dos formas de pago).

### 21. `/payment-card` — Pago con tarjeta (Stripe)

Archivo: `src/screens/premium/CardPaymentScreen.tsx` · Acceso: Pública

**Se llega desde:**

- `/premium` Planes «Más claridad para tu salud» · suscripción activa → **«Continuar con Premium» (pie, con la nota de precio y renovación)**
- `/payment` ¿Cómo quieres pagar? → **«Pagar con tarjeta» (Visa, Mastercard…; solo donde las tiendas lo permiten)**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Volver (cabecera con el logo) | Atrás; sin historial → `/premium` | `/payment` | OK |
| «Pagar 39,99 €» (el importe del plan) | Aviso obligatorio de la tienda (UE/EEE) → `create-checkout` → página segura de Stripe dentro de la app (la tarjeta se escribe allí; «Guardar tarjeta» para renovaciones) → espera la activación | `/premium-success?plan=<id>` | OK |
| Con Premium · «Ver mi suscripción» / «Volver al inicio» | — | `/premium` · `/(tabs)` | OK |
| Sin pago con tarjeta para este plan · «Ver los planes» | — | `/premium` | OK |
| Reintentar (error) | Recarga | — | OK |

Estados: carga · resumen · abriendo la página segura · cancelado («No se ha realizado ningún cargo») · pendiente · error · ya activa · demostración. Texto: MediClaro nunca ve ni guarda la tarjeta; «Powered by Stripe · Pago seguro y encriptado»; con el plan mensual, el precio de las identificaciones adicionales.
Llega desde: «¿Cómo quieres pagar?» «Pagar con tarjeta» o planes (solo tarjeta).

### 22. `/premium-success` — ¡Bienvenido a MediClaro Premium!

Archivo: `src/screens/premium/PremiumSuccessScreen.tsx` · Acceso: Con sesión (también sin teléfono)

**Se llega desde:**

- Tras pagar con Apple/Google o con tarjeta, o al restaurar una compra
- `/payment-result` cuando el pago con tarjeta se confirma
- `/welcome` Bienvenida «Conocer MediClaro» → **«Restaurar compra» (solo con compras en la app)**
- `/premium` Planes «Más claridad para tu salud» · suscripción activa → **«Restaurar compra»**
- `/payment` ¿Cómo quieres pagar? → **«Pagar con Apple» (iPhone) / «Pagar con Google Play» (Android)**
- `/payment` ¿Cómo quieres pagar? → **«Restaurar compra»**
- `/payment-card` Pago con tarjeta (Stripe) → **«Pagar 39,99 €» (el importe del plan)**
- `/payment-result` Vuelta del pago con tarjeta → **(automático) pago confirmado**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| «Continuar» | Cuenta sin teléfono → completar la cuenta; con teléfono → Inicio | `/complete-account` · `/(tabs)` | OK |
| Pendiente · «Comprobar de nuevo» | Reenvía las compras pendientes y consulta (10 s) | — | OK |
| Pendiente · «Seguir más tarde» | La activación sigue sola | `/(tabs)` | OK |

Estados: confirmado (check verde con rebote, confeti, lista animada «Asistente IA activado», «Identificación de medicamentos», «Lectura por voz», «Tus medicamentos», «Emergencias y ubicación», «Funciones de accesibilidad») · restaurado · ya activo («No se ha cobrado nada más») · confirmando · pendiente de aprobación · todavía sin confirmar · error. Siempre según el servidor (nunca una confirmación falsa).
Llega desde: pago con la tienda o con tarjeta, «Restaurar compra», vuelta del pago (`/payment-result`).

### 23. `/complete-account` — Completa tu cuenta (teléfono después del pago)

Archivo: `src/screens/premium/CompleteAccountScreen.tsx` · Acceso: Con sesión (también sin teléfono)

**Se llega desde:**

- `/verify` Código SMS: aviso de envío y consola del código → **Volver (flecha)**
- `/premium-success` ¡Bienvenido a MediClaro Premium! → **«Continuar»**
- `/profile` Perfil y ajustes (pestaña) → **Aviso «Completa tu cuenta» · «Añadir mi teléfono» (cuenta creada al pagar, sin teléfono)**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Volver (cabecera con el logo) | Atrás; sin historial → Inicio | anterior | OK |
| Prefijo «🇪🇸 +34» | Selector de país | hoja de países | OK |
| Campo «Número de teléfono» | Número nacional; «Hecho» = Continuar | — | OK |
| «Continuar» | Valida → `requestPhoneLink` (SMS al número) | `/verify?phone=…&purpose=link` | OK |
| «Ahora no» | Se puede completar después desde Perfil | `/(tabs)` | OK |

Estados: validación en línea · enviando · número ya con cuenta («Usa otro número o escríbenos para unir las dos cuentas. Tu Premium sigue activo en este teléfono.») · error de SMS · sin sesión → `/welcome` · con teléfono → Inicio. «Te enviaremos un SMS de verificación. Solo se utilizará para tu cuenta.»
Llega desde: confirmación «Continuar» (cuenta sin teléfono), Perfil (aviso «Completa tu cuenta» y «Añadir mi teléfono»).

### 24. `/payment-result` — Vuelta del pago con tarjeta

Archivo: `src/screens/premium/PaymentResultScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- Enlace profundo de vuelta del proveedor de pago `mediclaro://payment-result?ok=1|cancel=1`
- `/subscribe` (redirección de enlaces antiguos)
- `/subscribe` Enlace heredado → redirección → **(sin controles)**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Volver | back / Inicio | anterior | OK |
| (automático) pago confirmado | — | `/premium-success` | OK |
| «Comprobar de nuevo» (pendiente / sin pago) | Espera la confirmación (10 s) | — | OK |
| «Volver al inicio» | — | `/(tabs)` | OK |
| «Volver a Premium» (cancelado) | — | `/premium` | OK |
| «Ver Premium» (sin pago) | — | `/premium` | OK |
| Reintentar (error) | vuelve a consultar | — | OK |

Estados: confirmando · pendiente («Premium se activará en unos minutos. No hace falta que pagues otra vez.») · cancelado («No se ha realizado ningún cargo») · sin pago · error. Sin compras en la app → `/premium`.
Llega desde: vuelta de la página de pago (`mediclaro://payment-result?ok=1|cancel=1`), `/subscribe`.

### 25. `/subscribe` — Enlace heredado → redirección

Archivo: `src/screens/premium/SubscribeScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- Enlace profundo heredado `mediclaro://subscribe` (URL de retorno por defecto del backend)

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| (sin controles) | `<Redirect>` con ok/cancel | `/payment-result?ok=1` o `?cancel=1` | OK |
| (sin controles) | `<Redirect>` sin parámetros | /premium | OK |

Estados: con parámetros / sin parámetros.
Llega desde: mediclaro://subscribe (returnUrl por defecto del backend).

### 26. `/profile` — Perfil y ajustes (pestaña)

Archivo: `src/screens/profile/ProfileScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/` Inicio → **Avatar (arriba a la derecha)**
- Elementos globales (en varias pantallas) → **Barra inferior "Perfil"**
- `/language` Idioma → **Volver (flecha)**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Aviso «Completa tu cuenta» · «Añadir mi teléfono» (cuenta creada al pagar, sin teléfono) | — | `/complete-account` | OK |
| Tarjeta de usuario (avatar, nombre, teléfono o «Sin teléfono · completa tu cuenta») | push | /account | OK |
| MediClaro Premium (Activo / Mejorar) · sin compras: «Tu plan» (Premium / Gratuito) | push | /premium | OK |
| Tamaño del texto (valor) | push | /accessibility | OK |
| Modo fácil (interruptor) | `setEasyMode` | — | OK |
| Idioma (Español) | push | /language | OK |
| Notificaciones | push | /notifications | OK |
| Privacidad y datos | push | /privacy | OK |
| Ayuda | push | /help | OK |
| Mi perfil de emergencia | push | /emergency-profile | OK |
| Número privado de asistencia | push | /private-assistance | OK |
| Qué compartir en una emergencia | push | /emergency-sharing | OK |
| Información legal | push | /legal | OK |
| Cerrar sesión (rojo) | Confirma → `signOut()` | `/welcome` | OK |
| Tirar para refrescar | refresca perfil y suscripción | — | OK |

Estados: carga · error · sin nombre · cuenta sin teléfono (aviso) · acceso de prueba / demostración · refresco al volver.
Llega desde: barra inferior "Perfil", avatar del Inicio.

### 27. `/account` — Datos de cuenta

Archivo: `src/screens/profile/AccountScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/profile` Perfil y ajustes (pestaña) → **Tarjeta de usuario (avatar, nombre, teléfono o «Sin teléfono · completa tu cuenta»)**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| ← Volver | back | Perfil | OK |
| Editar (nombre) | abre el campo | — | OK |
| Campo "Tu nombre" | validación en línea (vacío, < 2, > 60) | — | OK |
| Guardar | `ProfileService.updateProfile({ displayName })` | — | OK |
| Cancelar | cierra la edición | — | OK |
| Plan (Premium / Gratuito) | push | /premium | OK (uso del mes también con Premium: «incluidas este mes») |
| Descargar mis datos | `exportData()` → `shareOrDownloadText('mediclaro-mis-datos.json', …)` + alerta | archivo JSON | OK |
| Cerrar sesión | confirmación → `signOut()` → bienvenida | `/welcome` | OK |
| Eliminar mi cuenta | 2 confirmaciones → `deleteAccount()` → alerta → bienvenida | `/welcome` | OK (en demo: aviso de que no hay cuenta real) |
| Reintentar (ErrorState) | recarga | — | OK |

Estados: carga · error (+ Reintentar; las acciones siguen visibles) · sin nombre · sin teléfono ("Sin teléfono (acceso de prueba)") · uso del mes (plan gratuito, con barra) · Premium · guardando / exportando / eliminando.
Llega desde: Perfil (tarjeta de usuario).

### 28. `/accessibility` — Accesibilidad

Archivo: `src/screens/profile/AccessibilityScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/profile` Perfil y ajustes (pestaña) → **Tamaño del texto (valor)**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| ← Volver | back | anterior | OK |
| Normal / Grande / Muy grande (tarjetas radio con "Aa") | `setFontSize` | — | OK |
| Ajustar Modo fácil (aviso, solo con Modo fácil activo) | push | /easy-mode | OK |
| Alto contraste (interruptor) | `setHighContrast` | — | OK |
| Modo fácil (Activado/Desactivado) | push | /easy-mode | OK |
| Más lento / Normal / Más rápido | `setSpeechRate(0.7 / 0.85 / 1.0)` | — | OK |
| Probar voz / Detener | `useSimpleSpeech` a la velocidad elegida | — | OK |

Estados: vista previa en vivo · con Modo fácil activo (aviso: la letra es siempre "Muy grande").
Llega desde: Perfil ("Tamaño del texto").

### 29. `/easy-mode` — Modo fácil

Archivo: `src/screens/profile/EasyModeScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/accessibility` Accesibilidad → **Ajustar Modo fácil (aviso, solo con Modo fácil activo)**
- `/accessibility` Accesibilidad → **Modo fácil (Activado/Desactivado)**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| ← Volver | back | anterior | OK |
| Activar Modo fácil (tarjeta interruptor) | `setEasyMode` | — | OK |
| Ir al Inicio para verlo (solo activado) | `router.replace('/(tabs)')` | Inicio | OK |

Estados: desactivado · activado (aviso de éxito + botón).
Llega desde: Accesibilidad (fila "Modo fácil" y aviso "Ajustar Modo fácil").

### 30. `/language` — Idioma

Archivo: `src/screens/info/LanguageScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/profile` Perfil y ajustes (pestaña) → **Idioma (Español)**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Volver (flecha) | Atrás; sin historial → `/(tabs)/profile` | Perfil | OK |
| Fila "Español ✓" | No pulsable (única opción disponible) | — | Informativo |

Estados: informativo + aviso "Por ahora MediClaro solo está disponible en español." Llega desde: Perfil "Idioma".

### 31. `/notifications` — Notificaciones

Archivo: `src/screens/profile/NotificationsScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/profile` Perfil y ajustes (pestaña) → **Notificaciones**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| ← Volver | back | Perfil | OK |
| Avisos de tu cuenta / Avisos de seguridad de tus medicamentos / Consejos (interruptores) | `updatePreferences` optimista y en cola; revierte y avisa si falla | — | OK (se guardan en el teléfono: el backend aún no envía avisos) |
| Reintentar (ErrorState) | recarga | — | OK |

Estados: carga · error · vacío · aviso "Todavía no enviamos notificaciones…".
Llega desde: Perfil ("Notificaciones").

### 32. `/privacy` — Privacidad y datos

Archivo: `src/screens/profile/PrivacyScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/profile` Perfil y ajustes (pestaña) → **Privacidad y datos**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| ← Volver | back | Perfil | OK |
| Abrir ajustes del teléfono | `openAppSettings()`; si falla → alerta con instrucciones | Ajustes del sistema | OK |
| «Retirar el permiso» (tarjeta «Inteligencia artificial», con permiso: «Has dado permiso el …») | Confirmación → deja de enviarse nada a la IA; queda registrado con fecha («Has retirado el permiso el …») | — | OK |
| «Dar el permiso» (tarjeta «Inteligencia artificial», sin permiso o retirado) | Concede y lo registra con fecha | — | OK |
| «Más información» (permiso de IA) | push | /legal?section=ai | OK |
| Descargar mis datos | helper compartido (`accountActions.ts`): datos del servidor + perfil de emergencia + lo que solo está en el teléfono (`dataOnThisPhone`) | archivo JSON | OK |
| Qué compartir en una emergencia | push | /emergency-sharing | OK |
| Política de privacidad | push | /legal?section=privacy | OK |
| Eliminar mi cuenta | helper compartido (2 confirmaciones) | `/welcome` | OK |

Estados: informativo + indicadores de exportando / eliminando.
Llega desde: Perfil ("Privacidad y datos").

### 33. `/help` — Ayuda

Archivo: `src/screens/info/HelpScreen.tsx` · Acceso: Pública

**Se llega desde:**

- `/premium` Planes «Más claridad para tu salud» · suscripción activa → **Con Premium · «Ayuda»**
- `/premium` Planes «Más claridad para tu salud» · suscripción activa → **Sin compras en la app (o sin forma de pagar): «Tu plan» · «Ayuda»**
- `/profile` Perfil y ajustes (pestaña) → **Ayuda**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Volver (flecha) | Atrás; sin historial → Inicio (con sesión) o `/` | — | OK |
| 8 preguntas desplegables (flecha que gira, `expanded`) | Abrir / cerrar la respuesta. Sin compras en la app (versión de tienda), «¿Qué incluye Premium y cómo lo cancelo?» se sustituye por «¿Cuántas identificaciones puedo hacer?» (remite a Perfil → Tu plan) | — | OK |
| "Ver el tutorial otra vez" | — | `/onboarding` | OK |
| "Escribir a soporte" | `composeEmail(SUPPORT_EMAIL, 'Ayuda con MediClaro')` | App de correo | OCULTO: falta `EXPO_PUBLIC_SUPPORT_EMAIL` (INFORMACIÓN NECESARIA) |
| "Información legal" | — | `/legal` | OK |

Estados: informativo. Llega desde: Perfil "Ayuda" · Premium "Ayuda".

### 34. `/legal` — Información legal

Archivo: `src/screens/info/LegalScreen.tsx` · Acceso: Pública

**Se llega desde:**

- `/premium` Planes «Más claridad para tu salud» · suscripción activa → **«Condiciones de suscripción»**
- `/premium` Planes «Más claridad para tu salud» · suscripción activa → **«Política de privacidad»**
- `/payment` ¿Cómo quieres pagar? → **«Condiciones de suscripción» / «Política de privacidad»**
- `/profile` Perfil y ajustes (pestaña) → **Información legal**
- `/login` Acceso con teléfono → **Enlace "Condiciones de uso"**
- `/login` Acceso con teléfono → **Enlace "Política de privacidad"**
- `/help` Ayuda → **"Información legal"**
- `/privacy` Privacidad y datos → **«Más información» (permiso de IA)**
- `/privacy` Privacidad y datos → **Política de privacidad**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Volver (flecha) | Atrás; sin historial → Inicio o `/` | — | OK |
| Tarjeta "Aviso médico" (`medical`) | Abrir / cerrar | — | OK |
| Tarjeta "Origen de la información" (`sources`) | Abrir / cerrar | — | OK |
| "Abrir CIMA" | `openExternalUrl('https://cima.aemps.es')` | Navegador | OK |
| Tarjeta "Uso de inteligencia artificial" (`ai`) | Abrir / cerrar: qué se envía a Gemini (Google), con permiso previo, conservación de 55 días solo contra abusos y cómo retirar el permiso | — | OK |
| Tarjeta "Condiciones de uso" (`terms`) | Abrir / cerrar | — | OK |
| "Leer las Condiciones de uso" | `openExternalUrl(LEGAL_URLS.terms)` | Navegador | PENDIENTE: sin URL → fila NO pulsable "Pendiente de publicación" |
| Tarjeta "Política de privacidad" (`privacy`) | Abrir / cerrar | — | OK |
| "Leer la Política de privacidad" | `openExternalUrl(LEGAL_URLS.privacy)` | Navegador | PENDIENTE (igual) |
| Tarjeta "Aviso legal" (`notice`) + datos del titular (`COMPANY_INFO`) | Abrir / cerrar | — | OK · titular vacío → no se muestra |
| "Leer el Aviso legal" | `openExternalUrl(LEGAL_URLS.legalNotice)` | Navegador | PENDIENTE (igual) |

Estados: se abre (y se desplaza a) la tarjeta de `?section=`; pie "MediClaro {APP_VERSION}".
Llega desde: Login (Condiciones / Privacidad) · Ayuda · Perfil "Información legal" · Privacidad (también «Más información» del permiso de IA → `?section=ai`) · Premium (terms / privacy).

### 35. `/emergency` — Emergencia (principal)

Archivo: `src/screens/emergency/EmergencyScreen.tsx` · Acceso: Pública

**Se llega desde:**

- `/welcome` Bienvenida «Conocer MediClaro» → **«¿Es una urgencia? Pulsa aquí» (rojo)**
- `/tour` Explicación (4 pasos, con voz) → **Paso 4 · «Llamar al 112» del ejemplo de emergencia**
- `/` Inicio → **«Emergencia · Ayuda inmediata · 112»**
- `/chat` Asistente IA (pestaña) → **Urgencia → "Abrir la pantalla de emergencia"**
- Elementos globales (en varias pantallas) → **Pantalla bloqueada · «¿Es una urgencia? El 112 siempre está disponible»**
- `/login` Acceso con teléfono → **"¿Es una urgencia? Pulsa aquí" (pie, rojo discreto)**
- `/emergency/confirm` Emergencia · Confirmación → **Flecha «Volver»**
- `/emergency/confirm` Emergencia · Confirmación → **«Cancelar»**
- `/emergency/prepared` Emergencia · Información preparada → **Flecha «Volver»**
- `/emergency/calling` Emergencia · Cuenta atrás / preparación → **«Cancelar»**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Flecha «Volver» | `router.back()`; sin historial → `/` | anterior o `/` | OK |
| «Llamar al 112» (rojo) | `EmergencyService.callOfficialEmergency()`; si la config remota tarda >1,5 s marca el 112 con `callPhone`. Con sesión: `EmergencySession.start('unsure')` + `callStarted('official')`. Si falla: aviso «No se ha podido abrir el teléfono · Marca el 112 desde tu teléfono.» | marcador; con sesión → `/emergency/in-call?target=official` | OK |
| «Llamar a {servicio}» (azul contorno; con sesión y servicio) | `EmergencySession.start('unsure')` | `/emergency/calling` | OK |
| «Asistente de emergencia» (con sesión) | — | `/emergency/confirm` | OK |
| Fila «Instituto Nacional de Toxicología · 91 562 04 20» | `callPhone('915620420')` (si falla, aviso) | marcador | OK |
| Fila «Tu médico de cabecera» (si hay teléfono) | `callPhone` | marcador | OK (dato solo en el teléfono) |
| Fila «{familiar} ({relación})» | `callPhone` | marcador | OK (demo: no marca, aviso) |
| Fila «Prepara tu perfil de emergencia» (perfil vacío) | — | `/emergency-profile` | OK |

Estados: sin sesión (solo 112 + toxicología + Importante) · con sesión cargando (esqueleto) · sin servicio privado (botón oculto) · perfil vacío · error de perfil (filas ocultas, nunca bloquea) · 112 abriendo (loading). Al salir de esta pantalla se llama a `EmergencySession.finish()`.
Llega desde: Inicio (fila «Emergencia»), Login, respuesta de urgencia del Asistente; sin sesión (ruta pública).

### 36. `/emergency/confirm` — Emergencia · Confirmación

Archivo: `src/screens/emergency/EmergencyConfirmScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/emergency` Emergencia (principal) → **«Asistente de emergencia» (con sesión)**
- `/emergency/assistant` Emergencia · Asistente (escuchando) → **Flecha «Volver»**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Flecha «Volver» | back; sin historial → `/emergency` | anterior | OK |
| «Sí, puedo hablar» | `EmergencySession.start('can_speak')` | `/emergency/assistant?mode=can_speak` | OK |
| «No puedo hablar» | `start('cannot_speak')` | `/emergency/prepared` | OK |
| «No estoy seguro» | `start('unsure')` | `/emergency/assistant?mode=unsure` | OK |
| «Llamar al 112 ahora» (rojo, pie) | 112 como arriba + `callStarted('official')` | `/emergency/in-call?target=official` | OK |
| «Cancelar» | `EmergencySession.finish()` | back (o `/emergency`) | OK |

Estados: único (sin datos). Llega desde: `/emergency` «Asistente de emergencia».

### 37. `/emergency/assistant` — Emergencia · Asistente (escuchando)

Archivo: `src/screens/emergency/EmergencyAssistantScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/emergency/confirm` Emergencia · Confirmación → **«Sí, puedo hablar»**
- `/emergency/confirm` Emergencia · Confirmación → **«No estoy seguro»**
- `/emergency/prepared` Emergencia · Información preparada → **«Indicar / Cambiar lo que te pasa»**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Flecha «Volver» | back; sin historial → `/emergency/confirm` | anterior | OK |
| 7 chips (medicamento equivocado, medicación de más, mareo/malestar, dolor en el pecho, me cuesta respirar, no puedo hablar bien, otra situación) | `EmergencySession.toggleSymptom(id)` (rojo al marcar) | — | OK |
| Tocar cualquier punto | reinicia el temporizador de inactividad; si había «¿Sigues ahí?» → `markResponsive()` | — | OK |
| «Estoy aquí» (tras 60 s sin toques) | `EmergencySession.markResponsive()` | — | OK (nunca llama a nadie) |
| «Preparar mi información» | — (si vino de «Tu información», vuelve a ella) | `/emergency/prepared` | OK |
| «Llamar al 112 ahora» (rojo) | 112 | `/emergency/in-call?target=official` | OK |

Estados: saludo por voz (`EmergencyService.speak`, onda y halo activos) · síntomas marcados («Has indicado N cosas») · «¿Sigues ahí?» (60 s, `markNoResponse()`, voz) · vigilancia en pausa con la pantalla oculta o la app en segundo plano · la voz se calla al salir.
Llega desde: confirm («Sí, puedo hablar», «No estoy seguro»); prepared («Indicar lo que te pasa»).

### 38. `/emergency/prepared` — Emergencia · Información preparada

Archivo: `src/screens/emergency/EmergencyPreparedScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/emergency/confirm` Emergencia · Confirmación → **«No puedo hablar»**
- `/emergency/assistant` Emergencia · Asistente (escuchando) → **«Preparar mi información»**
- `/emergency/in-call` Emergencia · Llamada en curso → **«Mi información»**
- `/emergency/no-answer` Emergencia · Sin respuesta del servicio privado → **«Ver mi información»**
- `/emergency/call-done` Emergencia · Confirmación posterior → **«Ver mi información»**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Flecha «Volver» | back; sin historial → `/emergency` | anterior | OK |
| «Actualizar» | `EmergencySession.prepare(true)` | — | OK |
| «Completar mi perfil» (perfil vacío) | — | `/emergency-profile-edit` | OK |
| Coordenadas + precisión + hora de actualización (con GPS) | Muestra siempre el GPS actual del dispositivo; nunca lo sustituye por el domicilio del perfil | — | OK |
| «Leer ubicación en voz alta» (con GPS) | Lee dirección actual, coordenadas y precisión mediante TTS del dispositivo | — | OK |
| «Ver en el mapa» (con GPS) | `openMaps(lat,lng)` (si falla, aviso) | app de mapas | OK |
| «Activar ubicación» (sin GPS) | `openAppSettings()` (si falla, aviso con instrucciones) | ajustes del sistema | OK |
| «Reintentar» (sin GPS) | `prepare(true)` | — | OK |
| «Cambiar qué se comparte» (si algo no se comparte) | — | `/emergency-sharing` | OK |
| «Indicar / Cambiar lo que te pasa» | — | `/emergency/assistant?mode=…&from=prepared` | OK |
| «Configurarlo» (sin servicio privado) | — | `/private-assistance` | OK |
| «Escuchar el mensaje para el operador» | — | `/emergency/voice-message` | OK |
| «Avisar a {nombre}» (si hay mensaje para el contacto) | — | `/emergency/notify` | OK |
| «Llamar a {servicio}» (azul, pie) | — | `/emergency/calling` | OK |
| «Llamar al 112» (rojo, pie) | 112 | `/emergency/in-call?target=official` | OK |
| «Reintentar» (error) | `prepare(true)` | — | OK |

Estados: preparando (anillo + checks pendientes) · lista · error (ErrorState) · error al actualizar (banner) · perfil vacío · sin ubicación (motivo) · ubicación/dirección/datos «No compartido» · sin servicio privado · se vuelve a preparar al entrar si tiene más de 5 min o si cambió lo indicado.
Llega desde: assistant, confirm («No puedo hablar»), in-call («Mi información»), no-answer y call-done («Ver mi información»).

### 39. `/emergency/calling` — Emergencia · Cuenta atrás / preparación

Archivo: `src/screens/emergency/EmergencyCallingScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/emergency` Emergencia (principal) → **«Llamar a {servicio}» (azul contorno; con sesión y servicio)**
- `/emergency/prepared` Emergencia · Información preparada → **«Llamar a {servicio}» (azul, pie)**
- `/emergency/in-call` Emergencia · Llamada en curso → **«Volver a llamar» (azul privado / rojo 112)**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Flecha «Volver» | back (la cuenta atrás se detiene; no llama) | anterior | OK |
| Cuenta atrás 5 s | `EmergencyService.callPrivateAssistance()`: success → `callStarted('private')`; failed → `callStarted` + `callNotAnswered()`; not_configured → estado sin servicio | `/emergency/in-call?target=private` · `/emergency/no-answer?reason=failed` | OK |
| «Llamar ya» | igual que la cuenta atrás, sin esperar | igual | OK |
| «Cancelar» | detiene la cuenta atrás | back (o `/emergency`) | OK |
| «Prefiero llamar al 112» (rojo suave) | detiene; 112 | `/emergency/in-call?target=official` (replace) | OK |
| «Configurarlo» (sin servicio) | — | `/private-assistance` | OK |
| «Llamar al 112» (sin servicio) | 112 | in-call official | OK |

Estados: cargando servicio · sin servicio (+ nota oficial 112) · cuenta atrás · detenida (app en segundo plano / servicio recién configurado) · abriendo teléfono · checklist (información, ubicación, mensaje, contacto) · demo: «la llamada a la central de ejemplo es simulada».
Llega desde: `/emergency` y prepared («Llamar a {servicio}»); in-call/no-answer si el servicio ya no está configurado.

### 40. `/emergency/in-call` — Emergencia · Llamada en curso

Archivo: `src/screens/emergency/EmergencyInCallScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/emergency` Emergencia (principal) → **«Llamar al 112» (rojo)**
- `/emergency/confirm` Emergencia · Confirmación → **«Llamar al 112 ahora» (rojo, pie)**
- `/emergency/assistant` Emergencia · Asistente (escuchando) → **«Llamar al 112 ahora» (rojo)**
- `/emergency/prepared` Emergencia · Información preparada → **«Llamar al 112» (rojo, pie)**
- `/emergency/calling` Emergencia · Cuenta atrás / preparación → **Cuenta atrás 5 s**
- `/emergency/calling` Emergencia · Cuenta atrás / preparación → **«Prefiero llamar al 112» (rojo suave)**
- `/emergency/no-answer` Emergencia · Sin respuesta del servicio privado → **«Volver a llamar a {servicio}» (azul)**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Flecha «Volver» (blanca) | back | anterior | OK |
| «Llamar al 112» (solo destino privado) | 112 | in-call official (replace) | OK |
| «Mensaje» | — | `/emergency/voice-message` | OK |
| «Mi información» | — | `/emergency/prepared` | OK |
| «Avisar familiar» (si hay contacto) | — | `/emergency/notify` | OK |
| «Volver a llamar» (azul privado / rojo 112) | privado: `callPrivateAssistance()` + `callStarted` (not_configured → `/emergency/calling`, failed → aviso); 112: `callOfficialEmergency()` | marcador | OK |
| «Sí, me han atendido» | `callAnswered()` | `/emergency/call-done?target=…` (replace) | OK |
| «No contestan» | privado: `callNotAnswered()`; 112: muestra «Vuelve a intentarlo» | privado → `/emergency/no-answer` (replace); 112 → misma pantalla | OK |
| «Volver a llamar al 112» (112 sin respuesta) | `callOfficialEmergency()` | marcador | OK |

Estados: privada / 112 · tiempo desde que se abrió la llamada (`useElapsedSeconds`) · sin llamada registrada (sin contador) · demo: «esta llamada es simulada» · 112 sin respuesta · con/sin contacto.
Llega desde: calling, 112 de cualquier pantalla del flujo (con sesión), no-answer («Volver a llamar»), call-done (112).

### 41. `/emergency/no-answer` — Emergencia · Sin respuesta del servicio privado

Archivo: `src/screens/emergency/EmergencyNoAnswerScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/emergency/calling` Emergencia · Cuenta atrás / preparación → **Cuenta atrás 5 s**
- `/emergency/in-call` Emergencia · Llamada en curso → **«No contestan»**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Flecha «Volver» | back | anterior | OK |
| «Volver a llamar a {servicio}» (azul) | `callPrivateAssistance()` → `callStarted('private')` (failed → aviso; not_configured → calling) | `/emergency/in-call?target=private` (replace) | OK |
| «Llamar al 112» (sección roja «¿Es grave o no mejora?») | 112 (decisión explícita) | in-call official (replace) | OK |
| «Avisar a {nombre}» | — | `/emergency/notify` | OK |
| «Escuchar el mensaje para el operador» | — | `/emergency/voice-message` | OK |
| «Ver mi información» | — | `/emergency/prepared` | OK |
| «Terminar y volver al inicio» | `confirmAsync` → `finish()` | Inicio `/(tabs)` | OK |

Estados: no contestó / no se pudo abrir la llamada (`?reason=failed`) · checklist preparando/listo (según disponibilidad y permisos) · con/sin contacto. Sin la palabra «automáticamente» (comprobado).
Llega desde: in-call («No contestan», privado), calling (no se pudo abrir la llamada).

### 42. `/emergency/call-done` — Emergencia · Confirmación posterior

Archivo: `src/screens/emergency/EmergencyCallDoneScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/emergency/in-call` Emergencia · Llamada en curso → **«Sí, me han atendido»**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Flecha «Volver» | `confirmAsync` → `finish()` | Inicio | OK |
| «Ver mi información» | — | `/emergency/prepared` | OK |
| «Avisar a familiar» (si hay contacto) | — | `/emergency/notify` | OK |
| «Llamar al 112» / «Volver a llamar al 112» (rojo suave) | 112 | in-call official (replace) | OK |
| «Volver al inicio» | `finish()` | Inicio (`dismissTo`; si no está en la pila, se abre) | OK |

Estados: privada («Has hablado con {servicio}») / 112 («Has llamado al 112») · checklist · con/sin contacto.
Llega desde: in-call («Sí, me han atendido»).

### 43. `/emergency/notify` — Emergencia · Avisar a familiar/cuidador

Archivo: `src/screens/emergency/EmergencyNotifyScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/emergency/prepared` Emergencia · Información preparada → **«Avisar a {nombre}» (si hay mensaje para el contacto)**
- `/emergency/in-call` Emergencia · Llamada en curso → **«Avisar familiar» (si hay contacto)**
- `/emergency/no-answer` Emergencia · Sin respuesta del servicio privado → **«Avisar a {nombre}»**
- `/emergency/call-done` Emergencia · Confirmación posterior → **«Avisar a familiar» (si hay contacto)**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Flecha «Volver» | back | anterior | OK |
| «Enviar mensaje a {nombre}» → «Enviar otro aviso» | `EmergencyService.notifyCaregiver(report)` → ok: `caregiverNotified()` + aviso verde; error: aviso rojo | app de Mensajes con el texto (la persona pulsa Enviar) | OK (demo: no se envía SMS, aviso) |
| «Llamar a {nombre}» | `callPhone` | marcador | OK (demo: no marca, aviso) |
| «Cambiar permisos» (aviso desactivado) | — | `/emergency-sharing` | OK |
| «Completar mi perfil» (contacto sin teléfono) | — | `/emergency-profile-edit` | OK |
| «Añadir contacto» (sin contacto) | — | `/emergency-profile-edit` | OK |
| «Llamar al 112» (rojo suave, pie) | 112 | in-call official | OK |
| «Reintentar» (error) | `prepare(true)` | — | OK |

Estados: cargando · error · sin contacto (EmptyState) · aviso desactivado · falta teléfono · vista previa del mensaje · demo · enviado / error.
Llega desde: prepared, in-call, no-answer, call-done.

### 44. `/emergency/voice-message` — Emergencia · Mensaje para el operador

Archivo: `src/screens/emergency/EmergencyVoiceMessageScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/emergency/prepared` Emergencia · Información preparada → **«Escuchar el mensaje para el operador»**
- `/emergency/in-call` Emergencia · Llamada en curso → **«Mensaje»**
- `/emergency/no-answer` Emergencia · Sin respuesta del servicio privado → **«Escuchar el mensaje para el operador»**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Flecha «Volver» | back (la voz se detiene) | anterior | OK |
| Botón redondo «Reproducir / Detener el mensaje» | `useSimpleSpeech().speak('op', voiceMessage, 0.8)` / `stop()` (onda activa) | — | OK |
| «Llamar al 112» (rojo, pie) | detiene la voz; 112 | in-call official | OK |
| «Reintentar» (error) | `prepare(true)` | — | OK |

Estados: preparando · error · listo (transcripción completa entre comillas) · reproduciendo. Nota «No es un diagnóstico».
Llega desde: prepared, in-call («Mensaje»), no-answer.

### 45. `/emergency-profile` — Perfil de emergencia

Archivo: `src/screens/emergencyProfile/EmergencyProfileScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/profile` Perfil y ajustes (pestaña) → **Mi perfil de emergencia**
- `/emergency-profile-edit` Editar perfil de emergencia → **Volver (flecha)**
- `/emergency-profile-edit` Editar perfil de emergencia → **"Guardar"**
- `/emergency-sharing` Permisos para compartir información → **Volver (flecha)**
- `/private-assistance` Número privado de asistencia → **Volver (flecha)**
- `/emergency` Emergencia (principal) → **Fila «Prepara tu perfil de emergencia» (perfil vacío)**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Volver (flecha) | Atrás; sin historial → `/(tabs)` | Inicio | OK |
| "Editar" (cabecera) | — | `/emergency-profile-edit` | OK |
| "Medicamentos habituales · N ⌄" | Despliega / oculta la lista | — | OK (no pulsable si no hay medicamentos) |
| Llamar al médico de cabecera (icono) | `callPhone(teléfono)` | Marcador | OK · solo si hay teléfono (en demostración avisa y no marca) |
| Llamar al contacto de emergencia (icono) | `callPhone(teléfono)` | Marcador | OK · ídem |
| Mini mapa / "Ver en el mapa" | `openAddressInMaps(dirección completa)` | App de mapas | OK · solo si hay dirección |
| "Qué compartir en una emergencia" | — | `/emergency-sharing` | OK |
| "Número privado de asistencia" | — | `/private-assistance` | OK |
| "Borrar mi perfil de emergencia" (rojo, al final) | Confirmación destructiva → borra la fila del servidor, la copia cifrada del teléfono y el médico guardado en el teléfono. No elimina la cuenta | Estado vacío ("Aún no has preparado tu perfil de emergencia") | OK · si falla, aviso y no se borra nada |
| "Crear mi perfil" (estado vacío) | — | `/emergency-profile-edit` | OK |
| "Reintentar" (estado error) | `reload()` | — | OK |
| Deslizar hacia abajo | `refresh()` | — | OK |

Estados: loading (esqueleto de tarjetas) · éxito · vacío (`EmptyState`) · copia local ("Mostrando la última copia guardada en este teléfono") · error (`ErrorState`) · se refresca al volver (`useRefreshOnFocus`).
Llega desde: Perfil "Mi perfil de emergencia" · Emergencia "Mi perfil" · Volver de editar / compartir / número privado.

### 46. `/emergency-profile-edit` — Editar perfil de emergencia

Archivo: `src/screens/emergencyProfile/EmergencyProfileEditScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/emergency-profile` Perfil de emergencia → **"Editar" (cabecera)**
- `/emergency-profile` Perfil de emergencia → **"Crear mi perfil" (estado vacío)**
- `/emergency/prepared` Emergencia · Información preparada → **«Completar mi perfil» (perfil vacío)**
- `/emergency/notify` Emergencia · Avisar a familiar/cuidador → **«Completar mi perfil» (contacto sin teléfono)**
- `/emergency/notify` Emergencia · Avisar a familiar/cuidador → **«Añadir contacto» (sin contacto)**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Volver (flecha) | Con cambios: `confirmAsync('¿Salir sin guardar?', destructive)`; sin cambios: sale | Atrás o `/emergency-profile` | OK · también botón atrás de Android; gesto de iOS desactivado con cambios |
| Nombre y apellidos* · Fecha de nacimiento (DD/MM/AAAA, barras automáticas) | Validación en línea al guardar | — | OK |
| Calle y número · Código postal (5 cifras) · Ciudad · Provincia · País ("España") | — | — | OK |
| Medicamentos habituales (varias líneas) · Alergias · Enfermedades relevantes | — | — | OK |
| Chips grupo sanguíneo A+ A− B+ B− AB+ AB− 0+ 0− "No lo sé" | Seleccionar / quitar | — | OK |
| Nombre del médico · Teléfono del médico ("Se guarda solo en este teléfono") | — | — | OK |
| Nombre del contacto · chips Hija/Hijo/Pareja/Hermana/Hermano/Amistad/Otra (+ texto si "Otra") · Teléfono del contacto | — | — | OK |
| "Guardar" | `EmergencyService.updateEmergencyProfile(input)` (conserva `permissions`) → `showAlert` → atrás | `/emergency-profile` | OK · `synced=false` → muestra el mensaje del servicio |
| "Reintentar" (error de carga) | `reload()` | — | OK |

Estados: loading (esqueleto) · error de carga · errores por campo (y desplazamiento a la sección) · error general sobre "Guardar" · guardado local.
Llega desde: Perfil de emergencia "Editar" / "Crear mi perfil" · Emergencia "Añadir contacto" / "Completar mi perfil".

### 47. `/emergency-sharing` — Permisos para compartir información

Archivo: `src/screens/emergencyProfile/EmergencySharingScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/profile` Perfil y ajustes (pestaña) → **Qué compartir en una emergencia**
- `/emergency-profile` Perfil de emergencia → **"Qué compartir en una emergencia"**
- `/privacy` Privacidad y datos → **Qué compartir en una emergencia**
- `/emergency/prepared` Emergencia · Información preparada → **«Cambiar qué se comparte» (si algo no se comparte)**
- `/emergency/notify` Emergencia · Avisar a familiar/cuidador → **«Cambiar permisos» (aviso desactivado)**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Volver (flecha) | Atrás; sin historial → `/emergency-profile` | Perfil de emergencia | OK |
| 7 interruptores (ubicación, dirección y datos personales, medicamentos, alergias, enfermedades y datos médicos, conversación previa, avisar al contacto) | `EmergencyService.updateSharingPermissions` al momento (optimista, en orden; si falla vuelve atrás y avisa) | — | OK |
| "Reintentar" (error) | `reload()` | — | OK |

Estados: loading (esqueleto) · error · "Guardando…" · "Cambios guardados" · "Guardado en este teléfono" (`synced=false`) · aviso rojo si falla. Tarjetas "Tus datos viajan cifrados…" e "Importante".
Llega desde: Perfil de emergencia · Perfil · Privacidad · Emergencia "Cambiar permisos".

### 48. `/private-assistance` — Número privado de asistencia

Archivo: `src/screens/emergencyProfile/PrivateAssistanceScreen.tsx` · Acceso: Con sesión

**Se llega desde:**

- `/profile` Perfil y ajustes (pestaña) → **Número privado de asistencia**
- `/emergency-profile` Perfil de emergencia → **"Número privado de asistencia"**
- `/emergency/prepared` Emergencia · Información preparada → **«Configurarlo» (sin servicio privado)**
- `/emergency/calling` Emergencia · Cuenta atrás / preparación → **«Configurarlo» (sin servicio)**

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Volver (flecha) | Atrás; sin historial → `/emergency-profile` | Perfil de emergencia | OK |
| "Cambiar" (servicio propio) | Abre el formulario relleno | — | OK |
| "Quitar" (servicio propio) | `confirmAsync` → `clearPrivateAssistanceService()` | — | OK |
| "Usar otro número" (central de MediClaro) | Abre el formulario vacío | — | OK |
| "Nombre del servicio" · "Teléfono" | — | — | OK |
| "Guardar" | `setPrivateAssistanceService({name, phone})`; `invalid_input` en línea (p. ej. 112) | — | OK |
| "Cancelar" (si ya hay un número) | Cierra el formulario | — | OK |
| "Reintentar" (error) | `reload()` | — | OK |

Estados: loading (esqueleto) · servicio propio ("Guardado en este teléfono") · central de MediClaro ("Ahora usas: …") · sin número (texto + formulario) · error · avisos "Número guardado" / "Has quitado…". Nota fija `OfficialEmergencyNote`.
Llega desde: Perfil de emergencia · Perfil · Emergencia "Configurarlo" / preparada.

### 49. `+not-found` — Pantalla no encontrada

Archivo: `src/screens/auth/NotFoundScreen.tsx` · Acceso: Pública

**Se llega desde:**

- Cualquier ruta o enlace profundo inexistente

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Volver (flecha) | Atrás; sin historial → `/` | Inicio / bienvenida | OK |
| "Volver al inicio" | `router.replace('/')` | Inicio (con sesión) o bienvenida | OK |

Estados: única vista. Llega desde: cualquier enlace o ruta inexistente.

## 3. Elementos globales

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Barra inferior "Inicio" | Pestaña | `/(tabs)` | OK |
| Barra inferior "Mis meds" | Pestaña | `/(tabs)/medicines` | OK |
| Barra inferior "Asistente" | Pestaña | `/(tabs)/chat` | OK |
| Barra inferior "Perfil" | Pestaña | `/(tabs)/profile` | OK |
| Franja amarilla "Modo demostración · Salir" / "Acceso de prueba · Salir" (solo compilaciones de prueba) | Confirma y cierra la sesión | `/welcome` | OK |
| "Volver" (flecha de la cabecera) | Atrás; sin historial → ruta de respaldo de cada pantalla | anterior | OK |
| Pantalla «Antes de usar la inteligencia artificial» · «Aceptar y continuar» / «Ahora no» | Concede el permiso (registrado) / no envía nada | la misma pantalla | OK |
| Pantalla bloqueada «… con MediClaro Premium» (identificar, asistente, lectura por voz, añadir y ver medicamentos) · «Ver planes» | — | `/premium` | OK |
| Pantalla bloqueada · «Volver al inicio» | — | `/(tabs)` (sin sesión: `/welcome`) | OK |
| Pantalla bloqueada · «¿Es una urgencia? El 112 siempre está disponible» | — | `/emergency` | OK |
| Hoja «SIMULACIÓN» de la tienda / página de tarjeta simulada (solo compilaciones de prueba sin tienda real) · «Suscribirse» / «Pagar» / «Cancelar» | Simula la compra sin cobrar nada (tarjeta de prueba 4242…) | la pantalla de origen | OK · solo pruebas |

## 4. Actualización 09/10/2026 (RC-2026-10-09) — rutas nuevas

Rutas añadidas desde la versión 1.2 de este mapa: `/pills`, `/pills/edit`, `/pills/reminder`, `/pills/history`,
`/pills/settings`, `/pills/patient` («Mis pastillas», Premium; documentación completa en `MIS_PASTILLAS.md`) y
`/family-pay` («Que pague mi familiar o cuidador/a»). `/tour` es ahora una explicación continua en una sola toma
(sin partes): barra de progreso, pausa, «Empezar de nuevo», «Saltar» y altavoz.

### `/pills` — Mis pastillas
Se llega desde: Inicio («Mis pastillas · Próxima…», `home-pills`), Mis medicamentos (`medicines-pills`), Resultado de
la foto («Añadir a Mis pastillas (avisos)», `result-add-pills`), ficha guardada (`saved-add-pills`), Mi cuidador/a.

| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| Tarjeta «Próxima toma» · «Ver esta toma» (`pills-next-open`) | Abre el aviso de esa toma | `/pills/reminder` | OK |
| Fila de cada toma de hoy (`pills-dose-*`) | Abre esa toma | `/pills/reminder?t=…&d=…&h=…` | OK |
| «Añadir un medicamento» (`pills-add`) | — | `/pills/edit` | OK |
| «Cambiar la pauta» de cada medicamento | — | `/pills/edit?id=…` | OK |
| «Historial de tomas» (`pills-history`) | — | `/pills/history` | OK |
| «Preguntar a MediClaro» (`pills-ask`) | Pregunta «¿Qué pastillas me quedan hoy?» | `/assistant?question=…` | OK |
| Engranaje / «Ver cómo es el aviso» / «Activar avisos» / «Abrir ajustes» | Ajustes o permiso de notificaciones | `/pills/settings` o ajustes del teléfono | OK |

### `/pills/edit` — Añadir o cambiar la pauta
Nombre (o «Desde la caja»), concentración, cantidad (− / +) y forma, horas (añadir/quitar), días (todos / algunos /
cada X días), desde/hasta, instrucciones, notas, avisos, confirmación «Me la indicó mi médico o farmacéutico»
(`pills-form-confirm`, obligatoria), «Guardar» (`pills-form-save`), «Dejar de tomarlo (se guarda el historial)»
(`pills-form-archive`). Volver → `/pills`.

### `/pills/reminder` — Aviso de tu medicamento
| CONTROL | ACCIÓN | DESTINO | ESTADO |
|---|---|---|---|
| «Sí, ya la he tomado» / «Ya me la he tomado» (`pill-reminder-taken`) | Registra la toma con la hora actual | la misma (confirmada) | OK |
| «Recordármelo después» (`pill-reminder-snooze`) | Aplaza N minutos | la misma | OK |
| «Todavía no la he tomado» (`pill-reminder-notyet`) | Anota «todavía no» (no es una toma) | `/pills` | OK |
| «Me la tomé a otra hora» (hace 15 min / 30 min / 1 h) | Toma con la hora declarada | la misma | OK |
| «No me la voy a tomar» → «Sí, anotar como no tomada» | Toma omitida | la misma | OK |
| «He tomado otra dosis» → aviso de posible toma doble → «Sí, me he tomado otra dosis» | Toma adicional (incidencia) | la misma | OK |
| «Volver a Mis pastillas» | — | `/pills` | OK |

### `/pills/history` — Historial de tomas
Hoy / Ayer / Esta semana / Este mes / Elegir fechas; resumen; tocar una toma → detalle con «Corregir: no me la
tomé», «Corregir la hora» (con motivo) y «Registrar que la tomé» (a posteriori); «Compartir mi historial» (móvil) o
«Descargar mi historial» (CSV, navegador).

### `/pills/settings` — Avisos de Mis pastillas
Avisarme de mis tomas, con sonido, leer el aviso en voz alta, mostrar el nombre del medicamento (pantalla
bloqueada), repetir el aviso a los N min, «Recordármelo después» N min, «Probar el aviso», permisos de cada
cuidador/a (ver, confirmar por mí, avisarle si no confirmo), «Borrar todos mis datos de medicación».

### `/pills/patient?id=…&name=…` — Pastillas de [familiar] (cuidador/a autorizado)
Tomas de la semana con incidencias; «Confirmar que la ha tomado» → «Sí, la ha tomado» (si tiene permiso);
«Volver a Mi cuidador/a».

### Barra inferior (actualizada)
Inicio · Mis meds · **[botón central redondo «Cuidador/a»]** · Asistente · Perfil. El botón central (`tab-care-chat`)
abre `/caregiver` (chat de los avisos con el cuidador/a; si hay un aviso activo, lleva un punto).

### Otros controles nuevos
| Pantalla | CONTROL | ACCIÓN | ESTADO |
|---|---|---|---|
| `/profile` | «Memoria del asistente» (`profile-assistant-memory`) | Activa/desactiva la memoria (en el chat solo se ofrece mientras está desactivada) | OK |
| `/saved/[id]` | «Poner/Cambiar la foto de mi caja» (`saved-box-photo`) · «Quitar la foto de mi caja» | Foto propia, solo en el teléfono | OK |
| `/pills/edit` | «Usar la foto que acabo de hacer» · «Hacer una foto de la caja» · «Elegir una foto» · «Quitar mi foto» | Foto de la caja de esa pauta | OK |
| `/emergency/voice-message` | «Avisar a mi cuidador/a» (`voice-message-notify`) | — → `/emergency/notify` | OK |
| `/pills/settings` | «Probar el aviso» | Móvil: aviso real en 5 s con la alarma. Vista previa: abre el aviso con alarma y voz | OK |

### `/family-pay` — Que pague mi familiar o cuidador/a
«Enviar por WhatsApp», «Enviar por SMS», «Compartir enlace» → «¡Invitación enviada!» (Premium se activa solo cuando el
familiar paga). Se llega desde `/payment` («Que pague mi familiar o cuidador/a», `payment-method-family`).

---

## 4. Añadido el 09/10/2026 por la tarde

### `/welcome` — foto de homenaje
Arriba el logo de MediClaro y su frase; debajo, la foto de Isabel y José entera (`TributePhoto`, testID
`tribute-photo`, configurada en `src/content/homenaje.ts`), con esquinas redondeadas y borde fino. Sin fotos:
«Aquí irá vuestra foto» (`tribute-placeholder`) solo en pruebas.

### `/` — Inicio: aviso general
Si el propietario ha puesto un aviso (`/owner/notice`), sale arriba con su título, el mensaje y «Entendido» (testID
`app-notice`), que lo oculta en ese teléfono.

### 50. `/caregiver-chat` — Chat con el cuidador/a
Cabecera con la persona, botón de llamada (`care-chat-call`) y «112» para la persona cuidada. Burbujas con
«Escuchar», hora y «Visto»; separadores por día; registro de llamadas (`care-chat-call-log`); respuestas rápidas
(`care-chat-quick`); campo (`care-chat-input`) y enviar (`care-chat-send`). Mensaje fallido: «Reintentar» / «Quitar».

### 51. `/caregiver-call` — Llamada de voz
Saliente («Llamando…»), entrante («Te está llamando»: `care-call-decline`, `care-call-accept`,
`care-call-reply-chat`), en llamada (`care-call-mute`, `care-call-hangup`, contador `care-call-clock`) y finalizada
(`care-call-again`, `care-call-chat`). En la vista previa, etiqueta «Llamada de prueba» (`care-call-simulated`).

### 52–70. Panel del propietario
Entrada desde Perfil › «Panel de propietario» (`profile-owner-dashboard`, solo teléfonos de propietario). Sigue las
12 pantallas del diseño del propietario. Detalle de cada pantalla, seguridad y pasos: `PANEL_PROPIETARIO.md`.
Controles principales:
- Acceso: código (`owner-pin`), acceder (`owner-access-submit`), Face ID (`owner-faceid`), «¿Olvidaste tu código?»
  (`owner-forgot`).
- Dashboard: campana (`owner-bell`), foto o iniciales → Mi cuenta (`owner-account-avatar`), fichas
  (`owner-tile-users`, `owner-tile-vouchers`, `owner-tile-subscriptions`, `owner-tile-settings`, `owner-tile-stats`,
  `owner-tile-audit`) y «Cuenta de propietario» → Información (`owner-hero`).
- Bonos: crear (`owner-voucher-create`), tipo (`owner-voucher-type-full|family`), duración
  (`owner-voucher-days-7|30|90|365|life`), cantidad (`owner-voucher-uses`), generar (`owner-voucher-submit`), dar el
  bono (`owner-voucher-give`), desactivar / activar (`owner-voucher-toggle`).
- Conceder Premium: desde Bonos (`owner-open-grant`), buscar (`owner-grant-search`), persona
  (`owner-grant-user-<id>`), por teléfono (`owner-grant-mode`, `owner-grant-phone`), conceder (`owner-grant-submit`).
- Usuarios (`owner-users-search`, `owner-user-<id>`), ficha: conceder (`owner-user-grant`) y retirar
  (`owner-user-revoke`).
- Suscripciones: pestañas (`owner-tab-active|history`), tarjetas (`owner-sub-<n>`) y «Ver detalles»
  (`owner-sub-<n>-details`).
- Estadísticas: periodo (`owner-chip-7|30|90|365`), cifras (`owner-stats-active|doses|bonos|premium`), gráfico
  (`owner-stats-chart`).
- Registro: pestañas (`owner-tab-activity|events`), filas que se abren (`owner-audit-<id>`), «Ver más antiguos»
  (`owner-audit-more`).
- Configuración (`owner-settings-account|security|notice|backup|system`); Notificaciones (`owner-notice-enabled`,
  `owner-notice-title`, `owner-notice-message`, `owner-notice-save`); Respaldos
  (`owner-backup-users|subscriptions|bonos|audit`).
- Mi cuenta (`owner-account-premium`, `owner-account-pin`, `owner-account-security`, `owner-account-signout`);
  Seguridad: cambiar código (`owner-change-pin`), Face ID (`owner-faceid-on|off`) y cerrar el panel
  (`owner-security-lock`); Información: «Volver al dashboard» (`owner-info-back`).

### 71. `/pills/help` — Cómo funciona Mis pastillas (Premium)
Se llega desde: Mis pastillas, tarjeta «¿Cómo funciona Mis pastillas?» (`pills-how`, botón `pills-how-open`) y
Ajustes de Mis pastillas, fila «Cómo funciona» (`pills-settings-help`). Siete pasos con dibujo; «Añadir un
medicamento» (`pills-help-add` → `/pills/edit`) y «Probar cómo es el aviso» (`pills-help-test` → `/pills/settings`).
Atrás → `/pills`.

### Actualización 09/10/2026 (tarde): chat encendido/apagado y Cuidador y avisos
- **Regla del chat**: lo enciende la persona cuidada; su cuidador/a puede responder durante 1 hora desde el último
  mensaje de ella; después, apagado hasta que vuelva a escribir (el servidor rechaza con `CHAT_CLOSED`).
- **Inicio** (`/`): tarjeta grande del chat al final (`home-care-chat`): persona cuidada → `/caregiver-chat` (un
  solo cuidador/a) o `/caregiver`; cuidador/a con el chat encendido → el chat; apagado (`home-care-chat-off`) →
  `/caregiver`; sin Premium (candado) → `/premium`; sin cuidador/a → `/caregiver`. Contador de no leídos
  (`home-care-chat-unread`).
- **Barra inferior**: el botón central es `tab-care-chat` (encendido o con aviso) o `tab-care-chat-off`
  («Apagado», rojo con el puntito) para el cuidador/a sin ninguna conversación encendida.
- **`/caregiver`** (Cuidador y avisos, rediseñada): cabecera con la guía; estado; tarjeta del chat
  (`caregiver-chat-card-<link>`, puntito `caregiver-chat-off-<link>`, abrir `caregiver-chat-open-<link>`, llamar
  `caregiver-chat-call-<link>`); **«Cómo funciona»** (`caregiver-how`, dibujo `caregiver-how-stage`, título
  `caregiver-how-title`, escuchar/pausar/seguir/otra vez `caregiver-how-listen`, `caregiver-how-prev`,
  `caregiver-how-next`); Mis pastillas y tu cuidador/a; vincular; vinculaciones; «Practicar sin riesgo»; «En este
  móvil».
- **`/caregiver-chat`**: línea de estado bajo la cabecera (`care-chat-window-on` / `care-chat-window-off`); con el
  chat apagado el campo dice «Chat apagado» y no deja escribir; para la persona cuidada, «Escríbele: X podrá
  responderte durante 1 hora».
