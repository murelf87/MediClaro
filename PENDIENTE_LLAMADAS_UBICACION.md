# Llamadas, ubicación en directo y avisos (2026-10-14) — ESTADO

## Desplegado en producción (Supabase)
- Migración `call_only_from_premium`: solo la persona Premium (paciente) puede llamar; la cuidadora solo recibe (CAREGIVER_CANNOT_CALL). APLICADA.
- Migración `care_live_location`: tabla + función `care_live_location_action` + limpieza cada 30 min. Al empezar/parar deja mensaje en el chat y su aviso push. APLICADA (por el usuario desde el editor SQL).
- Migración `medication_notice_pushes`: disparadores que avisan de toma confirmada/omitida y de cambios de tratamiento, entre paciente y cuidador, sin nombre de medicamento en pantalla bloqueada. APLICADA (por el usuario desde el editor SQL).
- Función `caregiver-dispatch` v18 DESPLEGADA: ahora reparte TODOS los avisos (antes la v17 solo repartía emergencias y vinculaciones; por eso no llegaban chat, llamadas ni pastillas).
- Función `catalog-sync` v1 DESPLEGADA + cron `mediclaro-catalog-sync` cada 10 min (secreto en Vault `mediclaro_catalog_cron`).

## App (OTA, commit 168dd0d, sin gastar builds)
- Publicado en canal **production** (iPhone TestFlight/tienda, runtime 1.0.1) y en canal **expo-go**. Ambos OK.
- Incluye: interruptor ON/OFF de avisos (ON por defecto) y registro del móvil al entrar; ubicación en directo en el chat (15 min/1 h/8 h); botón de llamar oculto a la cuidadora; aviso de llamada time-sensitive.
- Para verlo en el iPhone: cerrar la app del todo y abrirla dos veces (descarga y luego aplica).

## PENDIENTE
- **CRON_SECRET**: el usuario debe ponerlo en el panel de Supabase (Edge Functions → Secrets) para que `catalog-sync` arranque. Valor acordado en la sesión. Hasta entonces la sincronización responde "not configured".
- **Fallback CIMA**: falta volver a desplegar `identify-medicine` y `medicine-detail` desde el repo (`supabase functions deploy`) para que USEN la copia local cuando CIMA se caiga. No se hizo a mano por riesgo (muchos archivos; función crítica). CIMA ya funciona, así que no corre prisa.
- **Pruebas en móviles reales**: registro de dispositivo, llegada de avisos (chat, pastillas, llamada), ubicación en directo, y aviso con el móvil bloqueado (es notificación urgente; una llamada a pantalla completa real necesitaría CallKit/ConnectionService nativo + build nueva).
- **Sin backups en Supabase** (plan nano).
