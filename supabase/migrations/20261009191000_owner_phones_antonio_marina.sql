-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- MediClaro · Propietarios: solo Antonio (+34 680 127 015) y Marina (+34 646 350 527).
-- 09/10/2026. Aditiva e idempotente: deja habilitados exactamente esos dos teléfonos (ya dados de alta el 02/10)
-- y desactiva cualquier otro que hubiera. Se guardan solo sus huellas SHA-256, nunca el número.
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
insert into mediclaro_private.owner_phones (phone_hash, enabled) values
  (encode(extensions.digest('34680127015', 'sha256'), 'hex'), true),   -- Antonio
  (encode(extensions.digest('34646350527', 'sha256'), 'hex'), true)    -- Marina
on conflict (phone_hash) do update set enabled = true;

update mediclaro_private.owner_phones
   set enabled = false
 where phone_hash not in (
   encode(extensions.digest('34680127015', 'sha256'), 'hex'),
   encode(extensions.digest('34646350527', 'sha256'), 'hex'));
