-- Si la persona elimina su cuenta, se eliminan también sus comentarios y motivos.
-- Priorizamos privacidad frente a conservar analítica histórica identificable.
alter table public.product_feedback
  drop constraint if exists product_feedback_user_id_fkey;
alter table public.product_feedback
  add constraint product_feedback_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
