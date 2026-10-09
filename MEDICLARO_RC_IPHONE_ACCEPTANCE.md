# MediClaro 1.0.1 RC1 — aceptación física pendiente
No completar esta lista con pruebas simuladas. Registrar dispositivo/iOS, resultado, hora y evidencia.

1. Instalar la RC nueva, cerrar la versión anterior y comprobar 1.0.1 RC1 en Ajustes.
2. Entrar por SMS con +34680127015 o +34646350527. Comprobar Premium gratuito y Perfil → Panel de propietario. No hay contraseña maestra.
3. Explicación inicial: dejar sonar los cinco audios Google sin pulsar Siguiente. Probar pausa, continuar, repetir y cambiar Sulafat/Achird. Confirmar ausencia de voz robótica del sistema.
4. Identificar una caja con la cámara, guardar medicamento, consultar Historial/Mis medicamentos, marcar/desmarcar favorito, cerrar y reabrir. Verificar persistencia y lectura de prospecto.
5. Probar texto normal/muy grande, ancho de iPhone y teclado: etiquetas completas, botones contenidos, cabecera sin solapamientos y acciones ejecutables.
6. Vincular segundo móvil como cuidador mediante invitación aceptada. El segundo iPhone requiere registro Ad Hoc o TestFlight.
7. Probar un incidente de prueba autorizado: chat solo para participantes, avisos abiertos/atendidos diferenciados, aviso por falta de respuesta y cierre que oculta el chat.
8. GPS: consentir, comprobar hora y precisión en el cuidador, revocar y confirmar ausencia inmediata de coordenadas. La actualización actual requiere app abierta.
9. Tras configurar TURN en el servidor: llamada por Internet con aceptación, audio en ambos sentidos entre Wi-Fi/datos móviles, rechazo, colgar y liberación del micrófono. Ambos móviles en primer plano.
10. Probar push/sonido con pantalla bloqueada y app cerrada. Son avisos ordinarios sujetos a ajustes; no prometer que atraviesan silencio/No molestar sin Critical Alerts aprobado.
11. Apple Sandbox con cuenta independiente sin acceso propietario: compra, restauración, cancelación/caducidad y acceso IA con entitlement del servidor. Mantener storeVerification=false hasta validar el flujo.
12. Confirmar que nunca se llama al 112 automáticamente. No realizar llamadas reales de prueba al 112.

Faltan credenciales de servidor TURN y pruebas físicas; no declarar preparada para Apple App Review mientras sigan pendientes.

## RC2/build 25 — nuevos perfiles
- En la bienvenida, elegir Soy usuario en el móvil del usuario y Soy cuidadora o cuidador en el otro. No debe pedir SMS ni cobrar por elegir.
- Usuario gratuito: IA y cámara de identificación deben mostrar bloqueo Premium. Cuidador gratuito: avisos/vínculos disponibles sin heredar Premium.
- Usuario → Cuidador y vinculación → su nombre → Mostrar mi QR para vincular. Cuidador → su nombre → Escanear QR → Confirmar vínculo. Leer QR no debe aceptar solo.
- Comprobar vínculo en ambos móviles y revocación. El usuario autoriza los avisos/GPS aparte en su perfil de emergencia.
- Cuidador → Contratar Premium para mí: oferta de su cuenta; compra real pendiente de validación Sandbox. Cambiar perfil no cambia su suscripción.
- Cerrar/reabrir sin cerrar sesión: conservar vínculo. No desinstalar ni cerrar sesión de una cuenta sin teléfono si se desea conservar el acceso local; la recuperación aún necesita resolverse/verificarse.
- PIN no incluido en RC2; no afirmar que está implementado ni que el SMS del propietario ya funciona.
