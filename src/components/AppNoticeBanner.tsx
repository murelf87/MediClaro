/**
 * Aviso general de MediClaro arriba en Inicio (lo pone el propietario desde su panel). Se puede cerrar con «Entendido».
 */
import { useCallback, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { InfoBanner } from './Feedback';
import { AppNoticeService, type AppNotice } from '../services/AppNoticeService';

export function AppNoticeBanner({ style }: { style?: StyleProp<ViewStyle> }) {
  const [notice, setNotice] = useState<AppNotice | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void AppNoticeService.visible().then((n) => {
        if (alive) setNotice(n);
      });
      return () => {
        alive = false;
      };
    }, []),
  );
  if (!notice) return null;
  return (
    <InfoBanner
      tone={notice.tone}
      icon={notice.tone === 'warning' ? 'warning-outline' : notice.tone === 'success' ? 'sparkles-outline' : 'megaphone-outline'}
      title={notice.title ?? undefined}
      message={notice.message}
      action={{
        label: 'Entendido',
        onPress: () => {
          setNotice(null);
          void AppNoticeService.dismiss(notice.id);
        },
      }}
      style={style}
      testID="app-notice"
    />
  );
}
