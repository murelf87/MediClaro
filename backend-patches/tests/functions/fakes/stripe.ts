// Doble de prueba de supabase/functions/_shared/stripe.ts: sin red ni claves.
// La «firma» válida es la cadena "firma-valida"; el cuerpo es el evento en JSON.
// deno-lint-ignore-file no-explicit-any
import { state } from './state.ts';

export const stripe: any = {
  customers: {
    create(params: any) {
      const id = `cus_new_${state.checkoutSessions.length + 1}`;
      state.customers.push({ id, ...params });
      return Promise.resolve({ id });
    },
  },
  checkout: {
    sessions: {
      create(params: any, options?: any) {
        const id = `cs_test_${state.checkoutSessions.length + 1}`;
        const session = { id, url: `https://checkout.stripe.com/c/pay/${id}`, status: 'open', params, options: options ?? null };
        state.checkoutSessions.push(session);
        return Promise.resolve({ id, url: session.url, status: 'open' });
      },
      retrieve(id: string) {
        const s = state.checkoutSessions.find((x: any) => x.id === id);
        return s ? Promise.resolve({ id: s.id, url: s.url, status: s.status }) : Promise.reject(new Error(`No existe ${id}`));
      },
    },
  },
  webhooks: {
    constructEventAsync(raw: string, sig: string) {
      if (sig !== 'firma-valida') return Promise.reject(new Error('firma no válida'));
      return Promise.resolve(JSON.parse(raw));
    },
  },
  subscriptions: {
    retrieve(id: string) {
      const sub = state.subscriptions[id];
      return sub ? Promise.resolve(structuredClone(sub)) : Promise.reject(new Error(`No existe la suscripción ${id}`));
    },
    cancel(id: string) {
      state.canceledSubscriptions.push(id);
      return Promise.resolve({ id, status: 'canceled' });
    },
  },
};

export const cryptoProvider = {};
export const PRICE_BASE = 'price_base_test';
export const PRICE_METERED = 'price_metered_test';
export const METER_EVENT = 'mediclaro_escaneo_extra';
