# MediClaro — Especificación funcional exacta

## 1. Objetivo del producto
MediClaro es una aplicación móvil iOS/Android de apoyo sanitario y acompañamiento, especialmente pensada para personas mayores o usuarios que necesitan explicaciones claras sobre medicamentos, seguimiento de seguridad y conexión con una persona cuidadora.

La app debe ser simple, visual, accesible y usable con poca experiencia tecnológica. El diseño actual debe conservarse y mejorarse sin reconstruirlo desde cero.

## 2. Perfiles y acceso

### 2.1 Perfil Básico
Es el acceso gratuito por defecto. No debe preguntarse "Soy usuario", porque toda persona que entra gratis ya es usuario básico.

Datos del perfil:
- Nombre: obligatorio.
- Sexo: obligatorio.
- Edad: obligatoria.
- Teléfono: opcional.
- Foto de perfil: disponible en todos los perfiles.

El perfil Básico debe mostrar claramente qué funciones están bloqueadas por Premium mediante candados y estados desactivados, sin permitir que la función Premium se ejecute accidentalmente.

### 2.2 Perfil Cuidador/a
Ser cuidador/a es gratuito.
- No se pide teléfono.
- No se pide SMS.
- No se exige verificación telefónica.
- Debe poder tener nombre, sexo, edad y foto.
- Puede recibir avisos, mensajes y llamadas de pacientes Premium vinculados.
- Ser cuidador/a NO concede Premium para su uso personal.
- Si además compra Premium, se muestra claramente "Cuidador/a + Premium".

En la interfaz no debe existir un selector confuso "Soy usuario / Soy cuidador". El acceso gratuito ya es Básico. La acción debe llamarse "Elegir o cambiar mi perfil" y desde ahí permitir convertirse o gestionar el perfil de cuidador.

### 2.3 Perfil Premium
El paciente Premium desbloquea IA real, identificación/explicación completa de medicamentos, voz natural, funciones de seguridad Premium y vinculación de cuidadores.

El teléfono puede pedirse dentro del flujo Premium cuando sea necesario para completar/verificar la cuenta de pago, pero no debe convertirse en requisito del cuidador gratuito.

## 3. Vinculación paciente Premium ↔ cuidador/a

Cada paciente Premium debe disponer de un código fijo de 6 números.

La vinculación debe poder iniciarse de dos formas equivalentes:
1. Introducir manualmente el código de 6 números.
2. Escanear un QR que represente ese mismo código.

El QR es opcional. Nunca debe ser la única forma de vincular.

Flujo exacto:
1. El paciente Premium ve su código de 6 cifras y puede mostrar/compartir el QR.
2. La persona cuidadora introduce el código o escanea el QR.
3. La app envía una solicitud de vinculación al paciente.
4. El paciente recibe una solicitud visible con el nombre/foto del solicitante.
5. El paciente pulsa Aceptar o Rechazar.
6. Antes de aceptar no se comparten avisos, mensajes ni datos.
7. Al aceptar, el cuidador queda identificado claramente como "Cuidador/a de [Nombre del paciente]".
8. El paciente ve de forma clara quién está vinculado como cuidador/a.
9. Puede haber más de una vinculación activa si el modelo de backend lo permite.

### 3.1 Desvinculación
El paciente Premium puede desvincular a un cuidador cuando quiera.
Debe existir una confirmación de seguridad:
- "¿Desvincular cuidador/a?"
- Explicar que dejará de recibir avisos, mensajes y datos compartidos.
- Botones "Cancelar" y "Sí, desvincular".

La persona cuidadora también puede abandonar una vinculación voluntariamente con confirmación.

Si una persona deja de tener su última vinculación como cuidador:
- si no paga Premium, vuelve a perfil Básico;
- si tiene Premium activo, sigue siendo Premium.

## 4. Explicación del perfil cuidador
Dentro del perfil Básico debe existir una sección clara:
- Título: "¿Quieres ser cuidador/a?"
- Explicar que es gratis.
- Explicar que no necesita teléfono ni SMS.
- Explicar cómo vincular con código o QR.
- Explicar que el paciente debe aceptar.
- Explicar cómo quitar la vinculación.
- Explicar que se puede ser "Cuidador/a + Premium".
- Incluir apoyo visual con iconos/ilustraciones.
- Incluir botón para escuchar la explicación con voz natural.

## 5. Identificación y explicación de medicamentos

### 5.1 Identificación
La identificación por fotografía que ya funciona debe protegerse y no reescribirse innecesariamente.
No usar lectura de código de barras como función principal.

El resultado debe utilizar fuentes oficiales cuando sea posible, especialmente CIMA/AEMPS en España.

### 5.2 Lectura en voz alta
La explicación del medicamento debe reproducirse como UN audio continuo.

No debe reproducir una tarjeta y luego otra de forma que una palabra quede partida, por ejemplo:
- tarjeta 1: "senci-"
- tarjeta 2: "llas"

La voz de lectura de medicamentos debe ser Sulafat.

La interfaz de audio debe ser visualmente cuidada y coherente con MediClaro:
- botón principal Reproducir/Pausar;
- botón Repetir explicación desde el principio;
- iconos claros;
- indicador de progreso;
- tiempo actual y duración;
- estado "Preparando", "Reproduciendo", "En pausa", "Finalizado";
- ondas/animación visual discreta;
- diseño responsive.

Si Sulafat falla, NO sustituirla silenciosamente por una voz robótica del dispositivo. Debe mostrarse un error y permitir reintentar.

## 6. Asistente IA "Lucía"

Lucía debe comportarse como una conversación continua, no como respuestas aisladas.

### 6.1 Comportamiento
- No debe volver a decir "Hola" en cada turno.
- No debe presentarse de nuevo en cada respuesta.
- Debe responder directamente en contexto.
- Debe preguntar de forma natural "¿Cómo estás hoy?" cuando encaje.
- Debe conversar con amabilidad, comprensión y acompañamiento.
- No debe fingir ser una persona humana.
- No debe sustituir a profesionales sanitarios.
- No debe inventar diagnósticos, dosis, interacciones o prospectos.

### 6.2 Historial y memoria
Las conversaciones deben persistir al cerrar la app o cambiar de pantalla.
La IA debe poder utilizar el contexto acumulado para responder mejor.

Debe existir:
- historial persistente;
- contexto longitudinal resumido;
- memoria opcional para datos cotidianos no sensibles como aficiones, rutinas o mascotas;
- control del usuario para borrar voluntariamente historial/memoria desde Privacidad/Configuración.

No borrar automáticamente las conversaciones.

La memoria cotidiana no debe almacenar secretos ni datos especialmente sensibles salvo el contexto médico necesario para continuidad conversacional, que debe tratarse como información sanitaria protegida y privada del usuario.

### 6.3 Escritura progresiva
Antes de responder debe aparecer "Pensando..." con animación.

La respuesta no debe aparecer de golpe.
Debe mostrarse progresivamente, como si alguien escribiera en directo, a una velocidad legible y normal.

El historial antiguo no debe volver a animarse al abrir una conversación: solo la nueva respuesta.

### 6.4 Voz de Lucía
La IA Premium debe responder automáticamente por voz cuando llega una nueva respuesta, tanto si el usuario escribió como si habló.

Voces naturales disponibles:
- Sulafat.
- Achird.
- Aoede, con tono más suave/armonioso.

La voz elegida debe respetarse.
No usar la voz robótica del sistema como fallback silencioso.
Si la voz natural no está disponible, mostrar un error claro.

### 6.5 Micrófono
Debe existir un control central, bien distribuido y responsive:
- título "Hablar con Lucía";
- mantener pulsado para grabar;
- soltar para enviar;
- estado "Te escucho…";
- estado "Entendiendo tu mensaje…";
- después enviar el texto transcrito a la conversación;
- Lucía responde en texto progresivo y automáticamente por voz.

Al abrir el teclado el bloque del micrófono debe adaptarse/ocultarse si es necesario para no tapar elementos.

Pulsar el micrófono nunca puede cerrar la app. Los permisos nativos de iOS/Android deben estar declarados correctamente.

## 7. Emergencias dentro del chat de IA

Si Lucía detecta una posible emergencia, el propio mensaje de la IA debe mostrar acciones visibles:
- "Avisar y llamar a mi cuidador/a".
- "Abrir emergencia".

La IA no debe seguir insistiendo en una urgencia cuando la persona comunica claramente que ya está bien, salvo que siga describiendo síntomas graves actuales.

### 7.1 Aviso al cuidador
Cuando el paciente pulsa "Avisar y llamar a mi cuidador/a":
1. Crear incidente de emergencia.
2. Enviar aviso al cuidador vinculado y aceptado.
3. Abrir el chat de emergencia.
4. Compartir el motivo comunicado.
5. Compartir ubicación autorizada en tiempo real cuando esté disponible.
6. Iniciar la llamada de audio por Internet al cuidador automáticamente, sin exigir un segundo botón para iniciar la llamada.
7. El cuidador debe aceptar la llamada entrante.
8. El chat permanece disponible mientras dura el incidente.

Solo los cuidadores explícitamente aceptados pueden recibir incidentes.

### 7.2 Chat de emergencia
Debe mostrar de forma clara:
- nombre y foto del paciente/cuidador;
- estado del aviso;
- mensajes;
- confirmación "te estoy atendiendo";
- ubicación compartida;
- hora de actualización;
- posibilidad de enviar check-in;
- controles de llamada;
- finalización/cierre del incidente;
- botón Volver/Atrás conservando estado.

### 7.3 Llamada
La llamada debe ser VoIP/in-app, no una llamada telefónica de pago.
Debe usar WebRTC.

Para producción se requiere TURN correctamente configurado. STUN directo puede usarse como prueba, pero no garantiza conectividad en todas las redes.

## 8. Escalado de emergencia y 112
Objetivo funcional solicitado:
- primero contactar automáticamente con cuidador/familiar designado;
- si no responde dentro del flujo definido, escalar;
- en el diseño objetivo puede existir escalado hacia servicios de emergencia.

Estado de seguridad actual:
- NO afirmar que MediClaro realiza llamadas autónomas reales al 112 mientras no exista una integración legal, técnica y operativa validada;
- el 112 debe permanecer como llamada manual/acción explícita hasta completar esa validación;
- cualquier futura automatización debe cumplir requisitos legales, App Store y telecomunicaciones.

## 9. Ubicación
La ubicación es una función central en emergencia.
Debe:
- funcionar mediante GPS incluso sin Internet para obtener coordenadas;
- mostrar coordenadas, precisión y hora de actualización;
- compartir ubicación con cuidadores autorizados cuando exista conectividad;
- permitir seguimiento durante incidentes;
- no compartir ubicación con personas no vinculadas/aceptadas.

## 10. Notificaciones
"Activar avisos en este móvil" debe:
1. pedir permiso del sistema;
2. registrar el dispositivo;
3. mostrar éxito/error visible;
4. si está denegado, explicar cómo abrir Ajustes;
5. permitir comprobar el estado;
6. soportar notificaciones de nuevas solicitudes de cuidador, emergencia, mensajes y llamada entrante.

No debe existir un botón que parezca funcionar pero no haga nada.

## 11. Premium y pagos
Objetivo:
- Premium mensual de precio bajo;
- compra mediante Apple IAP / Google Play Billing en producción móvil;
- restauración de compras;
- verificación servidor-servidor;
- expiración/cancelación correctamente reflejada;
- el pago desbloquea Premium inmediatamente.

No usar Stripe como sustituto del IAP dentro de la app iOS para contenido digital sujeto a reglas de Apple.

Debe existir soporte de administración para conceder Premium a cuentas de prueba/autorizadas sin cobro cuando corresponda.

## 12. Diseño y accesibilidad
Mantener la identidad visual actual de MediClaro.

Reglas:
- responsive en iPhone/Android pequeños y grandes;
- nada fuera de pantalla;
- botones con tamaño táctil accesible;
- tipografía clara;
- contraste suficiente;
- estados de carga visibles;
- volver/atrás en flujos donde el usuario pueda quedar encerrado;
- conservar estado al volver;
- foto de perfil circular 1:1 con object-fit/cover equivalente;
- iconografía coherente;
- no esconder funciones importantes detrás de textos ambiguos.

## 13. Onboarding / explicación inicial
Debe ser una presentación profesional y guiada.
La voz no puede mezclarse entre una pantalla y la siguiente.
Antes de pasar al siguiente bloque:
- detener y silenciar el audio anterior;
- vaciar el buffer;
- iniciar el nuevo audio sin solapamiento.

## 14. Seguridad y privacidad
- RLS en tablas de usuario.
- Solo el propietario puede leer su historial de IA.
- Solo vínculos de cuidador aceptados pueden acceder a incidentes autorizados.
- No exponer claves de servicio en cliente.
- No incluir secretos en el ZIP ni en Git.
- Historial médico y contexto conversacional deben tratarse como datos sensibles.
- El usuario debe poder borrar sus datos mediante controles explícitos.

## 15. Funciones globales/futuras solicitadas
Objetivo de producto global, no limitado a España:
- riesgos meteorológicos y alertas cercanas;
- Google Weather y fuentes oficiales por país;
- AEMET/Protección Civil en España;
- SOS silencioso;
- seguimiento familiar;
- comunicaciones offline;
- BLE/Bluetooth;
- red mesh multi-salto;
- store-and-forward;
- cifrado extremo a extremo;
- funcionamiento entre iOS y Android.

Estas funciones no deben anunciarse como terminadas mientras no estén implementadas y probadas físicamente.

## 16. Regla de calidad antes de publicar
Una versión no se considera producción solo porque compile.

Antes de Apple/Google:
- typecheck limpio;
- tests automáticos completos;
- auditorías de seguridad;
- prueba real de cámara;
- prueba real del micrófono;
- prueba real de Sulafat/Achird/Aoede;
- prueba de IA hablada;
- prueba de persistencia del chat;
- prueba de vinculación con dos móviles;
- prueba de notificación con pantalla bloqueada;
- prueba de llamada con redes diferentes;
- prueba de ubicación;
- prueba Sandbox IAP, restore, cancelación/expiración;
- inspección del Info.plist final dentro de la IPA;
- no enviar automáticamente a Apple sin autorización explícita.
