-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- MediClaro · Chat con el cuidador/a: la conversación la abre la persona cuidada (Premium).
-- 09/10/2026. Aditiva: solo vuelve a definir dos funciones de 20261009150000_care_chat_and_calls.sql.
--
--  - La persona cuidada (con Premium) escribe cuando quiere.
--  - Su cuidador/a solo puede escribir mientras la conversación está «encendida»: desde el último mensaje de la
--    persona cuidada y durante 1 hora. Pasada esa hora sin que la persona cuidada escriba, el chat se apaga para
--    el cuidador/a (lo ve apagado, en rojo) hasta que la persona cuidada vuelva a escribirle.
--  - Las llamadas de voz y el chat de los avisos de emergencia no cambian.
--
-- La app recibe en cada conversación «openUntil» (hasta cuándo está encendida, o null) y «canSend» ya tiene en
-- cuenta la ventana para el cuidador/a. Si el cuidador/a intenta escribir con el chat apagado: CHAT_CLOSED.
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Hasta cuándo está encendido el chat para el cuidador/a (null = apagado).
create or replace function mediclaro_private.care_chat_open_until(p_link uuid) returns timestamptz
language sql stable security definer set search_path = public, pg_temp as $$
  select max(m.created_at) + interval '1 hour'
  from public.care_chat_messages m
  join public.care_links l on l.id = m.link_id
  where m.link_id = p_link and m.kind = 'text' and m.sender_id = l.patient_id
    and m.created_at > now() - interval '1 hour'
$$;

-- Datos de la conversación vistos por la persona conectada (u), ahora con la ventana del cuidador/a.
create or replace function mediclaro_private.care_chat_conversation_json(l public.care_links, u uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'linkId', l.id,
    'myRole', case when l.patient_id = u then 'patient' else 'caregiver' end,
    'otherId', case when l.patient_id = u then l.caregiver_id else l.patient_id end,
    'otherName', case when l.patient_id = u then coalesce(nullif(btrim(l.caregiver_name), ''), 'Tu cuidador/a') else l.patient_name end,
    'patientName', l.patient_name,
    'premium', coalesce((select public.is_premium(p) from public.profiles p where p.id = l.patient_id), false),
    'openUntil', mediclaro_private.care_chat_open_until(l.id),
    'canSend', coalesce((select public.is_premium(p) from public.profiles p where p.id = l.patient_id), false)
               and (l.patient_id = u or mediclaro_private.care_chat_open_until(l.id) is not null),
    'unread', (select count(*) from public.care_chat_messages x where x.link_id = l.id and x.sender_id <> u and x.read_at is null),
    'lastMessage', (select mediclaro_private.care_chat_message_json(x) from public.care_chat_messages x
                    where x.link_id = l.id order by x.created_at desc, x.id desc limit 1)
  )
$$;

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
    -- El cuidador/a solo escribe mientras la conversación está encendida (1 hora desde el último mensaje de la
    -- persona cuidada). Se comprueba aquí, en el servidor: la app solo lo enseña.
    if v_link.patient_id <> u and mediclaro_private.care_chat_open_until(v_link.id) is null then
      raise exception 'CHAT_CLOSED';
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
