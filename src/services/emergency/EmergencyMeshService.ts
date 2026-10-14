/**
 * Cola local de contingencia. No implementa BLE, P2P, relay ni una red mesh.
 * El almacenamiento local usa secureLocalStore; el payload base64 NO tiene
 * cifrado de extremo a extremo y no debe retransmitirse a intermediarios.
 */
import { secureLocalStore } from '../../api/storage';

export type EmergencyTransport = 'internet' | 'mesh_pending';
export interface MeshEnvelope {
  id: string;
  createdAt: string;
  expiresAt: string;
  payload: string;
  attempts: number;
}
const KEY = 'mediclaro.emergency.mesh.outbox.v1';

async function readOutbox(): Promise<MeshEnvelope[]> {
  return secureLocalStore.getJSON<MeshEnvelope[]>(KEY, []);
}
async function writeOutbox(items: MeshEnvelope[]): Promise<void> {
  await secureLocalStore.setJSON(KEY, items);
}
function encode(value: unknown): string {
  // Contenedor opaco para el adaptador nativo. Antes de producción se sustituye
  // por cifrado de extremo a extremo con claves del destinatario/backend.
  return typeof globalThis.btoa === 'function'
    ? globalThis.btoa(unescape(encodeURIComponent(JSON.stringify(value))))
    : JSON.stringify(value);
}
export const EmergencyMeshService = {
  async queue(payload: Record<string, unknown>): Promise<MeshEnvelope> {
    const now = Date.now();
    const envelope: MeshEnvelope = {
      id: `mesh-${now}-${Math.random().toString(36).slice(2, 10)}`,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 6 * 60 * 60 * 1000).toISOString(),
      payload: encode(payload),
      attempts: 0,
    };
    const current = (await readOutbox()).filter((x) => Date.parse(x.expiresAt) > now);
    await writeOutbox([...current, envelope]);
    return envelope;
  },
  async pending(): Promise<MeshEnvelope[]> {
    const now = Date.now();
    const current = (await readOutbox()).filter((x) => Date.parse(x.expiresAt) > now);
    await writeOutbox(current);
    return current;
  },
  async delivered(id: string): Promise<void> {
    await writeOutbox((await readOutbox()).filter((x) => x.id !== id));
  },
};
