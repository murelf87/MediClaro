-- Arreglo: el alta del móvil para avisos fallaba siempre con «column reference "token" is ambiguous»
-- (la función caregiver_action tiene una variable llamada token y la tabla care_devices una columna token).
-- Consecuencia: ningún móvil quedaba registrado y no llegaba ningún aviso push (chat, tomas, llamadas).
-- Se cambia solo esa línea para usar el nombre de la clave primaria; el resto de la función no se toca.
do $$
declare d text; n int;
begin
  d := pg_get_functiondef('public.caregiver_action(text,jsonb)'::regprocedure);
  n := (length(d) - length(replace(d, 'on conflict(token) do update', ''))) / length('on conflict(token) do update');
  if n = 1 then
    execute replace(d, 'on conflict(token) do update', 'on conflict on constraint care_devices_pkey do update');
  elsif position('on conflict on constraint care_devices_pkey' in d) = 0 then
    raise exception 'caregiver_action: no se encontró la línea a corregir';
  end if;
end $$;
