// Simulador mínimo de la base de datos de Supabase para probar las migraciones SIN tocar el proyecto real.
//
// Usa PGlite (PostgreSQL compilado a WebAssembly, se ejecuta en memoria dentro de Node) y reproduce lo que
// importa de Supabase para estas pruebas:
//   · roles anon / authenticated / service_role (service_role ignora RLS, como en Supabase)
//   · esquema auth con auth.users y auth.uid() (lee el «sub» del JWT de la sesión simulada)
//   · permisos por defecto del esquema public (Supabase concede todo a los tres roles y la seguridad
//     real la ponen las políticas RLS y los REVOKE de cada migración)
//
// No sustituye a una prueba en un proyecto de Supabase de staging: no incluye PostgREST ni GoTrue.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

const BOOTSTRAP = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export async function createDb() {
  const db = new PGlite();
  await db.exec(BOOTSTRAP);
  return db;
}

/** Aplica, en orden de nombre, todos los .sql de una carpeta (como `supabase db push`). */
export async function applyMigrations(db, dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    try {
      await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
    } catch (e) {
      throw new Error(`Error al aplicar ${f}: ${e.message}`);
    }
  }
  return files;
}

export async function applyFile(db, file) {
  await db.exec(fs.readFileSync(file, 'utf8'));
}

/** Crea un usuario en auth.users (el trigger de la migración inicial crea su fila en profiles). */
export async function createUser(db, phone = '+34600000000') {
  const r = await db.query('insert into auth.users (phone) values ($1) returning id', [phone]);
  return r.rows[0].id;
}

async function runAs(db, role, sub, fn) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [sub ?? '']);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

/** Ejecuta `fn` como la app con la sesión de `userId` (rol authenticated + RLS). */
export const asUser = (db, userId, fn) => runAs(db, 'authenticated', userId, fn);
/** Ejecuta `fn` como un cliente sin sesión (rol anon). */
export const asAnon = (db, fn) => runAs(db, 'anon', null, fn);
/** Ejecuta `fn` como las Edge Functions (service_role, sin RLS). */
export const asService = (db, fn) => runAs(db, 'service_role', null, fn);

/** Devuelve el código de error de PostgreSQL (o 'OK' si no falla). */
export async function errorCode(promise) {
  try {
    await promise;
    return 'OK';
  } catch (e) {
    return e.code ?? String(e.message);
  }
}
