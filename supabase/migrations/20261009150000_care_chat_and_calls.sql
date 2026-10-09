-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- MediClaro · Chat y llamadas de voz entre la persona Premium y su cuidador/a (09/10/2026).
-- LA APLICA EL PROPIETARIO:  npx supabase db push   (y después desplegar `caregiver-dispatch` y `caregiver-rtc-config`).
--
-- Aditiva e idempotente: no cambia tablas, funciones ni políticas existentes. El chat y la llamada de los avisos de
-- emergencia (care_incidents / care_messages / care_calls) siguen exactamente igual; esto añade, por cada vinculación
-- ACEPTADA y vigente (care_links), una conversación PERMANENTE y llamadas de voz por internet en cualquier momento.
--
--  · care_chat_messages    Mensajes de la conversación (y el registro de las llamadas: «Llamada perdida», «Llamada de
--                          voz · 3 min»). Solo los ven las dos personas de la vinculación.
--  · care_chat_push_jobs   Cola de avisos push «X te ha escrito» (solo el servidor). Nunca lleva el texto del mensaje.
--  · care_link_calls       Llamadas de voz (señalización WebRTC: oferta y respuesta SDP; el audio va de móvil a móvil,
--                          cifrado, y nunca pasa por esta base de datos). La SDP se borra al terminar.
--  · care_call_push_jobs   Cola de avisos push «X te está llamando» (solo el servidor).
--
-- Reglas (todas en el servidor):
--  · Solo las dos personas de una vinculación ACEPTADA y no revocada pueden leer, escribir o llamarse.
--  · Para escribir o llamar, la persona cuidada debe tener MediClaro Premium (el cuidador/a sigue siendo gratis).
--  · Idempotente: el teléfono crea los identificadores; reenviar tras perder la respuesta nunca duplica.
--  · Una sola llamada a la vez por persona; una llamada sin contestar se corta a los 45 s y queda «Llamada perdida».
--  · Conservación: mensajes 90 días; llamadas (sin SDP) 7 días. Al desvincular, la conversación deja de verse al
--    momento y se borra en la limpieza diaria. Al eliminar la cuenta se borra todo en cascada.
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────

create schema if not exists mediclaro_private;

-- ─── Tablas ──────────────────────────────────────────────────────────────────────────────────────────────

create table if not exists public.care_chat_messages (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.care_links(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (length(btrim(content)) between 1 and 1000),
  client_key uuid not null,
  -- 'text': mensaje escrito; 'call': registro de una llamada (lo crea el servidor al terminarla).
  kind text not null default 'text' check (kind in ('text', 'call')),
  call_outcome text check (call_outcome is null or call_outcome in ('answered', 'missed', 'declined', 'failed')),
  call_seconds integer check (call_seconds is null or call_seconds between 0 and 86400),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (sender_id, client_key),
  check ((kind = 'call') = (call_outcome is not null))
);
create index if not exists care_chat_messages_link_idx on public.care_chat_messages (link_id, created_at desc);
create index if not exists care_chat_messages_unread_idx on public.care_chat_messages (link_id, sender_id) where read_at is null;

create table if not exists public.care_chat_push_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  link_id uuid not null references public.care_links(id) on delete cascade,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0,
  lease_until timestamptz,
  provider_state text not null default 'pending',
  ticket_ids jsonb
);
-- Un solo aviso pendiente por persona y conversación: varios mensajes seguidos → un aviso («te ha escrito 3 mensajes»).
create unique index if not exists care_chat_push_jobs_pending_once on public.care_chat_push_jobs (user_id, link_id) where sent_at is null;
create index if not exists care_chat_push_jobs_pending on public.care_chat_push_jobs (created_at) where sent_at is null;

create table if not exists public.care_link_calls (
  id uuid primary key,
  link_id uuid not null references public.care_links(id) on delete cascade,
  caller_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  state text not null default 'ringing' check (state in ('ringing', 'answered', 'ended')),
  outcome text check (outcome is null or outcome in ('answered', 'missed', 'declined', 'failed')),
  offer text check (offer is null or length(offer) <= 64000),
  answer text check (answer is null or length(answer) <= 64000),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  expires_at timestamptz not null default now() + interval '45 seconds',
  check (caller_id <> recipient_id)
);
-- Una sola llamada en curso por conversación.
create unique index if not exists care_link_calls_one_active on public.care_link_calls (link_id) where state in ('ringing', 'answered');
create index if not exists care_link_calls_recipient_idx on public.care_link_calls (recipient_id) where state = 'ringing';

create table if not exists public.care_call_push_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  link_id uuid not null references public.care_links(id) on delete cascade,
  call_id uuid not null references public.care_link_calls(id) on delete cascade,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0,
  lease_until timestamptz,
  provider_state text not null default 'pending',
  ticket_ids jsonb,
  unique (call_id)
);
create index if not exists care_call_push_jobs_pending on public.care_call_push_jobs (created_at) where sent_at is null;

-- La app no lee ni escribe estas tablas directamente: todo pasa por care_chat_action y care_call_action
-- (sin políticas = sin acceso).
alter table public.care_chat_messages enable row level security;
alter table public.care_chat_push_jobs enable row level security;
alter table public.care_link_calls enable row level security;
alter table public.care_call_push_jobs enable row level security;
revoke all on public.care_chat_messages, public.care_chat_push_jobs, public.care_link_calls, public.care_call_push_jobs
  from public, anon, authenticated;
grant all on public.care_chat_messages, public.care_chat_push_jobs, public.care_link_calls, public.care_call_push_jobs
  to service_role;

-- ─── Ayudas internas ─────────────────────────────────────────────────────────────────────────────────────

create or replace function mediclaro_private.care_chat_uuid(p text) returns uuid
language sql immutable as $$
  select case when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p::uuid else null end
$$;

create or replace function mediclaro_private.care_chat_ts(p text) returns timestamptz
language plpgsql stable as $$
begin
  if p is null or length(p) > 40 then return null; end if;
  return p::timestamptz;
exception when others then
  return null;
end;
$$;

create or replace function mediclaro_private.care_chat_message_json(m public.care_chat_messages) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', m.id, 'linkId', m.link_id, 'senderId', m.sender_id, 'content', m.content,
    'kind', m.kind, 'callOutcome', m.call_outcome, 'callSeconds', m.call_seconds,
    'createdAt', m.created_at, 'readAt', m.read_at)
$$;

-- Datos de la conversación vistos por la persona conectada (u).
create or replace function mediclaro_private.care_chat_conversation_json(l public.care_links, u uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'linkId', l.id,
    'myRole', case when l.patient_id = u then 'patient' else 'caregiver' end,
    'otherId', case when l.patient_id = u then l.caregiver_id else l.patient_id end,
    'otherName', case when l.patient_id = u then coalesce(nullif(btrim(l.caregiver_name), ''), 'Tu cuidador/a') else l.patient_name end,
    'patientName', l.patient_name,
    'canSend', coalesce((select public.is_premium(p) from public.profiles p where p.id = l.patient_id), false),
    'unread', (select count(*) from public.care_chat_messages x where x.link_id = l.id and x.sender_id <> u and x.read_at is null),
    'lastMessage', (select mediclaro_private.care_chat_message_json(x) from public.care_chat_messages x
                    where x.link_id = l.id order by x.created_at desc, x.id desc limit 1)
  )
$$;

-- Llamada vista por la persona conectada (u): cada una recibe solo la SDP que necesita.
create or replace function mediclaro_private.care_call_json(c public.care_link_calls, u uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', c.id,
    'linkId', c.link_id,
    'direction', case when c.caller_id = u then 'outgoing' else 'incoming' end,
    'callerId', c.caller_id,
    'recipientId', c.recipient_id,
    'otherName', (select case when (l.patient_id = u) then coalesce(nullif(btrim(l.caregiver_name), ''), 'Tu cuidador/a') else l.patient_name end
                  from public.care_links l where l.id = c.link_id),
    'state', c.state,
    'outcome', c.outcome,
    'offer', case when c.recipient_id = u and c.state = 'ringing' then c.offer end,
    'answer', case when c.caller_id = u and c.state = 'answered' then c.answer end,
    'createdAt', c.created_at,
    'answeredAt', c.answered_at,
    'endedAt', c.ended_at,
    'expiresAt', c.expires_at
  )
$$;

-- Termina una llamada y deja su registro en el chat («Llamada de voz · 3 min», «Llamada perdida»…).
create or replace function mediclaro_private.care_call_finish(p_call uuid, p_outcome text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c public.care_link_calls;
  secs integer;
begin
  select * into c from public.care_link_calls where id = p_call for update;
  if c.id is null or c.state = 'ended' then return; end if;
  secs := case when p_outcome = 'answered' and c.answered_at is not null
               then least(86400, greatest(0, extract(epoch from now() - c.answered_at)::integer)) end;
  update public.care_link_calls set state = 'ended', outcome = p_outcome, ended_at = now(), offer = null, answer = null
  where id = c.id;
  insert into public.care_chat_messages (link_id, sender_id, content, client_key, kind, call_outcome, call_seconds, read_at)
  values (c.link_id, c.caller_id,
          case p_outcome when 'answered' then 'Llamada de voz' when 'declined' then 'Llamada rechazada'
                         when 'failed' then 'Llamada no conectada' else 'Llamada perdida' end,
          c.id, 'call', p_outcome, secs,
          -- Una llamada perdida cuenta como «sin leer» para quien la recibe; las demás ya las vieron los dos.
          case when p_outcome = 'missed' then null else now() end)
  on conflict (sender_id, client_key) do nothing;
  update public.care_call_push_jobs set sent_at = now(), provider_state = 'cancelled' where call_id = c.id and sent_at is null;
end;
$$;

-- Llamadas que nadie contestó a tiempo, demasiado largas o de vinculaciones que ya no están: se cierran.
-- p_user null = todas (limpieza); si no, solo las de esa persona (barato, en cada consulta).
create or replace function mediclaro_private.care_call_expire(p_user uuid) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c public.care_link_calls;
  n integer := 0;
begin
  for c in
    select * from public.care_link_calls x
    where x.state <> 'ended' and (p_user is null or x.caller_id = p_user or x.recipient_id = p_user)
      and (x.expires_at <= now()
           or not exists (select 1 from public.care_links l where l.id = x.link_id and l.accepted_at is not null and l.revoked_at is null))
  loop
    perform mediclaro_private.care_call_finish(c.id, case when c.state = 'answered' then 'answered' else 'missed' end);
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function mediclaro_private.care_chat_uuid(text), mediclaro_private.care_chat_ts(text),
  mediclaro_private.care_chat_message_json(public.care_chat_messages),
  mediclaro_private.care_chat_conversation_json(public.care_links, uuid),
  mediclaro_private.care_call_json(public.care_link_calls, uuid),
  mediclaro_private.care_call_finish(uuid, text),
  mediclaro_private.care_call_expire(uuid) from public, anon, authenticated;

-- ─── Chat: lo que llama la app ───────────────────────────────────────────────────────────────────────────
--  list      → { conversations: [...] }  (todas las conversaciones de la persona, con no leídos y último mensaje)
--  messages  → { conversation, messages: [...], hasMore }   payload { linkId, limit?, before? }
--  send      → { message, replayed }     payload { linkId, content, clientKey }
--  read      → { read: n }               payload { linkId }   (marca como leídos los mensajes de la otra persona)
--  export    → { conversations: [{ ..., messages }] }       (portabilidad: «Descargar mis datos»)

create or replace function public.care_chat_action(p_action text, p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  u uuid := auth.uid();
  v_link public.care_links;
  v_patient public.profiles;
  v_msg public.care_chat_messages;
  v_link_id uuid;
  v_content text;
  v_key uuid;
  v_limit integer;
  v_before timestamptz;
  v_other uuid;
  v_count integer;
  v_result jsonb;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then p_payload := '{}'::jsonb; end if;
  if not public.hit_rate_limit(u, 'care-chat-' || left(coalesce(p_action, ''), 20), case when p_action = 'send' then 20 else 120 end) then
    raise exception 'RATE_LIMIT';
  end if;
  -- Las llamadas sin contestar se cierran y su «Llamada perdida» aparece en la conversación.
  perform mediclaro_private.care_call_expire(u);

  if p_action = 'list' then
    -- Primero la conversación con el mensaje más reciente.
    select coalesce(jsonb_agg(s.c order by s.last_at desc nulls last, s.c->>'otherName'), '[]'::jsonb)
      into v_result
    from (
      select mediclaro_private.care_chat_conversation_json(l, u) as c,
             (select max(x.created_at) from public.care_chat_messages x where x.link_id = l.id) as last_at
      from public.care_links l
      where l.caregiver_id is not null and l.accepted_at is not null and l.revoked_at is null
        and (l.patient_id = u or l.caregiver_id = u)
    ) s;
    return jsonb_build_object('conversations', v_result);
  end if;

  if p_action = 'export' then
    select coalesce(jsonb_agg(mediclaro_private.care_chat_conversation_json(l, u) || jsonb_build_object('messages',
      coalesce((select jsonb_agg(mediclaro_private.care_chat_message_json(x) order by x.created_at, x.id)
                from public.care_chat_messages x where x.link_id = l.id), '[]'::jsonb))), '[]'::jsonb)
      into v_result
    from public.care_links l
    where l.caregiver_id is not null and l.accepted_at is not null and l.revoked_at is null
      and (l.patient_id = u or l.caregiver_id = u);
    return jsonb_build_object('conversations', v_result);
  end if;

  -- El resto de acciones son sobre UNA conversación en la que participa la persona conectada.
  v_link_id := mediclaro_private.care_chat_uuid(p_payload->>'linkId');
  if v_link_id is null then raise exception 'INVALID_REQUEST'; end if;
  select * into v_link from public.care_links l
  where l.id = v_link_id and l.caregiver_id is not null and l.accepted_at is not null and l.revoked_at is null
    and (l.patient_id = u or l.caregiver_id = u);
  if v_link.id is null then raise exception 'NOT_ALLOWED'; end if;

  if p_action = 'messages' then
    v_limit := case when coalesce(p_payload->>'limit', '') ~ '^[0-9]{1,4}$' then (p_payload->>'limit')::integer else 80 end;
    v_limit := least(greatest(v_limit, 1), 200);
    v_before := mediclaro_private.care_chat_ts(p_payload->>'before');
    select count(*) into v_count from (
      select 1 from public.care_chat_messages x
      where x.link_id = v_link.id and (v_before is null or x.created_at < v_before) limit v_limit + 1) t;
    select coalesce(jsonb_agg(mediclaro_private.care_chat_message_json(x) order by x.created_at, x.id), '[]'::jsonb)
      into v_result
    from (
      select * from public.care_chat_messages x
      where x.link_id = v_link.id and (v_before is null or x.created_at < v_before)
      order by x.created_at desc, x.id desc limit v_limit) x;
    return jsonb_build_object('conversation', mediclaro_private.care_chat_conversation_json(v_link, u),
      'messages', v_result, 'hasMore', v_count > v_limit);
  end if;

  if p_action = 'send' then
    select * into v_patient from public.profiles where id = v_link.patient_id;
    if v_patient.id is null or not public.is_premium(v_patient) then raise exception 'PREMIUM_REQUIRED'; end if;
    v_key := mediclaro_private.care_chat_uuid(p_payload->>'clientKey');
    if v_key is null then raise exception 'INVALID_REQUEST'; end if;
    -- Reintento del mismo envío (se perdió la respuesta): el mismo mensaje, nunca un duplicado.
    select * into v_msg from public.care_chat_messages where sender_id = u and client_key = v_key;
    if v_msg.id is not null then
      if v_msg.link_id <> v_link.id or v_msg.kind <> 'text' then raise exception 'INVALID_REQUEST'; end if;
      return jsonb_build_object('message', mediclaro_private.care_chat_message_json(v_msg), 'replayed', true);
    end if;
    -- Sin caracteres de control (salvo saltos de línea y tabuladores).
    v_content := btrim(regexp_replace(coalesce(p_payload->>'content', ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'));
    if length(v_content) < 1 or length(v_content) > 1000 then raise exception 'INVALID_CONTENT'; end if;
    insert into public.care_chat_messages (link_id, sender_id, content, client_key)
    values (v_link.id, u, v_content, v_key)
    on conflict (sender_id, client_key) do nothing
    returning * into v_msg;
    if v_msg.id is null then
      select * into v_msg from public.care_chat_messages where sender_id = u and client_key = v_key;
      return jsonb_build_object('message', mediclaro_private.care_chat_message_json(v_msg), 'replayed', true);
    end if;
    v_other := case when v_link.patient_id = u then v_link.caregiver_id else v_link.patient_id end;
    insert into public.care_chat_push_jobs (user_id, link_id) values (v_other, v_link.id) on conflict do nothing;
    return jsonb_build_object('message', mediclaro_private.care_chat_message_json(v_msg), 'replayed', false);
  end if;

  if p_action = 'read' then
    update public.care_chat_messages set read_at = now()
    where link_id = v_link.id and sender_id <> u and read_at is null;
    get diagnostics v_count = row_count;
    -- Si ya lo ha leído, el aviso pendiente sobra.
    update public.care_chat_push_jobs set sent_at = now(), provider_state = 'cancelled'
    where user_id = u and link_id = v_link.id and sent_at is null;
    return jsonb_build_object('read', v_count);
  end if;

  raise exception 'INVALID_ACTION';
end;
$$;
revoke all on function public.care_chat_action(text, jsonb) from public, anon;
grant execute on function public.care_chat_action(text, jsonb) to authenticated;

-- ─── Llamadas: lo que llama la app ───────────────────────────────────────────────────────────────────────
--  incoming  → la llamada que está sonando para la persona (o null)
--  offer     → { linkId, callId, sdp }   llamar (la persona cuidada debe tener Premium)
--  snapshot  → { callId }                estado de la llamada
--  answer    → { callId, sdp }           contestar
--  decline   → { callId }                rechazar
--  end       → { callId }                colgar (o cancelar antes de que conteste)
--  fail      → { callId }                el audio no ha podido conectarse

create or replace function public.care_call_action(p_action text, p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  u uuid := auth.uid();
  v_link public.care_links;
  v_patient public.profiles;
  v_call public.care_link_calls;
  v_link_id uuid;
  v_id uuid;
  v_other uuid;
  v_sdp text;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then p_payload := '{}'::jsonb; end if;
  if not public.hit_rate_limit(u, 'care-call-' || left(coalesce(p_action, ''), 20),
                               case when p_action in ('snapshot', 'incoming') then 120 else 20 end) then
    raise exception 'RATE_LIMIT';
  end if;
  perform mediclaro_private.care_call_expire(u);

  if p_action = 'incoming' then
    select c.* into v_call from public.care_link_calls c
    where c.recipient_id = u and c.state = 'ringing' and c.expires_at > now()
    order by c.created_at desc limit 1;
    return case when v_call.id is null then 'null'::jsonb else mediclaro_private.care_call_json(v_call, u) end;
  end if;

  if p_action = 'offer' then
    v_link_id := mediclaro_private.care_chat_uuid(p_payload->>'linkId');
    v_id := mediclaro_private.care_chat_uuid(p_payload->>'callId');
    if v_link_id is null or v_id is null then raise exception 'INVALID_REQUEST'; end if;
    select * into v_link from public.care_links l
    where l.id = v_link_id and l.caregiver_id is not null and l.accepted_at is not null and l.revoked_at is null
      and (l.patient_id = u or l.caregiver_id = u)
    for update;
    if v_link.id is null then raise exception 'NOT_ALLOWED'; end if;
    select * into v_patient from public.profiles where id = v_link.patient_id;
    if v_patient.id is null or not public.is_premium(v_patient) then raise exception 'PREMIUM_REQUIRED'; end if;
    -- Reintento de la misma llamada: la misma, nunca otra.
    select * into v_call from public.care_link_calls where id = v_id;
    if v_call.id is not null then
      if v_call.caller_id <> u or v_call.link_id <> v_link.id then raise exception 'INVALID_REQUEST'; end if;
      return mediclaro_private.care_call_json(v_call, u);
    end if;
    v_sdp := p_payload->>'sdp';
    if length(coalesce(v_sdp, '')) not between 1 and 64000 or v_sdp not like 'v=0%' then raise exception 'INVALID_SDP'; end if;
    v_other := case when v_link.patient_id = u then v_link.caregiver_id else v_link.patient_id end;
    -- Una sola llamada a la vez: ni en esta conversación ni la otra persona en otra llamada.
    if exists (select 1 from public.care_link_calls x where x.state <> 'ended'
               and (x.link_id = v_link.id or x.caller_id in (u, v_other) or x.recipient_id in (u, v_other))) then
      raise exception 'CALL_BUSY';
    end if;
    begin
      insert into public.care_link_calls (id, link_id, caller_id, recipient_id, offer)
      values (v_id, v_link.id, u, v_other, v_sdp) returning * into v_call;
    exception when unique_violation then
      raise exception 'CALL_BUSY';
    end;
    insert into public.care_call_push_jobs (user_id, link_id, call_id) values (v_other, v_link.id, v_id) on conflict do nothing;
    return mediclaro_private.care_call_json(v_call, u);
  end if;

  -- El resto: una llamada concreta en la que participa la persona.
  v_id := mediclaro_private.care_chat_uuid(p_payload->>'callId');
  if v_id is null then raise exception 'INVALID_REQUEST'; end if;
  select * into v_call from public.care_link_calls where id = v_id and (caller_id = u or recipient_id = u) for update;
  if v_call.id is null then raise exception 'NOT_ALLOWED'; end if;

  if p_action = 'snapshot' then
    return mediclaro_private.care_call_json(v_call, u);
  end if;

  if p_action = 'answer' then
    if v_call.recipient_id <> u then raise exception 'NOT_ALLOWED'; end if;
    if v_call.state <> 'ringing' or v_call.expires_at <= now() then raise exception 'CALL_ENDED'; end if;
    v_sdp := p_payload->>'sdp';
    if length(coalesce(v_sdp, '')) not between 1 and 64000 or v_sdp not like 'v=0%' then raise exception 'INVALID_SDP'; end if;
    update public.care_link_calls
    set answer = v_sdp, offer = null, state = 'answered', answered_at = now(), expires_at = now() + interval '2 hours'
    where id = v_call.id returning * into v_call;
    update public.care_call_push_jobs set sent_at = now(), provider_state = 'cancelled' where call_id = v_call.id and sent_at is null;
    return mediclaro_private.care_call_json(v_call, u);
  end if;

  if p_action = 'decline' then
    if v_call.recipient_id <> u then raise exception 'NOT_ALLOWED'; end if;
    if v_call.state = 'ringing' then perform mediclaro_private.care_call_finish(v_call.id, 'declined'); end if;
  elsif p_action = 'end' then
    if v_call.state <> 'ended' then
      perform mediclaro_private.care_call_finish(v_call.id,
        case when v_call.state = 'answered' then 'answered' when v_call.caller_id = u then 'missed' else 'declined' end);
    end if;
  elsif p_action = 'fail' then
    if v_call.state <> 'ended' then perform mediclaro_private.care_call_finish(v_call.id, 'failed'); end if;
  else
    raise exception 'INVALID_ACTION';
  end if;
  select * into v_call from public.care_link_calls where id = v_id;
  return mediclaro_private.care_call_json(v_call, u);
end;
$$;
revoke all on function public.care_call_action(text, jsonb) from public, anon;
grant execute on function public.care_call_action(text, jsonb) to authenticated;

-- ─── Avisos push (los recoge la función caregiver-dispatch) ──────────────────────────────────────────────
-- Chat: si la persona ya lo ha leído todo o la vinculación terminó, el aviso se cancela. El aviso solo dice quién
-- escribe y cuántos mensajes hay sin leer: nunca el texto.
create or replace function public.care_chat_claim_push_jobs() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  update public.care_chat_push_jobs j set sent_at = now(), provider_state = 'cancelled'
  where j.sent_at is null and (
    not exists (select 1 from public.care_links l where l.id = j.link_id and l.accepted_at is not null and l.revoked_at is null
                  and (l.patient_id = j.user_id or l.caregiver_id = j.user_id))
    or not exists (select 1 from public.care_chat_messages m where m.link_id = j.link_id and m.sender_id <> j.user_id and m.read_at is null));
  with claimed as (
    update public.care_chat_push_jobs j set attempts = attempts + 1, lease_until = now() + interval '90 seconds'
    where id in (select id from public.care_chat_push_jobs where sent_at is null and attempts < 5
                   and (lease_until is null or lease_until < now()) order by created_at for update skip locked limit 40)
    returning j.*
  )
  select coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object(
      'tokens', coalesce((select jsonb_agg(d.token) from public.care_devices d where d.user_id = c.user_id and d.enabled), '[]'::jsonb),
      'senderName', (select case when l.patient_id = c.user_id then coalesce(nullif(btrim(l.caregiver_name), ''), 'Tu cuidador/a')
                                 else l.patient_name end
                     from public.care_links l where l.id = c.link_id),
      'unread', (select count(*) from public.care_chat_messages m where m.link_id = c.link_id and m.sender_id <> c.user_id and m.read_at is null))),
    '[]'::jsonb)
  into result from claimed c;
  return result;
end;
$$;
revoke all on function public.care_chat_claim_push_jobs() from public, anon, authenticated;
grant execute on function public.care_chat_claim_push_jobs() to service_role;

-- Llamadas: «X te está llamando». Si la llamada ya no está sonando, el aviso se cancela.
create or replace function public.care_call_claim_push_jobs() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  perform mediclaro_private.care_call_expire(null);
  update public.care_call_push_jobs j set sent_at = now(), provider_state = 'cancelled'
  where j.sent_at is null
    and not exists (select 1 from public.care_link_calls c where c.id = j.call_id and c.state = 'ringing' and c.expires_at > now());
  with claimed as (
    update public.care_call_push_jobs j set attempts = attempts + 1, lease_until = now() + interval '30 seconds'
    where id in (select id from public.care_call_push_jobs where sent_at is null and attempts < 3
                   and (lease_until is null or lease_until < now()) order by created_at for update skip locked limit 40)
    returning j.*
  )
  select coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object(
      'tokens', coalesce((select jsonb_agg(d.token) from public.care_devices d where d.user_id = c.user_id and d.enabled), '[]'::jsonb),
      'callerName', (select case when l.patient_id = c.user_id then coalesce(nullif(btrim(l.caregiver_name), ''), 'Tu cuidador/a')
                                 else l.patient_name end
                     from public.care_links l where l.id = c.link_id))),
    '[]'::jsonb)
  into result from claimed c;
  return result;
end;
$$;
revoke all on function public.care_call_claim_push_jobs() from public, anon, authenticated;
grant execute on function public.care_call_claim_push_jobs() to service_role;

-- Despierta al repartidor al encolar un aviso (la misma función segura que los avisos de emergencia). Por fila: si
-- ya había un aviso de chat pendiente para esa conversación, no se inserta otro y no se despierta de nuevo.
drop trigger if exists care_chat_push_wake on public.care_chat_push_jobs;
create trigger care_chat_push_wake after insert on public.care_chat_push_jobs
  for each row execute function public.care_wake_dispatch();
drop trigger if exists care_call_push_wake on public.care_call_push_jobs;
create trigger care_call_push_wake after insert on public.care_call_push_jobs
  for each row execute function public.care_wake_dispatch();

-- ─── Conservación (limpieza diaria) ──────────────────────────────────────────────────────────────────────
create or replace function mediclaro_private.care_chat_cleanup() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  perform mediclaro_private.care_call_expire(null);
  delete from public.care_chat_messages m
  where m.created_at < now() - interval '90 days'
     or exists (select 1 from public.care_links l where l.id = m.link_id and l.revoked_at is not null);
  get diagnostics n = row_count;
  delete from public.care_link_calls where state = 'ended' and created_at < now() - interval '7 days';
  delete from public.care_chat_push_jobs where created_at < now() - interval '7 days';
  delete from public.care_call_push_jobs where created_at < now() - interval '7 days';
  return n;
end;
$$;
revoke all on function mediclaro_private.care_chat_cleanup() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
do $$ begin
  if exists (select 1 from cron.job where jobname = 'mediclaro-care-chat-cleanup') then
    perform cron.unschedule('mediclaro-care-chat-cleanup');
  end if;
end $$;
select cron.schedule('mediclaro-care-chat-cleanup', '23 3 * * *', $cron$ select mediclaro_private.care_chat_cleanup(); $cron$);
