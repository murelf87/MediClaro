-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- MediClaro · Panel del propietario completo (09/10/2026). LA APLICA EL PROPIETARIO:
--   npx supabase db push        (después de 20261009150000_care_chat_and_calls.sql)
--
-- Qué añade (todo aditivo; no cambia tablas, funciones ni permisos existentes):
--  1) Acceso privado con código de 6 cifras: el código se guarda cifrado (bcrypt), se comprueba en el servidor y se
--     bloquea 15 minutos tras 5 fallos. Al acertar se abre una sesión del panel de 15 minutos sin actividad (8 h como
--     máximo). Face ID: el teléfono guarda (protegido por Face ID / huella) un permiso de dispositivo de 90 días que
--     abre otra sesión. Al cambiar el código se cierran todos los dispositivos y sesiones.
--  2) Bonos Premium gratuitos que el propietario aplica desde el panel a una persona (por su cuenta o su teléfono).
--     NO son códigos que la gente escriba en la app (Apple 3.1.1). Usan el Premium de cortesía ya existente
--     (mediclaro_private.premium_grants), así que is_premium() no cambia.
--  3) Datos del panel: usuarios, ficha, suscripciones, estadísticas, registro y auditoría, estado del sistema,
--     copias (exportar) y un aviso general para todos los usuarios (public.app_notice()).
--
-- Seguridad:
--  · Una sola entrada: public.owner_admin(acción, datos). Comprueba la sesión de Supabase, que el teléfono
--    verificado sea de propietario (mediclaro_private.is_owner, ya existente) y, salvo para abrir el panel, una sesión
--    del panel válida. Límite de 240 peticiones/minuto y 10 intentos de código/minuto.
--  · Las tablas nuevas están en mediclaro_private, sin acceso desde la API.
--  · El panel no muestra datos de salud (ni medicamentos, ni avisos con nombre): solo cuentas, planes y totales.
--    Los teléfonos salen enmascarados (+34 ••• ••• 678). Cada concesión, retirada, bono, cambio y exportación queda
--    en public.audit_log.
--  · Las funciones antiguas del panel (owner_dashboard, owner_set_premium_grant, owner_premium_grants) siguen igual
--    para no romper versiones anteriores; la app nueva ya no las usa (ver 02_ESTADO para retirarlas si se quiere).
-- Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────

create schema if not exists mediclaro_private;
revoke all on schema mediclaro_private from public, anon, authenticated;
create extension if not exists pgcrypto with schema extensions;

-- ── Tablas privadas ──────────────────────────────────────────────────────────────────────────────────────
create table if not exists mediclaro_private.owner_pins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  failed_count integer not null default 0 check (failed_count >= 0),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mediclaro_private.owner_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  label text not null check (length(label) between 1 and 60),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists owner_devices_user_idx on mediclaro_private.owner_devices (user_id, created_at desc);

create table if not exists mediclaro_private.owner_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  via text not null check (via in ('pin', 'device', 'setup')),
  device_id uuid references mediclaro_private.owner_devices(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists owner_sessions_user_idx on mediclaro_private.owner_sessions (user_id, created_at desc);

create table if not exists mediclaro_private.owner_bonos (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 60),
  days integer check (days is null or days between 1 and 3650),
  max_uses integer not null check (max_uses between 1 and 1000),
  uses integer not null default 0 check (uses >= 0),
  note text check (note is null or length(note) <= 200),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  disabled_at timestamptz,
  check (uses <= max_uses)
);

create table if not exists mediclaro_private.owner_bono_uses (
  id bigint generated always as identity primary key,
  bono_id uuid not null references mediclaro_private.owner_bonos(id) on delete cascade,
  phone text not null check (phone ~ '^[1-9][0-9]{7,14}$'),
  user_id uuid references auth.users(id) on delete set null,
  granted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (bono_id, phone)
);
create index if not exists owner_bono_uses_created_idx on mediclaro_private.owner_bono_uses (created_at desc);

revoke all on mediclaro_private.owner_pins, mediclaro_private.owner_devices, mediclaro_private.owner_sessions,
  mediclaro_private.owner_bonos, mediclaro_private.owner_bono_uses from public, anon, authenticated;

-- ── Utilidades ───────────────────────────────────────────────────────────────────────────────────────────
create or replace function mediclaro_private.owner_hash(p text) returns text
language sql immutable set search_path = pg_catalog as $$
  select encode(extensions.digest(coalesce(p, ''), 'sha256'), 'hex')
$$;

create or replace function mediclaro_private.owner_token() returns text
language sql volatile set search_path = pg_catalog as $$
  select encode(extensions.gen_random_bytes(32), 'hex')
$$;

create or replace function mediclaro_private.owner_uuid(p text) returns uuid
language sql immutable set search_path = pg_catalog as $$
  select case when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p::uuid end
$$;

/** +34 ••• ••• 678 (nunca el número completo). */
create or replace function mediclaro_private.owner_mask_phone(p text) returns text
language plpgsql immutable set search_path = pg_catalog as $$
declare d text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
begin
  if d = '' then return null; end if;
  if length(d) < 6 then return '•••'; end if;
  return '+' || left(d, greatest(length(d) - 9, 1)) || ' ••• ••• ' || right(d, 3);
end $$;

/** Igual que owner_set_premium_grant: 9 cifras = España (34); admite +, 00, espacios y guiones. */
create or replace function mediclaro_private.owner_normalize_phone(p text) returns text
language plpgsql immutable set search_path = pg_catalog as $$
declare n text;
begin
  if p is null or length(p) > 32 or p !~ '^[+0-9 ()-]+$' then return null; end if;
  n := regexp_replace(p, '[^0-9]', '', 'g');
  if n like '00%' then n := substr(n, 3); end if;
  if length(n) = 9 then n := '34' || n; end if;
  if n !~ '^[1-9][0-9]{7,14}$' then return null; end if;
  return n;
end $$;

create or replace function mediclaro_private.owner_weak_pin(p text) returns boolean
language sql immutable set search_path = pg_catalog as $$
  select p is null or p !~ '^[0-9]{6}$' or p ~ '^(.)\1{5}$'
    or p in ('012345', '123456', '234567', '345678', '456789', '987654', '876543', '765432', '654321', '543210',
             '121212', '112233', '123123', '123321', '111222', '101010', '202020', '159753', '147258', '000111')
$$;

create or replace function mediclaro_private.owner_new_session(p_user uuid, p_via text, p_device uuid default null) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog as $$
declare t text := mediclaro_private.owner_token(); exp timestamptz := now() + interval '15 minutes';
begin
  -- Como mucho 10 sesiones abiertas por propietario: se cierran las más antiguas.
  update mediclaro_private.owner_sessions set revoked_at = now()
   where id in (select s.id from mediclaro_private.owner_sessions s
                 where s.user_id = p_user and s.revoked_at is null and s.expires_at > now()
                 order by s.created_at desc offset 9);
  insert into mediclaro_private.owner_sessions (user_id, token_hash, via, device_id, expires_at)
  values (p_user, mediclaro_private.owner_hash(t), p_via, p_device, exp);
  return jsonb_build_object('session', t, 'expiresAt', exp);
end $$;

/** Comprueba la sesión del panel y la alarga (15 min sin actividad, 8 h como máximo). Devuelve su id. */
create or replace function mediclaro_private.owner_touch_session(p_user uuid, p_token text) returns uuid
language plpgsql volatile security definer set search_path = pg_catalog as $$
declare s mediclaro_private.owner_sessions;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'OWNER_LOCKED' using errcode = '42501';
  end if;
  select * into s from mediclaro_private.owner_sessions
   where token_hash = mediclaro_private.owner_hash(p_token) and user_id = p_user
   for update;
  if not found or s.revoked_at is not null or s.expires_at <= now() or s.created_at + interval '8 hours' <= now() then
    raise exception 'OWNER_LOCKED' using errcode = '42501';
  end if;
  update mediclaro_private.owner_sessions
     set last_seen_at = now(), expires_at = least(s.created_at + interval '8 hours', now() + interval '15 minutes')
   where id = s.id;
  return s.id;
end $$;

create or replace function mediclaro_private.owner_new_device(p_user uuid, p_label text) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog as $$
declare t text := mediclaro_private.owner_token(); d uuid; exp timestamptz := now() + interval '90 days';
  v_label text := left(coalesce(nullif(btrim(regexp_replace(coalesce(p_label, ''), '[[:cntrl:]]', '', 'g')), ''), 'Este teléfono'), 60);
begin
  -- Como mucho 5 dispositivos con Face ID: se retiran los más antiguos.
  update mediclaro_private.owner_devices set revoked_at = now()
   where id in (select x.id from mediclaro_private.owner_devices x
                 where x.user_id = p_user and x.revoked_at is null and x.expires_at > now()
                 order by x.created_at desc offset 4);
  insert into mediclaro_private.owner_devices (user_id, token_hash, label, expires_at)
  values (p_user, mediclaro_private.owner_hash(t), v_label, exp) returning id into d;
  return jsonb_build_object('deviceToken', t, 'deviceId', d, 'deviceExpiresAt', exp);
end $$;

create or replace function mediclaro_private.owner_audit(p_user uuid, p_action text, p_meta jsonb default '{}'::jsonb) returns void
language sql volatile security definer set search_path = pg_catalog as $$
  insert into public.audit_log (user_id, action, meta) values (p_user, p_action, coalesce(p_meta, '{}'::jsonb))
$$;

/** Resumen de una cuenta para el panel (sin datos de salud; teléfono enmascarado). */
create or replace function mediclaro_private.owner_user_json(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog as $$
declare p public.profiles; v_phone text; v_verified boolean; v_anon boolean; v_signin timestamptz;
  g mediclaro_private.premium_grants; v_courtesy boolean := false; v_owner boolean; v_plan text;
  v_caregiver integer; v_patient integer;
begin
  select * into p from public.profiles where id = p_user;
  if not found then return null; end if;
  select regexp_replace(coalesce(au.phone, ''), '[^0-9]', '', 'g'), au.phone_confirmed_at is not null,
         coalesce(au.is_anonymous, false), au.last_sign_in_at
    into v_phone, v_verified, v_anon, v_signin
    from auth.users au where au.id = p_user;
  v_verified := coalesce(v_verified, false) and not coalesce(v_anon, false) and coalesce(v_phone, '') <> '';
  if v_verified then
    select * into g from mediclaro_private.premium_grants where phone = v_phone;
    v_courtesy := found and g.revoked_at is null and (g.expires_at is null or g.expires_at > now());
  end if;
  v_owner := mediclaro_private.is_owner(p_user);
  v_plan := case when v_owner then 'owner'
                 when p.sub_state in ('TRIAL', 'ACTIVE', 'PAST_DUE') then 'paid'
                 when v_courtesy then 'courtesy'
                 else 'free' end;
  select count(*) into v_caregiver from public.care_links l
   where l.caregiver_id = p_user and l.accepted_at is not null and l.revoked_at is null;
  select count(*) into v_patient from public.care_links l
   where l.patient_id = p_user and l.accepted_at is not null and l.revoked_at is null;
  return jsonb_build_object(
    'id', p.id,
    'name', nullif(btrim(coalesce(p.display_name, '')), ''),
    'phone', case when v_verified then mediclaro_private.owner_mask_phone(v_phone) end,
    'verified', v_verified,
    'anonymous', coalesce(v_anon, false),
    'plan', v_plan,
    'provider', case when p.subscription_id like 'bizum-%' then 'bizum' else p.billing_provider end,
    'subState', p.sub_state,
    'periodEnd', p.current_period_end,
    'cancelAtPeriodEnd', coalesce(p.cancel_at_period_end, false),
    'paidByFamily', coalesce(p.paid_by_family, false),
    'courtesy', v_courtesy,
    'courtesyUntil', case when v_courtesy then g.expires_at end,
    'caregiver', v_caregiver > 0,
    'caregiverLinks', v_caregiver,
    'patientLinks', v_patient,
    'createdAt', p.created_at,
    'lastSignInAt', v_signin
  );
end $$;

-- ── Acceso: estado, crear código, abrir con código y con Face ID ─────────────────────────────────────────
create or replace function mediclaro_private.owner_access_status(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog as $$
declare pin mediclaro_private.owner_pins; v_name text; v_phone text; v_devices integer;
begin
  select * into pin from mediclaro_private.owner_pins where user_id = p_user;
  select nullif(btrim(coalesce(display_name, '')), '') into v_name from public.profiles where id = p_user;
  select mediclaro_private.owner_mask_phone(phone) into v_phone from auth.users where id = p_user;
  select count(*) into v_devices from mediclaro_private.owner_devices
   where user_id = p_user and revoked_at is null and expires_at > now();
  return jsonb_build_object(
    'hasPin', pin.user_id is not null,
    'lockedUntil', case when pin.locked_until > now() then pin.locked_until end,
    'attemptsLeft', greatest(0, 5 - coalesce(pin.failed_count, 0)),
    'devices', v_devices,
    'name', v_name,
    'phone', v_phone
  );
end $$;

/** Comprueba el código (con bloqueo). Devuelve null si es correcto o el error en JSON (sin lanzar: el fallo se guarda). */
create or replace function mediclaro_private.owner_check_pin(p_user uuid, p_pin text) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog as $$
declare pin mediclaro_private.owner_pins; left_attempts integer;
begin
  select * into pin from mediclaro_private.owner_pins where user_id = p_user for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'PIN_NOT_SET'); end if;
  if pin.locked_until is not null and pin.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'LOCKED', 'lockedUntil', pin.locked_until);
  end if;
  if p_pin is not null and p_pin ~ '^[0-9]{6}$' and extensions.crypt(p_pin, pin.pin_hash) = pin.pin_hash then
    update mediclaro_private.owner_pins set failed_count = 0, locked_until = null where user_id = p_user;
    return null;
  end if;
  if pin.failed_count + 1 >= 5 then
    update mediclaro_private.owner_pins set failed_count = 0, locked_until = now() + interval '15 minutes' where user_id = p_user;
    perform mediclaro_private.owner_audit(p_user, 'owner_locked', jsonb_build_object('minutes', 15));
    return jsonb_build_object('ok', false, 'error', 'LOCKED', 'lockedUntil', now() + interval '15 minutes');
  end if;
  update mediclaro_private.owner_pins set failed_count = failed_count + 1 where user_id = p_user
  returning 5 - failed_count into left_attempts;
  return jsonb_build_object('ok', false, 'error', 'PIN_INCORRECT', 'attemptsLeft', left_attempts);
end $$;

-- ── Usuarios ─────────────────────────────────────────────────────────────────────────────────────────────
create or replace function mediclaro_private.owner_users(pl jsonb) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog as $$
declare tab text := coalesce(pl->>'tab', 'all'); q text := btrim(coalesce(pl->>'q', ''));
  page integer := 0; digits text; pattern text; v_total integer; v_rows jsonb;
begin
  if tab not in ('all', 'patients', 'caregivers') or length(q) > 60 then
    raise exception 'INVALID_REQUEST' using errcode = '22023';
  end if;
  if coalesce(pl->>'page', '0') ~ '^[0-9]{1,4}$' then page := (coalesce(pl->>'page', '0'))::integer; end if;
  digits := regexp_replace(q, '[^0-9]', '', 'g');
  if length(digits) >= 6 then
    if digits like '00%' then digits := substr(digits, 3); end if;
    pattern := null;
  elsif length(q) >= 2 then
    digits := null;
    pattern := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  else
    digits := null; pattern := null;
  end if;
  with base as (
    select p.id, p.created_at,
      exists (select 1 from public.care_links l where l.caregiver_id = p.id and l.accepted_at is not null and l.revoked_at is null) as is_caregiver
    from public.profiles p left join auth.users au on au.id = p.id
    where (digits is null or regexp_replace(coalesce(au.phone, ''), '[^0-9]', '', 'g') like '%' || digits || '%')
      and (pattern is null or coalesce(p.display_name, '') ilike pattern escape '\')
  ), filtered as (
    select * from base
     where tab = 'all' or (tab = 'caregivers' and is_caregiver) or (tab = 'patients' and not is_caregiver)
  )
  select (select count(*) from filtered),
         coalesce((select jsonb_agg(mediclaro_private.owner_user_json(f.id) order by f.created_at desc, f.id)
                     from (select * from filtered order by created_at desc, id limit 25 offset page * 25) f), '[]'::jsonb)
    into v_total, v_rows;
  return jsonb_build_object('total', v_total, 'page', page, 'pageSize', 25, 'users', v_rows);
end $$;

create or replace function mediclaro_private.owner_user_detail(p_owner uuid, pl jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog as $$
declare target uuid := mediclaro_private.owner_uuid(pl->>'userId'); info jsonb; since timestamptz := now() - interval '30 days';
  store jsonb; bono jsonb; v_phone text;
begin
  if target is null then raise exception 'INVALID_REQUEST' using errcode = '22023'; end if;
  info := mediclaro_private.owner_user_json(target);
  if info is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  select to_jsonb(s) into store from (
    select platform, product_id as "productId", status, expires_at as "expiresAt", auto_renew as "autoRenew"
      from public.store_subscriptions where user_id = target order by last_verified_at desc limit 1) s;
  select regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') into v_phone from auth.users where id = target;
  if coalesce(v_phone, '') <> '' then
    select jsonb_build_object('id', b.id, 'name', b.name, 'grantedAt', u.created_at) into bono
      from mediclaro_private.owner_bono_uses u join mediclaro_private.owner_bonos b on b.id = u.bono_id
     where u.phone = v_phone order by u.created_at desc limit 1;
  end if;
  perform mediclaro_private.owner_audit(p_owner, 'owner_user_viewed', jsonb_build_object('target_user', target));
  return jsonb_build_object(
    'user', info,
    'store', store,
    'lastBono', bono,
    'usage30d', jsonb_build_object(
      'scans', (select count(*) from public.scans where user_id = target and created_at >= since),
      'chats', (select count(*) from public.usage_events where user_id = target and kind = 'chat' and created_at >= since),
      'doses', (select count(*) from public.medication_dose_events
                 where user_id = target and status = 'active' and kind in ('taken', 'extra') and recorded_at >= since)
    ),
    'lastActivityAt', greatest(
      (select max(created_at) from public.usage_events where user_id = target),
      (select max(created_at) from public.scans where user_id = target),
      (select max(recorded_at) from public.medication_dose_events where user_id = target))
  );
end $$;

-- ── Conceder y retirar Premium de cortesía (con o sin bono) ─────────────────────────────────────────────
create or replace function mediclaro_private.owner_grant(p_owner uuid, pl jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog as $$
declare target uuid := mediclaro_private.owner_uuid(pl->>'userId'); v_phone text; v_verified boolean; v_anon boolean;
  v_bono mediclaro_private.owner_bonos; v_bono_id uuid := mediclaro_private.owner_uuid(pl->>'bonoId');
  v_days integer; v_lifetime boolean := false; v_exp timestamptz; g mediclaro_private.premium_grants;
  v_user uuid;
begin
  if target is not null then
    select regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), phone_confirmed_at is not null, coalesce(is_anonymous, false)
      into v_phone, v_verified, v_anon from auth.users where id = target;
    if not found or not exists (select 1 from public.profiles where id = target) then
      raise exception 'NOT_FOUND' using errcode = 'P0002';
    end if;
    if not v_verified or v_anon or coalesce(v_phone, '') !~ '^[1-9][0-9]{7,14}$' then
      raise exception 'USER_NO_PHONE' using errcode = '22023';
    end if;
  elsif pl ? 'phone' then
    v_phone := mediclaro_private.owner_normalize_phone(pl->>'phone');
    if v_phone is null then raise exception 'INVALID_PHONE' using errcode = '22023'; end if;
  else
    raise exception 'INVALID_REQUEST' using errcode = '22023';
  end if;

  if pl ? 'bonoId' and jsonb_typeof(pl->'bonoId') <> 'null' then
    if v_bono_id is null then raise exception 'INVALID_REQUEST' using errcode = '22023'; end if;
    select * into v_bono from mediclaro_private.owner_bonos where id = v_bono_id for update;
    if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    if v_bono.disabled_at is not null then raise exception 'BONO_DISABLED' using errcode = 'P0001'; end if;
    if v_bono.uses >= v_bono.max_uses then raise exception 'BONO_EXHAUSTED' using errcode = 'P0001'; end if;
    if exists (select 1 from mediclaro_private.owner_bono_uses where bono_id = v_bono_id and phone = v_phone) then
      raise exception 'BONO_ALREADY_USED' using errcode = 'P0001';
    end if;
    v_days := v_bono.days;
    v_lifetime := v_bono.days is null;
  elsif pl ? 'days' then
    if jsonb_typeof(pl->'days') = 'null' then
      v_lifetime := true;
    elsif jsonb_typeof(pl->'days') = 'number' and (pl->>'days') ~ '^[0-9]{1,4}$' then
      v_days := (pl->>'days')::integer;
      if v_days not between 1 and 3650 then raise exception 'INVALID_REQUEST' using errcode = '22023'; end if;
    else
      raise exception 'INVALID_REQUEST' using errcode = '22023';
    end if;
  else
    raise exception 'INVALID_REQUEST' using errcode = '22023';
  end if;

  v_exp := case when v_lifetime then null else now() + make_interval(days => v_days) end;
  -- Si ya tenía Premium de cortesía activo, se queda la fecha más lejana (para acortar: «Retirar»).
  select * into g from mediclaro_private.premium_grants where phone = v_phone for update;
  if found and g.revoked_at is null and (g.expires_at is null or g.expires_at > now()) then
    if g.expires_at is null then v_exp := null;
    elsif v_exp is not null and g.expires_at > v_exp then v_exp := g.expires_at;
    end if;
  end if;
  insert into mediclaro_private.premium_grants (phone, granted_by, expires_at)
  values (v_phone, p_owner, v_exp)
  on conflict (phone) do update set granted_by = excluded.granted_by, granted_at = now(), expires_at = excluded.expires_at, revoked_at = null;

  select au.id into v_user from auth.users au
   where regexp_replace(coalesce(au.phone, ''), '[^0-9]', '', 'g') = v_phone and au.phone_confirmed_at is not null
     and not coalesce(au.is_anonymous, false)
   limit 1;
  if v_bono.id is not null then
    insert into mediclaro_private.owner_bono_uses (bono_id, phone, user_id, granted_by, expires_at)
    values (v_bono.id, v_phone, v_user, p_owner, v_exp);
    update mediclaro_private.owner_bonos set uses = uses + 1 where id = v_bono.id returning * into v_bono;
  end if;
  perform mediclaro_private.owner_audit(p_owner, 'courtesy_premium_granted', jsonb_build_object(
    'phone_hash', mediclaro_private.owner_hash(v_phone), 'expires_at', v_exp, 'target_user', v_user,
    'bono_id', v_bono.id, 'bono_name', v_bono.name, 'days', v_days, 'lifetime', v_exp is null, 'via', 'panel'));
  return jsonb_build_object(
    'ok', true,
    'phone', mediclaro_private.owner_mask_phone(v_phone),
    'verified', v_user is not null,
    'expiresAt', v_exp,
    'lifetime', v_exp is null,
    'user', case when v_user is not null then mediclaro_private.owner_user_json(v_user) end,
    'bono', case when v_bono.id is not null then jsonb_build_object('id', v_bono.id, 'name', v_bono.name, 'uses', v_bono.uses, 'maxUses', v_bono.max_uses) end
  );
end $$;

create or replace function mediclaro_private.owner_revoke(p_owner uuid, pl jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog as $$
declare target uuid := mediclaro_private.owner_uuid(pl->>'userId'); v_phone text; changed integer;
begin
  if target is not null then
    select regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') into v_phone from auth.users where id = target;
    if coalesce(v_phone, '') = '' then raise exception 'USER_NO_PHONE' using errcode = '22023'; end if;
  elsif pl ? 'phone' then
    v_phone := mediclaro_private.owner_normalize_phone(pl->>'phone');
    if v_phone is null then raise exception 'INVALID_PHONE' using errcode = '22023'; end if;
  else
    raise exception 'INVALID_REQUEST' using errcode = '22023';
  end if;
  update mediclaro_private.premium_grants set revoked_at = now() where phone = v_phone and revoked_at is null;
  get diagnostics changed = row_count;
  if changed > 0 then
    perform mediclaro_private.owner_audit(p_owner, 'courtesy_premium_revoked', jsonb_build_object(
      'phone_hash', mediclaro_private.owner_hash(v_phone), 'target_user', target, 'via', 'panel'));
  end if;
  return jsonb_build_object('ok', true, 'changed', changed > 0, 'phone', mediclaro_private.owner_mask_phone(v_phone));
end $$;

-- ── Bonos ────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function mediclaro_private.owner_bono_json(b mediclaro_private.owner_bonos) returns jsonb
language sql stable set search_path = pg_catalog as $$
  select jsonb_build_object('id', b.id, 'name', b.name, 'days', b.days, 'maxUses', b.max_uses, 'uses', b.uses,
    'note', b.note, 'createdAt', b.created_at, 'disabledAt', b.disabled_at,
    'state', case when b.disabled_at is not null then 'disabled' when b.uses >= b.max_uses then 'exhausted' else 'active' end)
$$;

create or replace function mediclaro_private.owner_bonos_list(pl jsonb) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog as $$
declare st text := coalesce(pl->>'state', 'all'); page integer := 0; v_total integer; v_rows jsonb;
begin
  if st not in ('all', 'active', 'finished') then raise exception 'INVALID_REQUEST' using errcode = '22023'; end if;
  if coalesce(pl->>'page', '0') ~ '^[0-9]{1,4}$' then page := (coalesce(pl->>'page', '0'))::integer; end if;
  select count(*) into v_total from mediclaro_private.owner_bonos b
   where st = 'all' or (st = 'active' and b.disabled_at is null and b.uses < b.max_uses)
      or (st = 'finished' and (b.disabled_at is not null or b.uses >= b.max_uses));
  select coalesce(jsonb_agg(mediclaro_private.owner_bono_json(x) order by x.created_at desc), '[]'::jsonb) into v_rows from (
    select * from mediclaro_private.owner_bonos b
     where st = 'all' or (st = 'active' and b.disabled_at is null and b.uses < b.max_uses)
        or (st = 'finished' and (b.disabled_at is not null or b.uses >= b.max_uses))
     order by b.created_at desc, b.id limit 25 offset page * 25) x;
  return jsonb_build_object('total', v_total, 'page', page, 'pageSize', 25, 'bonos', v_rows,
    'activeCount', (select count(*) from mediclaro_private.owner_bonos where disabled_at is null and uses < max_uses),
    'usesLeft', (select coalesce(sum(max_uses - uses), 0) from mediclaro_private.owner_bonos where disabled_at is null));
end $$;

create or replace function mediclaro_private.owner_bono_create(p_owner uuid, pl jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog as $$
declare v_name text := btrim(regexp_replace(coalesce(pl->>'name', ''), '[[:cntrl:]]', '', 'g'));
  v_note text := nullif(btrim(regexp_replace(coalesce(pl->>'note', ''), '[[:cntrl:]]', '', 'g')), '');
  v_days integer; v_max integer; b mediclaro_private.owner_bonos;
begin
  if length(v_name) < 1 or length(v_name) > 60 or (v_note is not null and length(v_note) > 200) then
    raise exception 'INVALID_NAME' using errcode = '22023';
  end if;
  if not (pl ? 'days') then raise exception 'INVALID_REQUEST' using errcode = '22023'; end if;
  if jsonb_typeof(pl->'days') = 'null' then
    v_days := null;
  elsif jsonb_typeof(pl->'days') = 'number' and (pl->>'days') ~ '^[0-9]{1,4}$' then
    v_days := (pl->>'days')::integer;
    if v_days not between 1 and 3650 then raise exception 'INVALID_REQUEST' using errcode = '22023'; end if;
  else
    raise exception 'INVALID_REQUEST' using errcode = '22023';
  end if;
  if jsonb_typeof(pl->'maxUses') <> 'number' or coalesce(pl->>'maxUses', '') !~ '^[0-9]{1,4}$' then
    raise exception 'INVALID_USES' using errcode = '22023';
  end if;
  v_max := (pl->>'maxUses')::integer;
  if v_max not between 1 and 1000 then raise exception 'INVALID_USES' using errcode = '22023'; end if;
  if (select count(*) from mediclaro_private.owner_bonos where disabled_at is null and uses < max_uses) >= 200 then
    raise exception 'TOO_MANY_BONOS' using errcode = 'P0001';
  end if;
  insert into mediclaro_private.owner_bonos (name, days, max_uses, note, created_by)
  values (v_name, v_days, v_max, v_note, p_owner) returning * into b;
  perform mediclaro_private.owner_audit(p_owner, 'owner_bono_created', jsonb_build_object(
    'bono_id', b.id, 'bono_name', b.name, 'days', b.days, 'lifetime', b.days is null, 'max_uses', b.max_uses));
  return mediclaro_private.owner_bono_json(b);
end $$;

create or replace function mediclaro_private.owner_bono_detail(pl jsonb) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog as $$
declare b mediclaro_private.owner_bonos; uses jsonb;
begin
  select * into b from mediclaro_private.owner_bonos where id = mediclaro_private.owner_uuid(pl->>'bonoId');
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', u.id,
      'userId', au.id,
      'name', nullif(btrim(coalesce(p.display_name, '')), ''),
      'phone', mediclaro_private.owner_mask_phone(u.phone),
      'verified', au.id is not null,
      'createdAt', u.created_at,
      'expiresAt', g.expires_at,
      'active', g.phone is not null and g.revoked_at is null and (g.expires_at is null or g.expires_at > now())
    ) order by u.created_at desc), '[]'::jsonb) into uses
    from (select * from mediclaro_private.owner_bono_uses where bono_id = b.id order by created_at desc limit 200) u
    left join auth.users au on au.id = u.user_id
    left join public.profiles p on p.id = au.id
    left join mediclaro_private.premium_grants g on g.phone = u.phone;
  return jsonb_build_object('bono', mediclaro_private.owner_bono_json(b), 'uses', uses);
end $$;

create or replace function mediclaro_private.owner_bono_toggle(p_owner uuid, pl jsonb, p_enable boolean) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog as $$
declare b mediclaro_private.owner_bonos;
begin
  update mediclaro_private.owner_bonos set disabled_at = case when p_enable then null else coalesce(disabled_at, now()) end
   where id = mediclaro_private.owner_uuid(pl->>'bonoId') returning * into b;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform mediclaro_private.owner_audit(p_owner, case when p_enable then 'owner_bono_enabled' else 'owner_bono_disabled' end,
    jsonb_build_object('bono_id', b.id, 'bono_name', b.name));
  return mediclaro_private.owner_bono_json(b);
end $$;

-- ── Suscripciones ────────────────────────────────────────────────────────────────────────────────────────
create or replace function mediclaro_private.owner_subscription_rows(p_tab text) returns table (
  user_id uuid, phone text, kind text, provider text, state text, starts_at timestamptz, ends_at timestamptz,
  cancelling boolean, family boolean)
language sql stable security definer set search_path = pg_catalog as $$
  select p.id, null::text, 'paid',
         case when p.subscription_id like 'bizum-%' then 'bizum' else p.billing_provider end,
         p.sub_state, p.current_period_start, p.current_period_end,
         coalesce(p.cancel_at_period_end, false), coalesce(p.paid_by_family, false)
    from public.profiles p
   where (p_tab = 'active' and p.sub_state in ('TRIAL', 'ACTIVE', 'PAST_DUE'))
      or (p_tab = 'history' and p.sub_state in ('CANCELLED', 'EXPIRED'))
  union all
  select au.id, g.phone, 'courtesy', 'courtesy',
         case when g.revoked_at is not null then 'REVOKED'
              when g.expires_at is not null and g.expires_at <= now() then 'EXPIRED' else 'ACTIVE' end,
         g.granted_at, case when g.revoked_at is not null then g.revoked_at else g.expires_at end, false, false
    from mediclaro_private.premium_grants g
    left join auth.users au on regexp_replace(coalesce(au.phone, ''), '[^0-9]', '', 'g') = g.phone
         and au.phone_confirmed_at is not null and not coalesce(au.is_anonymous, false)
   where (p_tab = 'active' and g.revoked_at is null and (g.expires_at is null or g.expires_at > now()))
      or (p_tab = 'history' and (g.revoked_at is not null or (g.expires_at is not null and g.expires_at <= now())))
$$;

create or replace function mediclaro_private.owner_subscriptions(pl jsonb) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog as $$
declare tab text := coalesce(pl->>'tab', 'active'); page integer := 0; v_total integer; v_rows jsonb;
begin
  if tab not in ('active', 'history') then raise exception 'INVALID_REQUEST' using errcode = '22023'; end if;
  if coalesce(pl->>'page', '0') ~ '^[0-9]{1,4}$' then page := (coalesce(pl->>'page', '0'))::integer; end if;
  select count(*) into v_total from mediclaro_private.owner_subscription_rows(tab);
  select coalesce(jsonb_agg(jsonb_build_object(
      'userId', r.user_id,
      'name', nullif(btrim(coalesce(p.display_name, '')), ''),
      'phone', case when r.user_id is null then mediclaro_private.owner_mask_phone(r.phone)
                    else (select mediclaro_private.owner_mask_phone(au.phone) from auth.users au where au.id = r.user_id) end,
      'kind', r.kind, 'provider', r.provider, 'state', r.state, 'startsAt', r.starts_at, 'endsAt', r.ends_at,
      'cancelAtPeriodEnd', r.cancelling, 'paidByFamily', r.family
    ) order by r.starts_at desc nulls last), '[]'::jsonb) into v_rows
    from (select * from mediclaro_private.owner_subscription_rows(tab)
           order by starts_at desc nulls last, ends_at desc nulls last limit 25 offset page * 25) r
    left join public.profiles p on p.id = r.user_id;
  return jsonb_build_object('total', v_total, 'page', page, 'pageSize', 25, 'rows', v_rows,
    'totals', jsonb_build_object(
      'paid', (select count(*) from public.profiles where sub_state in ('TRIAL', 'ACTIVE', 'PAST_DUE')),
      'trial', (select count(*) from public.profiles where sub_state = 'TRIAL'),
      'pastDue', (select count(*) from public.profiles where sub_state = 'PAST_DUE'),
      'cancelling', (select count(*) from public.profiles where sub_state in ('TRIAL', 'ACTIVE', 'PAST_DUE') and cancel_at_period_end),
      'courtesy', (select count(*) from mediclaro_private.premium_grants where revoked_at is null and (expires_at is null or expires_at > now()))
    ));
end $$;

-- ── Estadísticas (solo totales; sin datos de personas) ───────────────────────────────────────────────────
create or replace function mediclaro_private.owner_stats(pl jsonb) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog as $$
declare v_days integer; unit text; since timestamptz; first_bucket timestamp; last_bucket timestamp; series jsonb;
  tz constant text := 'Europe/Madrid';
begin
  if coalesce(pl->>'days', '30') !~ '^[0-9]{1,3}$' then raise exception 'INVALID_RANGE' using errcode = '22023'; end if;
  v_days := (coalesce(pl->>'days', '30'))::integer;
  if v_days not in (7, 30, 90, 365) then raise exception 'INVALID_RANGE' using errcode = '22023'; end if;
  unit := case v_days when 7 then 'day' when 365 then 'month' else 'week' end;
  if unit = 'day' then
    since := (date_trunc('day', now() at time zone tz) - interval '6 days') at time zone tz;
  else
    since := now() - make_interval(days => v_days);
  end if;
  first_bucket := date_trunc(unit, since at time zone tz);
  last_bucket := date_trunc(unit, now() at time zone tz);
  select coalesce(jsonb_agg(jsonb_build_object(
      'bucket', to_char(b.bucket, 'YYYY-MM-DD'),
      'doses', (select count(*) from public.medication_dose_events e
                 where e.status = 'active' and e.kind in ('taken', 'extra') and e.recorded_at >= since
                   and date_trunc(unit, e.recorded_at at time zone tz) = b.bucket),
      'chats', (select count(*) from public.usage_events e
                 where e.kind = 'chat' and coalesce(e.detail, '') <> 'emergency' and e.created_at >= since
                   and date_trunc(unit, e.created_at at time zone tz) = b.bucket),
      'emergencies', (select count(*) from public.care_incidents e
                       where e.created_at >= since and date_trunc(unit, e.created_at at time zone tz) = b.bucket)
                   + (select count(*) from public.emergency_contact_attempts e
                       where e.created_at >= since and date_trunc(unit, e.created_at at time zone tz) = b.bucket),
      'scans', (select count(*) from public.scans e
                 where e.created_at >= since and date_trunc(unit, e.created_at at time zone tz) = b.bucket)
    ) order by b.bucket), '[]'::jsonb) into series
    from (select generate_series(first_bucket, last_bucket, ('1 ' || unit)::interval) as bucket) b;
  return jsonb_build_object(
    'days', v_days, 'unit', unit, 'since', since, 'generatedAt', now(),
    'kpis', jsonb_build_object(
      'activeUsers', (select count(distinct x.uid) from (
          select user_id as uid from public.usage_events where created_at >= since and user_id is not null
          union select user_id from public.scans where created_at >= since
          union select user_id from public.medication_dose_events where recorded_at >= since) x),
      'newUsers', (select count(*) from public.profiles where created_at >= since),
      'doses', (select count(*) from public.medication_dose_events where status = 'active' and kind in ('taken', 'extra') and recorded_at >= since),
      'scans', (select count(*) from public.scans where created_at >= since),
      'chats', (select count(*) from public.usage_events where kind = 'chat' and coalesce(detail, '') <> 'emergency' and created_at >= since),
      'emergencies', (select count(*) from public.care_incidents where created_at >= since)
                   + (select count(*) from public.emergency_contact_attempts where created_at >= since),
      'careMessages', (select count(*) from public.care_chat_messages where kind = 'text' and created_at >= since),
      'calls', (select count(*) from public.care_link_calls where created_at >= since),
      'bonosUsed', (select count(*) from mediclaro_private.owner_bono_uses where created_at >= since),
      'premiumActive', (select count(*) from public.profiles p where public.is_premium(p)),
      'paidActive', (select count(*) from public.profiles where sub_state in ('TRIAL', 'ACTIVE', 'PAST_DUE')),
      'users', (select count(*) from public.profiles)
    ),
    'series', series);
end $$;

-- ── Registro y auditoría ─────────────────────────────────────────────────────────────────────────────────
create or replace function mediclaro_private.owner_audit_list(pl jsonb) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog as $$
declare tab text := coalesce(pl->>'tab', 'activity'); page integer := 0; v_rows jsonb;
begin
  if tab not in ('activity', 'events') then raise exception 'INVALID_REQUEST' using errcode = '22023'; end if;
  if coalesce(pl->>'page', '0') ~ '^[0-9]{1,4}$' then page := (coalesce(pl->>'page', '0'))::integer; end if;
  if tab = 'activity' then
    select coalesce(jsonb_agg(x.j order by x.created_at desc, x.id desc), '[]'::jsonb) into v_rows from (
      select a.id, a.created_at, jsonb_build_object(
          'id', 'a' || a.id, 'action', a.action, 'createdAt', a.created_at,
          'actor', (select nullif(btrim(coalesce(p.display_name, '')), '') from public.profiles p where p.id = a.user_id),
          'target', (select nullif(btrim(coalesce(p.display_name, '')), '') from public.profiles p
                      where p.id = mediclaro_private.owner_uuid(a.meta->>'target_user')),
          'detail', coalesce(a.meta, '{}'::jsonb) - 'phone_hash' - 'target_user' - 'bono_id') as j
        from public.audit_log a
       where a.action like 'owner\_%' escape '\' or a.action in ('courtesy_premium_granted', 'courtesy_premium_revoked')
       order by a.created_at desc, a.id desc limit 30 offset page * 30) x;
  else
    select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]'::jsonb) into v_rows from (
      select e.created_at, e.j from (
        select a.created_at, jsonb_build_object(
            'id', 'a' || a.id, 'action', a.action, 'createdAt', a.created_at,
            'actor', (select nullif(btrim(coalesce(p.display_name, '')), '') from public.profiles p where p.id = a.user_id),
            'target', null, 'detail', '{}'::jsonb) as j
          from public.audit_log a
         where not (a.action like 'owner\_%' escape '\' or a.action in ('courtesy_premium_granted', 'courtesy_premium_revoked'))
        union all
        select p.created_at, jsonb_build_object('id', 'u' || p.id, 'action', 'user_registered', 'createdAt', p.created_at,
            'actor', nullif(btrim(coalesce(p.display_name, '')), ''), 'target', null, 'detail', '{}'::jsonb)
          from public.profiles p
      ) e order by e.created_at desc limit 30 offset page * 30) x;
  end if;
  return jsonb_build_object('tab', tab, 'page', page, 'pageSize', 30, 'rows', v_rows);
end $$;

-- ── Aviso general para todos los usuarios ────────────────────────────────────────────────────────────────
create or replace function mediclaro_private.owner_notice_json() returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select value from public.app_config where key = 'app_notice'
$$;

create or replace function mediclaro_private.owner_notice_set(p_owner uuid, pl jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog as $$
declare v_title text := btrim(regexp_replace(coalesce(pl->>'title', ''), '[[:cntrl:]]', '', 'g'));
  v_message text := btrim(regexp_replace(coalesce(pl->>'message', ''), '[[:cntrl:]]', ' ', 'g'));
  v_tone text := coalesce(pl->>'tone', 'info'); v_enabled boolean; v_until timestamptz; v jsonb;
begin
  if jsonb_typeof(pl->'enabled') <> 'boolean' then raise exception 'INVALID_REQUEST' using errcode = '22023'; end if;
  v_enabled := (pl->>'enabled')::boolean;
  if v_tone not in ('info', 'warning', 'success') then raise exception 'INVALID_REQUEST' using errcode = '22023'; end if;
  if length(v_title) > 60 or length(v_message) > 280 or (v_enabled and length(v_message) < 3) then
    raise exception 'INVALID_NOTICE' using errcode = '22023';
  end if;
  if pl ? 'until' and jsonb_typeof(pl->'until') = 'string' then
    begin
      v_until := (pl->>'until')::timestamptz;
    exception when others then
      raise exception 'INVALID_NOTICE' using errcode = '22023';
    end;
    if v_until <= now() or v_until > now() + interval '90 days' then raise exception 'INVALID_NOTICE' using errcode = '22023'; end if;
  end if;
  v := jsonb_build_object('id', mediclaro_private.owner_token(), 'enabled', v_enabled, 'title', nullif(v_title, ''),
    'message', v_message, 'tone', v_tone, 'until', v_until, 'updatedAt', now());
  insert into public.app_config (key, value, description)
  values ('app_notice', v, 'Aviso general que la app muestra en Inicio (lo cambia el propietario desde el panel).')
  on conflict (key) do update set value = excluded.value, updated_at = now();
  perform mediclaro_private.owner_audit(p_owner, 'owner_notice_updated', jsonb_build_object('enabled', v_enabled, 'tone', v_tone, 'until', v_until));
  return v;
end $$;

/** Lo que lee la app (cualquier persona, también sin cuenta): el aviso activo o null. */
create or replace function public.app_notice() returns jsonb
language plpgsql stable security definer set search_path = pg_catalog as $$
declare v jsonb;
begin
  select value into v from public.app_config where key = 'app_notice';
  if v is null or coalesce((v->>'enabled')::boolean, false) is false then return null; end if;
  if v->>'until' is not null and (v->>'until')::timestamptz <= now() then return null; end if;
  return jsonb_build_object('id', v->>'id', 'title', v->>'title', 'message', v->>'message', 'tone', v->>'tone', 'until', v->>'until');
end $$;
revoke all on function public.app_notice() from public;
grant execute on function public.app_notice() to anon, authenticated;

-- ── Estado del sistema ───────────────────────────────────────────────────────────────────────────────────
create or replace function mediclaro_private.owner_system() returns jsonb
language plpgsql stable security definer set search_path = pg_catalog as $$
declare t text; pending bigint; failed bigint; delivered bigint; queues jsonb := '[]'::jsonb; jobs jsonb := '[]'::jsonb;
  labels constant jsonb := jsonb_build_object(
    'care_push_jobs', 'Avisos de ayuda', 'care_link_push_jobs', 'Vinculaciones', 'medication_alert_jobs', 'Pastillas',
    'care_chat_push_jobs', 'Chat con el cuidador/a', 'care_call_push_jobs', 'Llamadas');
begin
  foreach t in array array['care_push_jobs', 'care_link_push_jobs', 'medication_alert_jobs', 'care_chat_push_jobs', 'care_call_push_jobs'] loop
    if to_regclass('public.' || t) is not null then
      execute format('select count(*) filter (where sent_at is null),
                             count(*) filter (where provider_state in (''provider_failed'',''provider_rejected'',''provider_receipt_error'') and created_at > now() - interval ''24 hours''),
                             count(*) filter (where provider_state = ''provider_delivered'' and created_at > now() - interval ''24 hours'')
                        from public.%I', t) into pending, failed, delivered;
      queues := queues || jsonb_build_object('key', t, 'label', labels->>t, 'pending', pending, 'failed24h', failed, 'delivered24h', delivered);
    end if;
  end loop;
  if to_regclass('cron.job') is not null then
    begin
      if to_regclass('cron.job_run_details') is not null then
        execute $q$select coalesce(jsonb_agg(jsonb_build_object('name', j.jobname, 'schedule', j.schedule, 'active', j.active,
                    'lastStatus', r.status, 'lastRunAt', r.start_time) order by j.jobname), '[]'::jsonb)
                   from cron.job j
                   left join lateral (select d.status, d.start_time from cron.job_run_details d where d.jobid = j.jobid
                                       order by d.start_time desc limit 1) r on true
                  where j.jobname like 'mediclaro%'$q$ into jobs;
      else
        execute $q$select coalesce(jsonb_agg(jsonb_build_object('name', j.jobname, 'schedule', j.schedule, 'active', j.active) order by j.jobname), '[]'::jsonb)
                   from cron.job j where j.jobname like 'mediclaro%'$q$ into jobs;
      end if;
    exception when others then
      jobs := '[]'::jsonb;
    end;
  end if;
  return jsonb_build_object(
    'serverTime', now(),
    'database', 'ok',
    'features', jsonb_build_object(
      'medication', to_regclass('public.medication_dose_events') is not null,
      'careChat', to_regclass('public.care_chat_messages') is not null,
      'familyPay', to_regclass('public.family_pay_invites') is not null),
    'queues', queues,
    'cron', jobs,
    'errors24h', (select count(*) from public.usage_events where kind = 'error' and created_at > now() - interval '24 hours'),
    'aiCost24h', (select coalesce(sum(cost_micros), 0)::numeric / 1000000 from public.usage_events where created_at > now() - interval '24 hours'),
    'activeIncidents', (select count(*) from public.care_incidents where state = 'active' and expires_at > now()),
    'storeVerification', (select coalesce((value->>'storeVerification')::boolean, false) from public.app_config where key = 'plans'),
    'notice', public.app_notice() is not null);
end $$;

-- ── Copias (exportar en CSV desde la app) ────────────────────────────────────────────────────────────────
create or replace function mediclaro_private.owner_export(p_owner uuid, pl jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog as $$
declare k text := coalesce(pl->>'kind', ''); cols jsonb; v_rows jsonb;
begin
  if k = 'users' then
    cols := '["Nombre","Teléfono","Plan","Cobro","Estado","Cuidador/a","Alta"]'::jsonb;
    select coalesce(jsonb_agg(jsonb_build_array(j->>'name', j->>'phone', j->>'plan', j->>'provider', j->>'subState',
             case when (j->>'caregiver')::boolean then 'sí' else 'no' end, j->>'createdAt') order by j->>'createdAt' desc), '[]'::jsonb)
      into v_rows from (select mediclaro_private.owner_user_json(p.id) as j from public.profiles p order by p.created_at desc limit 5000) x;
  elsif k = 'subscriptions' then
    cols := '["Nombre","Teléfono","Tipo","Cobro","Estado","Desde","Hasta","Cancelada al final del periodo","La paga un familiar"]'::jsonb;
    select coalesce(jsonb_agg(jsonb_build_array(
             (select p.display_name from public.profiles p where p.id = r.user_id),
             case when r.user_id is null then mediclaro_private.owner_mask_phone(r.phone)
                  else (select mediclaro_private.owner_mask_phone(au.phone) from auth.users au where au.id = r.user_id) end,
             r.kind, r.provider, r.state, r.starts_at, r.ends_at,
             case when r.cancelling then 'sí' else 'no' end, case when r.family then 'sí' else 'no' end)), '[]'::jsonb)
      into v_rows from (select * from mediclaro_private.owner_subscription_rows('active')
                      union all select * from mediclaro_private.owner_subscription_rows('history') limit 5000) r;
  elsif k = 'bonos' then
    cols := '["Bono","Días (vacío = vitalicio)","Usos","Máximo","Estado","Creado"]'::jsonb;
    select coalesce(jsonb_agg(jsonb_build_array(b.name, b.days, b.uses, b.max_uses,
             case when b.disabled_at is not null then 'desactivado' when b.uses >= b.max_uses then 'agotado' else 'activo' end,
             b.created_at) order by b.created_at desc), '[]'::jsonb)
      into v_rows from mediclaro_private.owner_bonos b;
  elsif k = 'audit' then
    cols := '["Fecha","Acción","Quién"]'::jsonb;
    select coalesce(jsonb_agg(jsonb_build_array(a.created_at, a.action,
             (select p.display_name from public.profiles p where p.id = a.user_id)) order by a.created_at desc), '[]'::jsonb)
      into v_rows from (select * from public.audit_log order by created_at desc limit 5000) a;
  else
    raise exception 'INVALID_REQUEST' using errcode = '22023';
  end if;
  perform mediclaro_private.owner_audit(p_owner, 'owner_export', jsonb_build_object('kind', k, 'rows', jsonb_array_length(v_rows)));
  return jsonb_build_object('kind', k, 'generatedAt', now(), 'columns', cols, 'rows', v_rows);
end $$;

-- ── Entrada única del panel ──────────────────────────────────────────────────────────────────────────────
create or replace function public.owner_admin(p_action text, p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog as $$
declare u uuid := auth.uid(); a text := lower(coalesce(p_action, '')); pl jsonb := coalesce(p_payload, '{}'::jsonb);
  v_session uuid; v_check jsonb; v_result jsonb; v_device mediclaro_private.owner_devices; v_pin text;
begin
  if u is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if not mediclaro_private.is_owner(u) then raise exception 'OWNER_REQUIRED' using errcode = '42501'; end if;
  if jsonb_typeof(pl) <> 'object' then raise exception 'INVALID_REQUEST' using errcode = '22023'; end if;
  if not public.hit_rate_limit(u, 'owner_admin', 240) then raise exception 'RATE_LIMIT' using errcode = 'P0001'; end if;

  -- Abrir el panel (sin sesión del panel todavía).
  if a = 'status' then
    return mediclaro_private.owner_access_status(u);
  elsif a in ('setup_pin', 'unlock', 'unlock_device') then
    if not public.hit_rate_limit(u, 'owner_unlock', 10) then raise exception 'RATE_LIMIT' using errcode = 'P0001'; end if;
  end if;

  if a = 'setup_pin' then
    v_pin := pl->>'pin';
    if exists (select 1 from mediclaro_private.owner_pins where user_id = u) then
      raise exception 'PIN_ALREADY_SET' using errcode = 'P0001';
    end if;
    if mediclaro_private.owner_weak_pin(v_pin) then raise exception 'PIN_WEAK' using errcode = '22023'; end if;
    insert into mediclaro_private.owner_pins (user_id, pin_hash) values (u, extensions.crypt(v_pin, extensions.gen_salt('bf', 10)));
    perform mediclaro_private.owner_audit(u, 'owner_pin_created');
    v_result := jsonb_build_object('ok', true) || mediclaro_private.owner_new_session(u, 'setup');
    if pl->'trustDevice' = 'true'::jsonb then
      v_result := v_result || mediclaro_private.owner_new_device(u, pl->>'deviceLabel');
    end if;
    return v_result;
  elsif a = 'unlock' then
    v_check := mediclaro_private.owner_check_pin(u, pl->>'pin');
    if v_check is not null then return v_check; end if;
    perform mediclaro_private.owner_audit(u, 'owner_unlocked', jsonb_build_object('via', 'pin'));
    v_result := jsonb_build_object('ok', true) || mediclaro_private.owner_new_session(u, 'pin');
    if pl->'trustDevice' = 'true'::jsonb then
      v_result := v_result || mediclaro_private.owner_new_device(u, pl->>'deviceLabel');
    end if;
    return v_result;
  elsif a = 'unlock_device' then
    if coalesce(pl->>'deviceToken', '') !~ '^[0-9a-f]{64}$' then
      return jsonb_build_object('ok', false, 'error', 'DEVICE_INVALID');
    end if;
    select * into v_device from mediclaro_private.owner_devices
     where token_hash = mediclaro_private.owner_hash(pl->>'deviceToken') and user_id = u for update;
    if not found or v_device.revoked_at is not null or v_device.expires_at <= now() then
      return jsonb_build_object('ok', false, 'error', 'DEVICE_INVALID');
    end if;
    update mediclaro_private.owner_devices set last_used_at = now() where id = v_device.id;
    perform mediclaro_private.owner_audit(u, 'owner_unlocked', jsonb_build_object('via', 'device', 'label', v_device.label));
    return jsonb_build_object('ok', true) || mediclaro_private.owner_new_session(u, 'device', v_device.id);
  end if;

  -- Todo lo demás necesita el panel abierto.
  v_session := mediclaro_private.owner_touch_session(u, pl->>'session');
  pl := pl - 'session';

  case a
    when 'lock' then
      update mediclaro_private.owner_sessions set revoked_at = now() where id = v_session;
      return jsonb_build_object('ok', true);
    when 'overview' then
      return jsonb_build_object(
        'owner', mediclaro_private.owner_access_status(u),
        'counts', jsonb_build_object(
          'users', (select count(*) from public.profiles),
          'newUsers7d', (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
          'premium', (select count(*) from public.profiles p where public.is_premium(p)),
          'paid', (select count(*) from public.profiles where sub_state in ('TRIAL', 'ACTIVE', 'PAST_DUE')),
          'pastDue', (select count(*) from public.profiles where sub_state = 'PAST_DUE'),
          'courtesy', (select count(*) from mediclaro_private.premium_grants where revoked_at is null and (expires_at is null or expires_at > now())),
          'caregivers', (select count(distinct caregiver_id) from public.care_links where accepted_at is not null and revoked_at is null),
          'bonosActive', (select count(*) from mediclaro_private.owner_bonos where disabled_at is null and uses < max_uses),
          'activeIncidents', (select count(*) from public.care_incidents where state = 'active' and expires_at > now()),
          'errors24h', (select count(*) from public.usage_events where kind = 'error' and created_at > now() - interval '24 hours')),
        'notice', public.app_notice(),
        'sessionExpiresAt', (select expires_at from mediclaro_private.owner_sessions where id = v_session));
    when 'users' then return mediclaro_private.owner_users(pl);
    when 'user' then return mediclaro_private.owner_user_detail(u, pl);
    when 'grant' then return mediclaro_private.owner_grant(u, pl);
    when 'revoke' then return mediclaro_private.owner_revoke(u, pl);
    when 'bonos' then return mediclaro_private.owner_bonos_list(pl);
    when 'bono_create' then return mediclaro_private.owner_bono_create(u, pl);
    when 'bono' then return mediclaro_private.owner_bono_detail(pl);
    when 'bono_disable' then return mediclaro_private.owner_bono_toggle(u, pl, false);
    when 'bono_enable' then return mediclaro_private.owner_bono_toggle(u, pl, true);
    when 'subscriptions' then return mediclaro_private.owner_subscriptions(pl);
    when 'stats' then return mediclaro_private.owner_stats(pl);
    when 'audit' then return mediclaro_private.owner_audit_list(pl);
    when 'notice_get' then return jsonb_build_object('notice', mediclaro_private.owner_notice_json());
    when 'notice_set' then return jsonb_build_object('notice', mediclaro_private.owner_notice_set(u, pl));
    when 'system' then return mediclaro_private.owner_system();
    when 'export' then return mediclaro_private.owner_export(u, pl);
    when 'account' then
      return mediclaro_private.owner_access_status(u) || jsonb_build_object(
        'pinUpdatedAt', (select updated_at from mediclaro_private.owner_pins where user_id = u),
        'sessions', (select count(*) from mediclaro_private.owner_sessions where user_id = u and revoked_at is null and expires_at > now()),
        'recentUnlocks', coalesce((select jsonb_agg(jsonb_build_object('at', s.created_at, 'via', s.via) order by s.created_at desc)
                                     from (select * from mediclaro_private.owner_sessions where user_id = u
                                            order by created_at desc limit 5) s), '[]'::jsonb));
    when 'devices' then
      return jsonb_build_object('devices', coalesce((select jsonb_agg(jsonb_build_object(
          'id', d.id, 'label', d.label, 'createdAt', d.created_at, 'lastUsedAt', d.last_used_at, 'expiresAt', d.expires_at,
          'current', exists (select 1 from mediclaro_private.owner_sessions s where s.id = v_session and s.device_id = d.id))
          order by d.created_at desc)
        from mediclaro_private.owner_devices d where d.user_id = u and d.revoked_at is null and d.expires_at > now()), '[]'::jsonb));
    when 'device_revoke' then
      update mediclaro_private.owner_devices set revoked_at = now()
       where id = mediclaro_private.owner_uuid(pl->>'deviceId') and user_id = u and revoked_at is null;
      if found then
        perform mediclaro_private.owner_audit(u, 'owner_device_removed');
      end if;
      return jsonb_build_object('ok', true);
    when 'trust_device' then
      -- Activar Face ID en este teléfono con el panel ya abierto (pide otra vez el código).
      v_check := mediclaro_private.owner_check_pin(u, pl->>'pin');
      if v_check is not null then return v_check; end if;
      perform mediclaro_private.owner_audit(u, 'owner_device_added');
      return jsonb_build_object('ok', true) || mediclaro_private.owner_new_device(u, pl->>'deviceLabel');
    when 'change_pin' then
      v_check := mediclaro_private.owner_check_pin(u, pl->>'currentPin');
      if v_check is not null then return v_check; end if;
      v_pin := pl->>'newPin';
      if mediclaro_private.owner_weak_pin(v_pin) then raise exception 'PIN_WEAK' using errcode = '22023'; end if;
      if v_pin = pl->>'currentPin' then raise exception 'PIN_SAME' using errcode = '22023'; end if;
      update mediclaro_private.owner_pins
         set pin_hash = extensions.crypt(v_pin, extensions.gen_salt('bf', 10)), updated_at = now(), failed_count = 0, locked_until = null
       where user_id = u;
      -- Fuera todo lo anterior: dispositivos con Face ID y el resto de sesiones.
      update mediclaro_private.owner_devices set revoked_at = now() where user_id = u and revoked_at is null;
      update mediclaro_private.owner_sessions set revoked_at = now() where user_id = u and revoked_at is null and id <> v_session;
      perform mediclaro_private.owner_audit(u, 'owner_pin_changed');
      return jsonb_build_object('ok', true);
    else
      raise exception 'INVALID_ACTION' using errcode = '22023';
  end case;
end $$;

revoke all on function public.owner_admin(text, jsonb) from public, anon;
grant execute on function public.owner_admin(text, jsonb) to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'mediclaro_private.owner_hash(text)', 'mediclaro_private.owner_token()', 'mediclaro_private.owner_uuid(text)',
    'mediclaro_private.owner_mask_phone(text)', 'mediclaro_private.owner_normalize_phone(text)', 'mediclaro_private.owner_weak_pin(text)',
    'mediclaro_private.owner_new_session(uuid, text, uuid)', 'mediclaro_private.owner_touch_session(uuid, text)',
    'mediclaro_private.owner_new_device(uuid, text)', 'mediclaro_private.owner_audit(uuid, text, jsonb)',
    'mediclaro_private.owner_user_json(uuid)', 'mediclaro_private.owner_access_status(uuid)',
    'mediclaro_private.owner_check_pin(uuid, text)', 'mediclaro_private.owner_users(jsonb)',
    'mediclaro_private.owner_user_detail(uuid, jsonb)', 'mediclaro_private.owner_grant(uuid, jsonb)',
    'mediclaro_private.owner_revoke(uuid, jsonb)', 'mediclaro_private.owner_bono_json(mediclaro_private.owner_bonos)',
    'mediclaro_private.owner_bonos_list(jsonb)', 'mediclaro_private.owner_bono_create(uuid, jsonb)',
    'mediclaro_private.owner_bono_detail(jsonb)', 'mediclaro_private.owner_bono_toggle(uuid, jsonb, boolean)',
    'mediclaro_private.owner_subscription_rows(text)', 'mediclaro_private.owner_subscriptions(jsonb)',
    'mediclaro_private.owner_stats(jsonb)', 'mediclaro_private.owner_audit_list(jsonb)',
    'mediclaro_private.owner_notice_json()', 'mediclaro_private.owner_notice_set(uuid, jsonb)',
    'mediclaro_private.owner_system()', 'mediclaro_private.owner_export(uuid, jsonb)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- Limpieza: sesiones y dispositivos caducados (cada día a las 03:41).
create or replace function mediclaro_private.owner_cleanup() returns void
language sql volatile security definer set search_path = pg_catalog as $$
  delete from mediclaro_private.owner_sessions where expires_at < now() - interval '30 days';
  delete from mediclaro_private.owner_devices where coalesce(revoked_at, expires_at) < now() - interval '30 days';
$$;
revoke all on function mediclaro_private.owner_cleanup() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
do $$ begin
  if exists (select 1 from cron.job where jobname = 'mediclaro-owner-cleanup') then
    perform cron.unschedule('mediclaro-owner-cleanup');
  end if;
end $$;
select cron.schedule('mediclaro-owner-cleanup', '41 3 * * *', $cron$select mediclaro_private.owner_cleanup()$cron$);
