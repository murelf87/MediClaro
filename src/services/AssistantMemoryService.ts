import { requireUserId, supabase } from '../api';
import { localStore } from '../api/storage';

export interface AssistantMemoryState {
  enabled: boolean;
}

async function key(): Promise<string> {
  return `mediclaro.assistantMemory.v1.${await requireUserId()}`;
}

export const AssistantMemoryService = {
  async get(): Promise<AssistantMemoryState> {
    return localStore.getJSON<AssistantMemoryState>(await key(), { enabled: false });
  },

  async setEnabled(enabled: boolean): Promise<AssistantMemoryState> {
    const next = { enabled };
    await localStore.setJSON(await key(), next);
    return next;
  },

  async clear(): Promise<AssistantMemoryState> {
    const userId = await requireUserId();
    const { error } = await supabase.from('assistant_memories').delete().eq('user_id', userId);
    if (error) throw error;
    const next = { enabled: false };
    await localStore.setJSON(await key(), next);
    return next;
  },
};
