/**
 * «En línea» en el chat de cuidado: las dos personas se anuncian en un canal de presencia de Supabase Realtime
 * mientras tienen la conversación abierta y la app en primer plano. No guarda nada en la base de datos.
 * Si no hay conexión en tiempo real, simplemente no se muestra «En línea» (el chat funciona igual).
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { carePresenceChannel, isOtherOnline } from '../utils/carePresence';

export function useCarePresence(linkId: string | null, myId: string | null, otherId: string | null): boolean {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    if (!linkId || !myId || !otherId) return;
    let closed = false;
    const channel = supabase.channel(carePresenceChannel(linkId), { config: { presence: { key: myId } } });
    const sync = () => {
      if (!closed) setOnline(isOtherOnline(channel.presenceState() as Record<string, unknown[]>, otherId));
    };
    const announce = () => void channel.track({ at: Date.now() }).catch(() => undefined);

    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && AppState.currentState === 'active') announce();
      });

    // En segundo plano deja de estar «En línea»; al volver, se anuncia otra vez.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') announce();
      else void channel.untrack().catch(() => undefined);
    });

    return () => {
      closed = true;
      sub.remove();
      void channel.untrack().catch(() => undefined);
      void supabase.removeChannel(channel);
      setOnline(false);
    };
  }, [linkId, myId, otherId]);

  return online;
}
