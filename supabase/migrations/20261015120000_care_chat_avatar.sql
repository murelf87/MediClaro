-- Foto de perfil en el chat de cuidado (Fallos_mediclaro.pdf: «la foto de perfil en el chat de cuidador y de premium no se ve»).
--
-- Hasta ahora cada persona solo podía leer SU propia foto (bucket privado `profile-avatars`, carpeta = su id).
-- Con esto, las dos personas de una vinculación ACEPTADA y no revocada pueden ver la foto de la otra. Nadie más.
--  · care_link_avatar(link): devuelve la ruta de la foto de la otra persona de esa vinculación (o null).
--  · política de lectura: se puede firmar la foto de alguien con quien tienes una vinculación activa.
-- No cambia nada de lo existente: solo añade una función y una política nueva.

create or replace function public.care_link_avatar(p_link uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  other_id uuid;
  path text;
begin
  if u is null then return null; end if;
  select case when l.patient_id = u then l.caregiver_id else l.patient_id end into other_id
  from public.care_links l
  where l.id = p_link
    and l.accepted_at is not null and l.revoked_at is null
    and (l.patient_id = u or l.caregiver_id = u);
  if other_id is null then return null; end if;
  select p.avatar_path into path from public.profiles p where p.id = other_id;
  return nullif(trim(coalesce(path, '')), '');
end $$;

revoke all on function public.care_link_avatar(uuid) from public, anon;
grant execute on function public.care_link_avatar(uuid) to authenticated;

drop policy if exists "avatar linked read" on storage.objects;
create policy "avatar linked read" on storage.objects for select to authenticated
using (
  bucket_id = 'profile-avatars'
  and exists (
    select 1 from public.care_links l
    where l.accepted_at is not null and l.revoked_at is null
      and (
        (l.patient_id = auth.uid() and l.caregiver_id::text = (storage.foldername(name))[1])
        or (l.caregiver_id = auth.uid() and l.patient_id::text = (storage.foldername(name))[1])
      )
  )
);
