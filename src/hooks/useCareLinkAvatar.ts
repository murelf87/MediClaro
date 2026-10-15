/**
 * Foto de perfil de la otra persona del chat de cuidado (Fallos_mediclaro.pdf).
 * El servidor solo la da si la vinculación está aceptada (care_link_avatar + política «avatar linked read»).
 * Si no hay foto, o el servidor aún no tiene esta función, devuelve null y se ven las iniciales como antes.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const SIGNED_URL_SECONDS = 60 * 60;

export function useCareLinkAvatar(linkId: string | null): string | null {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUri(null);
    if (!linkId) return;
    void (async () => {
      try {
        const { data: path, error } = await supabase.rpc('care_link_avatar', { p_link: linkId });
        if (error || typeof path !== 'string' || !path) return;
        const signed = await supabase.storage.from('profile-avatars').createSignedUrl(path, SIGNED_URL_SECONDS);
        if (alive && signed.data?.signedUrl) setUri(signed.data.signedUrl);
      } catch {
        /* sin foto: se ven las iniciales */
      }
    })();
    return () => {
      alive = false;
    };
  }, [linkId]);
  return uri;
}
