import { admin } from './common.ts';

/** Caché en Postgres (tabla med_cache) para datos públicos farmacológicos.
 *  Si en el futuro hace falta más velocidad, se sustituye por Redis aquí sin tocar nada más. */
export async function cached<T>(provider: string, key: string, ttlHours: number, fetcher: () => Promise<T>): Promise<T> {
  const { data } = await admin.from('med_cache').select('data, fetched_at').eq('provider', provider).eq('key', key).maybeSingle();
  if (data && Date.now() - new Date(data.fetched_at).getTime() < ttlHours * 3600_000) return data.data as T;
  try {
    const fresh = await fetcher();
    if (fresh != null) {
      await admin.from('med_cache').upsert({ provider, key, data: fresh as any, fetched_at: new Date().toISOString() });
    }
    return fresh;
  } catch (e) {
    if (data) return data.data as T; // fuente caída: servimos la última copia buena
    throw e;
  }
}
