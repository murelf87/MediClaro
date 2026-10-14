-- Shared profile identity for Basic, Caregiver and Premium accounts.
-- Name, sex and age are explicit profile fields. Contact phone remains optional here.
-- Premium phone verification continues to be controlled by the existing auth flow.

alter table public.profiles
  add column if not exists sex text,
  add column if not exists age smallint,
  add column if not exists contact_phone text,
  add column if not exists avatar_path text;

do $$ begin
  alter table public.profiles add constraint profiles_sex_check
    check (sex is null or sex in ('female','male','other','prefer_not_to_say'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_age_check
    check (age is null or age between 0 and 120);
exception when duplicate_object then null; end $$;

-- The existing settings RPC remains the only client write path to profile fields.
create or replace function public.update_my_settings(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  sex_value text;
  age_value int;
  phone_value text;
  avatar_value text;
begin
  sex_value := nullif(trim(coalesce(p->>'sex','')), '');
  if sex_value is not null and sex_value not in ('female','male','other','prefer_not_to_say') then
    raise exception 'INVALID_SEX';
  end if;

  if p ? 'age' then
    age_value := nullif(trim(coalesce(p->>'age','')), '')::int;
    if age_value is not null and (age_value < 0 or age_value > 120) then raise exception 'INVALID_AGE'; end if;
  end if;

  if p ? 'contact_phone' then
    phone_value := nullif(regexp_replace(coalesce(p->>'contact_phone',''),'[^0-9+]','','g'),'');
    if phone_value is not null and length(phone_value) not between 6 and 20 then raise exception 'INVALID_PHONE'; end if;
  end if;

  if p ? 'avatar_path' then
    avatar_value := nullif(trim(coalesce(p->>'avatar_path','')), '');
    if avatar_value is not null and avatar_value !~ ('^' || auth.uid()::text || '/[A-Za-z0-9._-]+$') then
      raise exception 'INVALID_AVATAR_PATH';
    end if;
  end if;

  update public.profiles set
    display_name = case when p ? 'display_name' then left(nullif(trim(p->>'display_name'),''),60) else display_name end,
    locale      = coalesce(p->>'locale', locale),
    font_size   = coalesce(p->>'font_size', font_size),
    easy_mode   = coalesce((p->>'easy_mode')::boolean, easy_mode),
    speech_rate = coalesce((p->>'speech_rate')::real, speech_rate),
    onboarded   = coalesce((p->>'onboarded')::boolean, onboarded),
    sex         = case when p ? 'sex' then sex_value else sex end,
    age         = case when p ? 'age' then age_value::smallint else age end,
    contact_phone = case when p ? 'contact_phone' then phone_value else contact_phone end,
    avatar_path = case when p ? 'avatar_path' then avatar_value else avatar_path end,
    updated_at  = now()
  where id = auth.uid();

  if p ? 'display_name' and nullif(trim(p->>'display_name'),'') is null then
    raise exception 'INVALID_NAME';
  end if;
end $$;
revoke all on function public.update_my_settings(jsonb) from public, anon;
grant execute on function public.update_my_settings(jsonb) to authenticated;

grant select (sex, age, contact_phone, avatar_path) on public.profiles to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-avatars','profile-avatars',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "avatar own read" on storage.objects;
drop policy if exists "avatar own insert" on storage.objects;
drop policy if exists "avatar own update" on storage.objects;
drop policy if exists "avatar own delete" on storage.objects;

create policy "avatar own read" on storage.objects for select to authenticated
using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);

create policy "avatar own insert" on storage.objects for insert to authenticated
with check(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);

create policy "avatar own update" on storage.objects for update to authenticated
using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);

create policy "avatar own delete" on storage.objects for delete to authenticated
using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
