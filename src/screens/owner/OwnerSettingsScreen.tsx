/**
 * /owner/settings — Configuración (pantalla 8 del diseño): «Ajustes del sistema y la plataforma» y una tarjeta por
 * apartado con su icono azul: Datos del propietario, Seguridad (código y autenticación), Notificaciones (el aviso
 * para todos en la app), Respaldos (exportar datos) y Mantenimiento (estado del sistema).
 */
import { useCallback } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useAsync } from '../../hooks';
import { OwnerAdminService } from '../../services/OwnerAdminService';
import { OIcon, OPill, ORow, OwnerScreen } from './OwnerKit';
import type { IconName } from '../../components';

type Item = { key: string; icon: IconName; title: string; subtitle?: string; path: string };

// Como en el diseño. «Respaldos» solo exporta: la restauración se hace en Supabase, nunca desde el móvil.
const ITEMS: Item[] = [
  { key: 'account', icon: 'id-card', title: 'Datos del propietario', path: '/owner/account' },
  { key: 'security', icon: 'lock-closed', title: 'Seguridad', subtitle: 'Código y autenticación', path: '/owner/security' },
  { key: 'notice', icon: 'notifications', title: 'Notificaciones', subtitle: 'Alertas y avisos', path: '/owner/notice' },
  { key: 'backup', icon: 'document-text', title: 'Respaldos', subtitle: 'Exportar datos', path: '/owner/backup' },
  { key: 'system', icon: 'settings', title: 'Mantenimiento', subtitle: 'Estado del sistema', path: '/owner/system' },
];

export default function OwnerSettingsScreen() {
  const router = useRouter();
  const notice = useAsync(() => OwnerAdminService.notice(), []);
  useFocusEffect(
    useCallback(() => {
      if (notice.status !== 'loading') void notice.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  const n = notice.data;
  const noticeOn = !!n?.enabled && (!n.until || new Date(n.until).getTime() > Date.now());
  return (
    <OwnerScreen title="Configuración" subtitle="Ajustes del sistema y la plataforma." testID="owner-settings">
      {ITEMS.map((it) => (
        <ORow
          key={it.key}
          left={<OIcon icon={it.icon} variant="soft" size={44} />}
          title={it.title}
          subtitle={it.subtitle}
          right={it.key === 'notice' && noticeOn ? <OPill label="Aviso activo" /> : undefined}
          onPress={() => router.push(it.path as Href)}
          testID={`owner-settings-${it.key}`}
        />
      ))}
    </OwnerScreen>
  );
}
