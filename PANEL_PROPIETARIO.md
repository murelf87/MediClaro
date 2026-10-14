# Panel del propietario de MediClaro (09/10/2026)

Panel privado para gestionar la plataforma desde la propia app: personas, Premium de regalo (bonos), suscripciones,
estadísticas, registro, aviso para todos los usuarios, copias y estado del sistema. Desde el 09/10 por la tarde sigue
**pantalla a pantalla el diseño de 12 pantallas** que envió el propietario (títulos, textos, tarjetas, iconos azules,
pestañas, pastillas de estado y barra inferior), con el logo de MediClaro. Las diferencias a propósito están en el
apartado 9.

> Todo lo de la app está hecho y probado aquí. El servidor está preparado y probado, **pero lo aplica el
> propietario** (apartado 6). No usa claves secretas.

---

## 1. Quién lo ve y cómo se entra

- Solo las cuentas cuyo **teléfono verificado** está en la lista de propietarios del servidor
  (`mediclaro_private.owner_phones`, ya existente desde el 02/10). A los demás no les aparece nada.
- Entrada: **Perfil › Panel de propietario** → acceso privado con **código de 6 cifras** (la primera vez se crea) o
  **Face ID** (o huella en Android) si se activó en ese teléfono.
- No hay botón de administrador en la entrada de la app: así lo pidió el propietario («la entrada con nuestro
  diseño») y así no lo ven las personas mayores ni la revisión de Apple como función oculta para ellas.

## 2. Pantallas (rutas)

| Ruta | Pantalla (diseño) | Qué hace |
|---|---|---|
| `/owner` | 1 · Acceso privado | Logo grande y tarjeta «Acceso exclusivo» con candado: código de 6 cifras (la primera vez se crea dos veces), «Usar Face ID», «Acceder» y «¿Olvidaste tu código?» |
| `/owner/dashboard` | 2 · Dashboard | «Dashboard · Panel de administración», campana con avisos (pagos pendientes, avisos de ayuda, errores), foto o iniciales (→ Mi cuenta), seis fichas y «Cuenta de propietario · Premium vitalicio» |
| `/owner/vouchers` | 3 · Bonos Premium gratuitos | «Crear nuevo bono» y «Mis bonos» (tipo, duración, «Activo» y «Usos: 2/5»); enlace a «Conceder Premium» |
| `/owner/voucher-new` | 4 · Crear bono gratuito | Tipo (Premium completo / Premium familiar), duración (7 días, 30 días, 90 días, 1 año, vitalicio) y cantidad de bonos; el nombre se pone solo |
| `/owner/voucher?id=` | Bono | Usos, a quién se ha dado, «Dar este bono», desactivar / activar |
| `/owner/grant` | 5 · Conceder Premium a usuario | Buscar por nombre o teléfono (o escribir un teléfono sin cuenta) y elegir días o un bono |
| `/owner/users` | 6 · Usuarios | Todos / Pacientes / Cuidadores, «Buscar usuario…», plan de cada persona |
| `/owner/user?id=` | Ficha de usuario | Plan y cobro, Premium de regalo, vínculos y uso de 30 días (solo totales); conceder y retirar |
| `/owner/subscriptions` | 7 · Suscripciones | Activas / Historial: escudo verde, plan en verde, estado, recuadro «Vigencia», «Ver detalles» |
| `/owner/settings` | 8 · Configuración | Datos del propietario, Seguridad, Notificaciones, Respaldos, Mantenimiento |
| `/owner/stats` | 9 · Estadísticas | 7 días / 30 días / 3 meses / 1 año, cuatro cifras y «Uso de funciones» (barras apiladas con la leyenda al lado) |
| `/owner/audit` | 10 · Registro y auditoría | Actividad / Eventos; al tocar una fila se ven todos sus datos (quién, sobre quién, bono, duración, hasta…) |
| `/owner/account` | 11 · Mi cuenta | «Propietario», foto, nombre, teléfono, «Premium vitalicio», código, seguridad y «Cerrar sesión» |
| `/owner/info` | 12 · Información | «Acceso privado del propietario», tres ✓ y «Volver al dashboard» (sin barra inferior) |
| `/owner/security` | Seguridad | Cambiar el código, Face ID en este teléfono, teléfonos con Face ID, últimos accesos y «Cerrar el panel ahora» |
| `/owner/notice` | Notificaciones | Aviso para todas las personas en Inicio (tipo, fecha de fin, vista previa) |
| `/owner/backup` | Respaldos | CSV de usuarios, suscripciones, bonos y registro |
| `/owner/system` | Mantenimiento · Estado del sistema | Servidor, errores y coste de IA (24 h), funciones instaladas, avisos al móvil, tareas programadas |

Todas llevan la barra inferior de la app (como en el diseño), menos el acceso y la información.
`/owner-dashboard` (ruta antigua) lleva ahora al acceso privado. El aviso que se escribe en `/owner/notice` sale
arriba en **Inicio** para todas las personas, que pueden cerrarlo con «Entendido».

## 3. Seguridad

- **Una sola puerta en el servidor:** `public.owner_admin(acción, datos)` comprueba en cada petición la sesión de
  Supabase, que el teléfono sea de propietario y, salvo para abrir el panel, una **sesión del panel** válida.
- **Código:** se guarda cifrado con bcrypt (`pgcrypto`), nunca en el teléfono. Rechaza códigos fáciles (123456,
  111111…). **5 fallos → bloqueo de 15 minutos** (el fallo se guarda aunque la petición falle).
- **Sesión del panel:** solo en memoria de la app; caduca tras **15 minutos sin uso** y a las **8 horas**; la app la
  cierra además al volver tras **2 minutos** en segundo plano. Se guarda solo su huella SHA-256 en el servidor.
- **Face ID:** al activarlo, el servidor da un permiso de dispositivo (90 días, como mucho 5 teléfonos) que el
  teléfono guarda en el llavero **protegido por Face ID / huella** (`expo-secure-store`, `requireAuthentication`,
  «solo este dispositivo con código»). **Cambiar el código retira todos los Face ID y cierra las demás sesiones.**
- **Privacidad:** el panel no muestra medicamentos, conversaciones, ubicaciones ni avisos de salud de nadie; los
  teléfonos salen ocultos (+34 ••• ••• 678); abrir una ficha queda en el registro. Las copias (CSV) salen con los
  teléfonos ocultos.
- **Registro:** crear código, entrar, bloqueos, cambios de código y de Face ID, bonos, Premium concedido o retirado,
  fichas consultadas, aviso y copias van a `public.audit_log`.
- Límite de 240 peticiones por minuto y 10 intentos de abrir el panel por minuto.
- Las funciones antiguas del panel (`owner_dashboard`, `owner_set_premium_grant`, `owner_premium_grants`) no se han
  tocado para no romper versiones anteriores; la app nueva ya no las usa. Para cerrarlas (recomendado tras publicar
  la versión nueva), ver el apartado 6.

## 4. Bonos y Apple

Apple no permite desbloquear funciones de pago con códigos propios dentro de la app (norma **3.1.1**). Por eso un
bono **no es un código que la gente escriba**: es un regalo de Premium que **el propietario aplica desde el panel** a
la cuenta o al teléfono de cada persona (por ejemplo, «Bono familiar · 3 meses · 3 personas»). «Usos 2/5» cuenta a
cuántas personas se ha dado. La persona no hace nada: al entrar con su teléfono ya tiene Premium.

- Usa el Premium de cortesía que ya existía (`mediclaro_private.premium_grants`), así que `is_premium()` no cambia.
- Si la persona ya tenía Premium de regalo, se queda la **fecha más lejana**; «Retirar» lo quita (una suscripción
  pagada sigue igual).
- **Premium completo / Premium familiar** (como en el diseño): MediClaro tiene **un solo Premium**; «familiar» es ese
  mismo Premium para varias personas de una familia (un bono por persona, al menos 2). El tipo queda en el nombre,
  que se pone solo: «Bono 30 días», «Bono familiar 90 días», «Bono vitalicio».
- Si se quieren códigos que la gente canjee en el iPhone, se crean como **códigos de oferta de Apple** en App Store
  Connect (los canjea la propia App Store), no en la app.

## 5. Foto de homenaje de la entrada

- **Puesta:** Isabel y José (`assets/images/homenaje/isabel-y-jose.jpg`, 1600 × 1073 px, 165 KB). En la entrada
  (`/welcome`) va **arriba el logo de MediClaro con su frase y debajo la foto entera**, con esquinas redondeadas, un
  borde blanco fino y una sombra suave (`src/components/TributePhoto.tsx`). El lector de pantalla dice: «Isabel y
  José, abrazados y sonriendo: ella con un rosario en la mano y él con su caña de pescar».
- Para cambiarla o añadir más, se sigue `src/content/homenaje.ts` (con varias, cambian solas cada 6 segundos con un
  fundido; con «Reducir movimiento» se queda la primera). Frase opcional encima.

## 6. Lo que tiene que hacer el propietario

1. **Migraciones** (`npx supabase db push`), en este orden si aún no están:
   `20261009150000_care_chat_and_calls.sql`, `20261009170000_owner_admin_panel.sql`,
   `20261009190000_care_chat_window.sql` y `20261009191000_owner_phones_antonio_marina.sql`.
2. **Propietarios: solo Antonio (+34 680 127 015) y Marina (+34 646 350 527).** La migración
   `20261009191000_owner_phones_antonio_marina.sql` deja habilitados exactamente esos dos teléfonos (guardados como
   huella SHA-256, nunca en claro) y desactiva cualquier otro. Son los mismos dos que se dieron de alta el 02/10.
   Para cambiarlos en el futuro, en el editor SQL de Supabase (cifras con prefijo, sin «+»):
   ```sql
   insert into mediclaro_private.owner_phones (phone_hash)
   values (encode(extensions.digest('34600123456', 'sha256'), 'hex'));
   ```
3. **Nueva build** (EAS) — trae el texto de Face ID (`NSFaceIDUsageDescription`), el permiso de biometría de
   Android, las pantallas nuevas y el aviso en Inicio. En el modo demostración del panel, el propietario es Antonio
   y la copropietaria Marina (`src/mocks/demoOwner.ts`), igual que en producción.
4. Abrir **Perfil › Panel de propietario** y crear el código.
5. **Restablecer el código del panel** (si se olvida), en el editor SQL de Supabase:
   ```sql
   with o as (select id from auth.users where phone = '34600123456')
   delete from mediclaro_private.owner_pins where user_id in (select id from o);
   update mediclaro_private.owner_devices set revoked_at = now()
    where user_id in (select id from auth.users where phone = '34600123456') and revoked_at is null;
   update mediclaro_private.owner_sessions set revoked_at = now()
    where user_id in (select id from auth.users where phone = '34600123456') and revoked_at is null;
   ```
   Al volver al panel se pide crear un código nuevo.
6. **Opcional (recomendado cuando todos usen la versión nueva):** cerrar las funciones antiguas del panel:
   ```sql
   revoke execute on function public.owner_dashboard(integer, integer),
     public.owner_set_premium_grant(text, boolean, integer), public.owner_premium_grants(integer) from authenticated;
   ```
7. **Notas para la revisión de Apple** (App Store Connect › App Review Information › Notes), por ejemplo:

   > The app includes a private owner-only admin area (Profile › “Panel de propietario”). It is shown only to the
   > app owner’s verified phone numbers and is protected by a 6-digit code and Face ID; it is not needed to review
   > any user feature. It lets the owner give complimentary Premium to specific people: nobody enters codes in the
   > app and no purchases happen there. All Premium purchases in the app use In-App Purchase.

## 7. Verificación (09/10/2026)

- Servidor (PGlite, sin red ni claves): `backend-patches/tests/sql/owner_admin.test.mjs` →
  `MIGRACION_PANEL_PROPIETARIO=OK` (quién entra, código y bloqueo, Face ID, caducidad 15 min / 8 h, usuarios y
  búsqueda, bonos y usos, conceder y retirar, suscripciones, estadísticas, registro, aviso, sistema, copias sin
  teléfonos completos, cambio de código, limpieza; la migración se puede aplicar dos veces).
- App: TypeScript 0 errores; Jest (servicio del panel, aviso de Inicio y textos del panel) dentro de las 45 suites /
  484 pruebas OK.
- Vista previa (escenario «Propietario», datos inventados): crear código (con aviso de código fácil), panel, crear
  bono, dar el bono, Premium concedido, todas las pantallas, aviso visible en Inicio, cerrar y volver a entrar con
  código incorrecto y correcto; iPhone 15 y 320 px sin errores de página.

## 8. Límites

- Face ID solo funciona en la app instalada (no en Expo Go ni en la web, donde se entra con el código).
- Las estadísticas son totales; las llamadas al 112 se hacen desde el teléfono y no se cuentan.
- Desde la app no se restaura nada (para no borrar datos por error): la copia completa y su restauración se hacen
  en Supabase (Database › Backups).
- Sin probar aquí con el servidor real y un iPhone: Face ID real, rendimiento con muchas cuentas y el editor SQL.

## 9. Diferencias con el diseño (a propósito)

- **Logo de MediClaro** (el del corazón) en lugar del de la imagen.
- **Teléfonos ocultos** (+34 ••• ••• 678) y **iniciales** cuando la persona no tiene foto: por privacidad no se
  enseñan números completos ni fotos de otras personas. En tu cabecera y en «Mi cuenta» sale tu foto de perfil si
  la tienes.
- El código se ve como **●●●●●●**, no como números.
- **La barra inferior es la de la app** (Inicio, Mis meds, Cuidador/a, Asistente, Perfil), no la del dibujo, y las
  pantallas interiores tienen **flecha atrás**.
- «Respaldos» **solo exporta**: restaurar desde el móvil podría borrar datos por error (se hace en Supabase).
- En las estadísticas, «Otros» son las **identificaciones por foto** (se dice debajo del gráfico).
- Añadidos que el diseño no tenía y que hacen falta: enlace «Conceder Premium a un usuario» en Bonos, aviso de pagos
  pendientes en Suscripciones y «Cerrar el panel ahora» en Seguridad.
