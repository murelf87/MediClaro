# MediClaro — informe de integración final

## Base auditada

Se recibió un único ZIP físico (`mediclaro_v1.2(2).zip`). Ese ZIP ya contenía frontend, `supabase/`, `backend-patches/`, documentación de tiendas, legales y pruebas. Los cuatro documentos adjuntos externos coincidían byte por byte con sus copias dentro del ZIP antes de modificar el proyecto.

No se reconstruyó el frontend. Frente a la entrega original, el único cambio visual/funcional de pantalla realizado está en `EmergencyPreparedScreen.tsx` para hacer explícitos coordenadas, precisión, hora y lectura en voz alta de la ubicación GPS actual.

## Terminado en código

- Proveedor CIMA endurecido: CN/barcode primero; lectura visual solo si hace falta; candidatos enriquecidos con ficha oficial; prospecto segmentado corregido; decisión por umbral/gap; varios medicamentos nunca se autoidentifican.
- Selector de proveedor por país sin fallback silencioso. ES usa CIMA/AEMPS. US dispone de proveedor separado basado en FDA NDC/openFDA y etiquetado oficial para la futura localización estadounidense.
- Premium comprobado en servidor antes de Gemini en identificación, ficha/resumen y chat farmacológico.
- Emergencia fuera del bloqueo Premium y sin Gemini.
- R-01/R-05/R-06/R-07/R-09/R-10 integrados desde `backend-patches/` al árbol real.
- `iap-verify` real para Apple/Google mediante consulta servidor-servidor a las API de tienda.
- Receptores de App Store Server Notifications y Google RTDN que revalidan el estado contra la tienda antes de modificar Premium.
- Relación compra↔cuenta, idempotencia de eventos y actualización de `profiles`.
- Cuota gratuita de IA = 0 en servidor y 100 identificaciones incluidas por ventana mensual también en suscripciones trimestrales/anuales.
- Limpieza de cuentas anónimas abandonadas (`cleanup-anonymous`).
- GPS de emergencia: dirección actual, coordenadas, precisión, hora y TTS; domicilio guardado separado.
- `PRODUCTION_SETUP.md`, ejemplo de secretos y `COMPROBAR_MEDICLARO.bat`.

## Pendiente de configuración/terceros (no se declara terminado)

- Desplegar migraciones y Edge Functions en el Supabase real.
- Activar/configurar Phone Auth + proveedor SMS y números de prueba.
- Activar Anonymous sign-ins y programar `cleanup-anonymous`.
- Configurar `GEMINI_API_KEY`.
- Crear/configurar productos Apple/Google, clave IAP de Apple, cuenta de servicio Google y endpoints de notificaciones.
- Ejecutar Apple Sandbox y Google License Testing en dispositivos reales.
- Mantener `app_config.plans.storeVerification=false` hasta superar esas pruebas; después activarlo.
- Publicar/revisar textos legales, D-U-N-S/cuentas de organización y evaluación regulatoria ya descritos en `COMERCIALIZACION.md`.
- R-25 (fusión de cuenta cuando el teléfono ya existe) sigue siendo P1 y requiere una política de producto/datos antes de automatizarla.
- R-22 solo es necesario si se activa pago externo con tarjeta dentro de las builds de tienda; `production` sigue en `store`.

## Validación ejecutada en este entorno

- Comparación completa contra el ZIP original: frontend preservado salvo la mejora GPS indicada.
- Resolución de imports relativos: **0 imports rotos**.
- Parseo TypeScript/TSX mediante TypeScript sobre `src/` + `supabase/functions/`: **206 archivos, 0 errores sintácticos**.
- `node scripts/release-check.mjs`: **0 fallos**, con pendientes esperados de configuración externa.
- Escaneo de claves obvias: no se añadieron claves privadas/API reales.

No fue posible ejecutar aquí el typecheck/test completo de npm porque el ZIP no trae `node_modules` raíz y el entorno no pudo completar `npm ci` por falta de acceso de red. Por ese motivo no se reutilizan como si fueran nuevos los resultados 212/212 y 203/203 de la auditoría v1.2. `COMPROBAR_MEDICLARO.bat` reinstala dependencias y ejecuta `typecheck`, tests y `expo config --type introspect` en el PC del titular.
