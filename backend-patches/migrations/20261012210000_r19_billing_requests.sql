-- PROPUESTA R-19 (NO APLICADA) · Registro de las solicitudes de desistimiento, cancelación y eliminación.
--
-- Problema que resuelve: hoy no queda rastro de QUÉ pidió la persona ni CUÁNDO. Los consentimientos se
-- guardan en `consents`, pero esa tabla se borra en cascada al eliminar la cuenta, así que justo en el caso
-- en el que hay dinero de por medio (alguien desiste y a la vez elimina su cuenta) no quedaría nada con lo
-- que calcular la devolución ni con lo que acreditar que se atendió la solicitud.
--
-- Qué se guarda y qué no: lo mínimo para poder devolver el dinero y responder de ello — qué se pidió,
-- cuándo, el plan, quién cobra y un identificador interno de la persona. NUNCA datos de salud, ni el
-- teléfono, ni el nombre. La fila sobrevive al borrado de la cuenta a propósito (`on delete set null` en la
-- clave ajena y una copia del identificador en texto), porque es la prueba de una obligación económica.
--
-- Idempotente: se puede aplicar dos veces.

create table if not exists public.billing_requests (
  id bigint generated always as identity primary key,
  -- Se pone a null cuando se elimina la cuenta: la fila se queda, sin apuntar ya a un usuario que no existe.
  user_id uuid references auth.users(id) on delete set null,
  -- Copia del identificador para poder localizar la solicitud después del borrado (no se borra en cascada).
  user_ref text not null, -- SHA-256 (hex) del id de usuario; no se guarda el id en claro
  -- withdrawal = desistimiento (14 días) · cancel_renewal = no renovar · account_deletion = eliminar la cuenta
  kind text not null check (kind in ('withdrawal', 'cancel_renewal', 'account_deletion')),
  requested_at timestamptz not null default now(),
  plan_id text,
  provider text check (provider is null or provider in ('stripe', 'apple', 'google')),
  -- Al eliminar: si quedaba una suscripción de tienda que seguiría cobrándose y se avisó de ello.
  store_subscription_active boolean not null default false,
  -- Cómo acabó: pending → refunded / rejected / not_applicable. Lo gestiona el titular.
  status text not null default 'pending' check (status in ('pending', 'refunded', 'rejected', 'not_applicable')),
  resolved_at timestamptz,
  -- Nota interna del titular (por ejemplo, el importe devuelto). Nunca datos de salud.
  note text,
  created_at timestamptz not null default now()
);

create index if not exists billing_requests_user_ref_idx on public.billing_requests (user_ref);
create index if not exists billing_requests_pending_idx on public.billing_requests (status, requested_at)
  where status = 'pending';

alter table public.billing_requests enable row level security;

-- Cada persona ve e inserta SOLO sus propias solicitudes; nadie puede modificarlas ni borrarlas desde la
-- app (es un registro, no un dato editable). El titular las gestiona con la clave de servicio.
drop policy if exists "mis solicitudes" on public.billing_requests;
create policy "mis solicitudes" on public.billing_requests
  for select using (auth.uid() = user_id);

drop policy if exists "pedir" on public.billing_requests;
create policy "pedir" on public.billing_requests
  for insert with check (auth.uid() = user_id and user_ref = encode(sha256(convert_to(auth.uid()::text, 'UTF8')), 'hex'));

comment on table public.billing_requests is
  'Solicitudes de desistimiento, cancelación y eliminación. Se conservan tras eliminar la cuenta (prueba de una obligación económica): solo qué se pidió, cuándo, el plan, quién cobra y un identificador interno.';
