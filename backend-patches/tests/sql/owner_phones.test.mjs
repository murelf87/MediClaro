// Propietarios: solo Antonio y Marina. Prueba 20261009191000_owner_phones_antonio_marina.sql en PGlite (pgcrypto).
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`create extension if not exists pgcrypto; create schema extensions; create schema mediclaro_private;
  create function extensions.digest(t text, a text) returns bytea language sql immutable as $$ select public.digest(t, a) $$;
  create table mediclaro_private.owner_phones (phone_hash text primary key, enabled boolean not null default true);
  insert into mediclaro_private.owner_phones (phone_hash) values
   ('e0e245ca2aa438c172d9f4371290e620f541cb4e5e5df4b0013bdc42c712f8ee'),
   ('cf4ca8322176be84ebe41ab295af8879fecd5d0c3cf6a6b9c6841ffe807b0898'),
   ('0000000000000000000000000000000000000000000000000000000000000000');`);
const sql = fs.readFileSync(process.argv[2], 'utf8');
await db.exec(sql); await db.exec(sql);
const rows = (await db.query(`select phone_hash, enabled from mediclaro_private.owner_phones order by phone_hash`)).rows;
assert.equal(rows.length, 3);
assert.deepEqual(rows.filter((r) => r.enabled).map((r) => r.phone_hash).sort(), [
  'cf4ca8322176be84ebe41ab295af8879fecd5d0c3cf6a6b9c6841ffe807b0898', 'e0e245ca2aa438c172d9f4371290e620f541cb4e5e5df4b0013bdc42c712f8ee']);
assert.equal(rows.find((r) => r.phone_hash.startsWith('0000')).enabled, false, 'cualquier otro teléfono queda desactivado');
console.log('MIGRACION_PROPIETARIOS=OK');
