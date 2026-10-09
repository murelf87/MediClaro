/**
 * Refresca los datos cada vez que la pantalla vuelve a estar visible
 * (sin repetir la carga inicial que ya hace useAsync).
 */
import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

export function useRefreshOnFocus(refresh: () => unknown): void {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void refresh();
    }, [refresh]),
  );
}
