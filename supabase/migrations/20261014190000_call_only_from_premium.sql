-- Las llamadas solo pueden iniciarlas la persona Premium (paciente) hacia su cuidador/a.
-- La cuidadora recibe y contesta, pero no marca. Se aplica en el servidor, no solo en la app.

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
    -- Solo llama la persona que paga Premium (la que tiene el vínculo como paciente). La persona cuidadora no llama.
    if v_link.patient_id <> u then raise exception 'CAREGIVER_CANNOT_CALL'; end if;
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
