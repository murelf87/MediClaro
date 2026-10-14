-- R-26 · Las 100 identificaciones incluidas son POR MES también en planes trimestral/anual.
-- La ventana mensual se ancla al inicio de la suscripción. Para un plan mensual coincide
-- con current_period_start; para trimestral/anual avanza por aniversarios mensuales.
create or replace function public.period_start_for(p public.profiles) returns timestamptz
language sql stable set search_path = public as $$
  select case
    when public.is_premium(p) and p.current_period_start is not null then
      p.current_period_start + (
        greatest(0,
          (extract(year from age(now(), p.current_period_start))::int * 12) +
          extract(month from age(now(), p.current_period_start))::int
        ) * interval '1 month'
      )
    else date_trunc('month', now())
  end
$$;
