# MediClaro — paquete de código fuente completo
Snapshot preparado el 08/10/2026 y actualizado el 09/10/2026 (versión candidata **RC-2026-10-09**).

Este ZIP contiene el código fuente disponible del proyecto MediClaro, incluyendo frontend Expo/React Native, backend Supabase, Edge Functions, migraciones SQL, assets, configuración, pruebas, scripts y documentación funcional.

## Importante
- No se incluyen `node_modules`, cachés, builds IPA ni carpetas temporales.
- No se incluyen archivos `.env` ni credenciales reales. Sí se incluye `.env.example`.
- El código del snapshot incluye también los cambios más recientes que todavía no estaban confirmados en Git.
- `98_ESTADO_GIT_SNAPSHOT.txt` indica el commit base y los archivos modificados.
- `99_ULTIMOS_CAMBIOS_NO_COMMIT.patch` conserva el diff exacto de esos cambios.

## Documentos incluidos
1. `01_ESPECIFICACION_FUNCIONAL_EXACTA.md` — cómo debe funcionar MediClaro.
2. `02_ESTADO_REAL_Y_PENDIENTES.md` — qué está implementado, qué está validado y qué falta para producción.
3. `03_PROMPT_MAESTRO_PARA_CONTINUAR.txt` — instrucciones para que otra IA/equipo continúe sin reconstruir el proyecto.
4. La documentación histórica del repositorio original: README, BACKEND_REQUIREMENTS, FRONTEND_AUDIT, SCREEN_MAP, PRODUCTION_SETUP y demás informes.
5. `CAMBIOS_2026-10-09.md` — cambios del 09/10/2026 (versión candidata RC-2026-10-09, también el chat y las llamadas con el cuidador/a, la foto de homenaje y el panel del propietario) y lo que falta desplegar.
6. `MIS_PASTILLAS.md` — documentación funcional y técnica de «Mis pastillas» (datos, seguridad, pruebas, despliegue).
6 bis. `PANEL_PROPIETARIO.md` — panel privado del propietario: pantallas, seguridad, bonos y Apple, despliegue, restablecer el código y notas para la revisión de Apple.
6 ter. **`PASOS_PRODUCCION.md` — lo que falta para publicar, en orden** (servidor, cobros, legal, compilación EAS, pruebas en teléfono y envío a las tiendas).
7. `102_TODOS_LOS_CAMBIOS_DESDE_TU_ZIP_2026-10-09.patch` — todos los cambios desde el ZIP del 08/10 (texto), incluidas las correcciones de las 19:05 (`CAMBIOS_2026-10-09.md` §20–21).

## Arranque de desarrollo
1. Instalar Node compatible con Expo SDK 57.
2. Ejecutar `npm ci`.
3. Copiar `.env.example` a un archivo de entorno local y completar únicamente credenciales propias.
4. Ejecutar `npx expo install --check`.
5. Ejecutar `npm run typecheck`.
6. Ejecutar `npm test -- --runInBand`.
7. Para backend: enlazar el proyecto Supabase correcto, aplicar migraciones y desplegar Edge Functions.
8. Para iPhone: generar una build interna EAS. No usar Expo Go para funciones nativas que requieran configuración propia.
9. Para verla en el móvil con **Expo Go**: en Windows, doble clic en `VER_EN_IPHONE_EXPO_GO.bat` (o `npx expo start --go --tunnel`). iPhone: apuntar al QR con la Cámara → «Abrir en Expo Go». Android: abrir Expo Go → «Scan QR code». En Expo Go la alarma de «Mis pastillas» suena con el tono normal del teléfono y no hay compras ni push al cuidador/a (ver `MIS_PASTILLAS.md` §4 y §15).

No publicar en Apple ni activar cobros reales hasta completar los bloqueos descritos en `02_ESTADO_REAL_Y_PENDIENTES.md`.
