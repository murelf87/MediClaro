# Arreglos del backend propuestos — **NO APLICADOS**

El frontend de MediClaro se ha hecho **sin tocar el backend** (`supabase/` está intacto). Esta carpeta contiene
**propuestas** para quien mantiene el backend: corrigen los fallos de `BACKEND_REQUIREMENTS.md` que se pueden
arreglar con código. **Nada de esto se ha aplicado** a ningún proyecto de Supabase ni desplegado.

Todas se han **probado**: sobre el esquema actual primero se **reproduce el fallo** y después se comprueba que el
parche lo corrige sin abrir permisos (resultados abajo).

## Qué contiene

| Archivo | Requisito | Qué corrige | ¿La app lo aprovecha sola? |
|---|---|---|---|
| `migrations/20260928090000_r01_sub_state_sync.sql` | **R-01 (P0)** | Quien paga Premium recibía los límites gratuitos: `sub_state` nunca se escribía. Ahora se deriva siempre de `plan` + `subscription_status` (trigger) y se corrigen las cuentas existentes. | **Sí.** Aparece el uso Premium («N de 100 incluidas») sin cambiar la app. |
| `migrations/20260928090100_r05_emergency_profile_columns.sql` | R-05 | Faltan `phone`, `additional_info` y `created_at` en `emergency_profiles`, y sitio para el servicio privado de asistencia y el médico de cada persona. | No: hace falta un cambio pequeño en la app (ver «Después de aplicar»). |
| `migrations/20260928090200_r07_scans_history_clear.sql` | R-07 | Borrando filas de `scans` por la API se reiniciaba la cuota (coste de IA ilimitado). Se quita el borrado directo y se añade `clear_scan_history()`: oculta, **borra qué medicamento era** y mantiene la cuota. | La app no ofrece aún «Borrar historial»; se puede añadir (ver abajo). |
| `migrations/20260928090300_r09_r10_account_status.sql` | R-09, R-10 | `get_account_status()` añade `chats_today`, `chat_per_day`, `chats_left_today` y `cancel_at_period_end`. El día del asistente empieza a las 00:00 de España y los mensajes derivados a emergencia no gastan preguntas (igual en el límite `can_chat`). | Compatible con la app publicada (mantiene todos los campos). |
| `functions/stripe-webhook/index.ts` + `mapping.ts` (`stripe-webhook.diff`) | **R-01**, R-10 | Escribe `sub_state` y `cancel_at_period_end`. Corrige además dos pérdidas de eventos: un error al registrar el evento se respondía 200 (Stripe no reintentaba) y un fallo al guardar el cliente de Stripe se ignoraba. | **Sí.** «Premium sigue activo hasta el … No se renovará.» aparece solo. |
| `functions/account/index.ts` (`account.diff`) | R-06 | «Descargar mis datos» no incluía el perfil de emergencia (datos de salud). Añade perfil de emergencia, cuidadores, teléfono de acceso, actividad y registro de seguridad; si una consulta falla responde error en vez de un archivo incompleto. | **Sí.** La app ya usa el perfil de emergencia del servidor cuando viene. |

R-01 queda corregido por **dos vías independientes** (la migración y el webhook). Se recomiendan ambas: la migración
cubre cualquier otro proceso que escriba el estado (p. ej., una futura compra de Apple/Google).

## Resultados de las pruebas (28-09-2026)

- **Migraciones — 39/39 correctas** (`tests/migrations.test.mjs`, PostgreSQL 18 en memoria con PGlite; roles
  `anon`/`authenticated`/`service_role`, `auth.uid()` y permisos por defecto como en Supabase):
  - Esquema actual: se **reproducen** R-01 (Premium con límites gratuitos), R-07 (borrar filas reinicia la cuota),
    R-05 (`phone` → error 42703) y R-09.
  - Con los parches: los 8 estados de Stripe → `sub_state` correcto; límites Premium (100 incluidas, 200
    preguntas/día); uso adicional desde la 101; corrección de cuentas existentes; la persona **no puede darse
    Premium** a sí misma; `update_my_settings` sigue funcionando; historial borrado sin reiniciar la cuota y sin
    guardar el nombre del medicamento; nadie borra ni ve lo de otra persona; sin sesión no se accede a nada; la app
    no puede llamar a las funciones internas (`consume_scan`, `can_chat`, …); los parches se pueden aplicar dos veces.
  - También se comprueba el registro del permiso de IA que hace la app (`consents`, `kind = 'ai_processing'`).
- **Edge Functions — tipos correctos** (`deno check` con los módulos reales de Supabase y Stripe) **y 21/21 pruebas
  de comportamiento** (`tests/functions`, Deno 2.9, Stripe y base de datos simulados en memoria), comparando la
  función **original** con la **propuesta** en cada caso.
- Comprobación adicional del código actual: `deno check` de las 8 funciones originales → todas correctas **salvo
  `emergency-assess`** (`TS2551: Property 'catch' does not exist on type 'PostgrestFilterBuilder…'`, línea 85). La
  app no la usa: **no la despliegue** (R-15).

### Cómo repetir las pruebas

```bash
cd backend-patches/tests
npm install            # instala PGlite (PostgreSQL en WebAssembly); no se conecta a ningún servidor
npm test               # migraciones
bash run-function-tests.sh   # funciones (requiere Deno 2; DENO=/ruta/deno si no está en el PATH)
```

## Cómo aplicarlas (después de revisarlas)

1. **Primero en un proyecto de pruebas (staging)**, nunca directamente en producción.
2. Migraciones: copiar los 4 `.sql` a `supabase/migrations/` y ejecutar `supabase db push` (o pegarlos en el editor
   SQL en ese orden). Son idempotentes. Hacer copia de seguridad antes.
3. Funciones: sustituir `supabase/functions/stripe-webhook/index.ts` y `supabase/functions/account/index.ts` por los
   de esta carpeta, copiar también `stripe-webhook/mapping.ts`, y desplegar:
   ```bash
   supabase functions deploy stripe-webhook --no-verify-jwt
   supabase functions deploy account
   ```
4. Probar en staging una compra con una tarjeta de prueba de Stripe, una cancelación desde el portal y «Descargar
   mis datos».

## Después de aplicar: cambios pequeños en la app (no hechos, para no depender de algo que aún no existe)

- **R-05:** `EmergencyProfileService` puede enviar ya `phone` y `additional_info`, y guardar el servicio privado de
  asistencia y el médico en las columnas nuevas (hoy viven solo en el teléfono, cifrados). Al activarlo, subir una
  vez lo que haya en el teléfono. El 112 sigue siendo siempre una opción aparte que nunca se llama sola.
- **R-07:** se puede añadir «Borrar mi historial» en Historial y en Privacidad llamando a
  `supabase.rpc('clear_scan_history')` (todo) o `rpc('clear_scan_history', { p_ids: [id] })` (una fila).
  El asistente deja de usar como contexto lo borrado (ya no tiene el nº de registro).
- **R-09:** se puede mostrar «Te quedan N preguntas hoy» con `chats_left_today`.

## Qué no se incluye y por qué

- **R-02** (acceso por SMS) y **R-03** (desplegar funciones): son configuración del panel y despliegue, no código.
- **R-04** (cobro dentro de iOS/Android): depende de una decisión del propietario (ver `COMERCIALIZACION.md`). La app
  de tienda sale sin compras dentro (`EXPO_PUBLIC_PAYMENTS_MODE=none`) hasta que se decida.
- **R-11** notificaciones, **R-12** plan anual, **R-13** búsqueda por nombre, **R-14** cuidadores: funciones nuevas
  que requieren decisiones de producto o de proveedores.
- **R-15:** recomendación de **no desplegar** `emergency-assess` (error de tipos arriba; la app no la usa).
- **R-17:** `saved_medicines` (duplicada) — eliminarla solo tras comprobar que está vacía.

## Observaciones de seguridad y privacidad encontradas al probar

- **Cuidadores (`caregiver_links`):** la política «titular gestiona» permite a la persona titular poner
  `status = 'active'` y cualquier `caregiver_id` sin que la otra persona acepte. Hoy no da acceso a ningún dato, pero
  **debe corregirse antes de construir R-14** (el paso a `active` solo lo debe hacer la persona invitada, desde el
  servidor).
- **`usage_events`:** guarda `user_id` junto a `detail = 'emergency'` cuando un mensaje del asistente se deriva a
  emergencia. Es información relacionada con la salud: mencionarlo en la política de privacidad y fijar un plazo de
  conservación (o no guardar `user_id` en esos eventos).
- La exportación propuesta incluye `usage_events` y `audit_log` de la propia persona (derecho de acceso, art. 15 RGPD).
