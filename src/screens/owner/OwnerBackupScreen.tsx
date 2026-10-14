/**
 * /owner/backup — Respaldos (Configuración › Respaldos · Exportar datos): descarga en CSV (Excel, Números) los
 * usuarios, suscripciones, bonos y el registro. Teléfonos ocultos y sin datos de salud. Cada descarga queda en el
 * registro. La copia completa de la base de datos y su restauración se hacen desde el panel de Supabase: desde el
 * móvil no se puede restaurar nada, para que nadie borre datos por error.
 */
import { useRef, useState } from 'react';
import { Icon, type IconName } from '../../components';
import { OwnerAdminService, toCsv } from '../../services/OwnerAdminService';
import { shareOrDownloadText } from '../../utils/device';
import { toAppError } from '../../api/errors';
import { OC, OIcon, ONote, ORow, OSection, OwnerScreen } from './OwnerKit';

type Kind = 'users' | 'subscriptions' | 'bonos' | 'audit';
const ITEMS: { kind: Kind; icon: IconName; label: string; description: string }[] = [
  { kind: 'users', icon: 'people', label: 'Usuarios', description: 'Nombre, teléfono oculto, plan y alta' },
  { kind: 'subscriptions', icon: 'calendar', label: 'Suscripciones', description: 'De pago y de regalo, con su vigencia' },
  { kind: 'bonos', icon: 'gift', label: 'Bonos', description: 'Nombre, duración, usos y estado' },
  { kind: 'audit', icon: 'document-text', label: 'Registro', description: 'Las últimas 5.000 acciones' },
];

export default function OwnerBackupScreen() {
  const [busy, setBusy] = useState<Kind | null>(null);
  const [message, setMessage] = useState<{ tone: 'green' | 'amber'; text: string } | null>(null);
  const lock = useRef(false);

  const download = async (kind: Kind, label: string) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(kind);
    setMessage(null);
    try {
      const data = await OwnerAdminService.exportData(kind);
      const day = new Date().toISOString().slice(0, 10);
      const ok = await shareOrDownloadText(`mediclaro-${kind}-${day}.csv`, toCsv(data), 'text/csv');
      setMessage(ok ? { tone: 'green', text: `${label}: ${data.rows.length} filas preparadas.` } : { tone: 'amber', text: 'No se ha guardado ni compartido el archivo.' });
    } catch (e) {
      setMessage({ tone: 'amber', text: toAppError(e).message });
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  return (
    <OwnerScreen title="Respaldos" subtitle="Exporta los datos del panel en un archivo CSV que se abre con Excel o Números. Los teléfonos salen ocultos y no incluye datos de salud." testID="owner-backup">
      <OSection title="Exportar datos" />
      {ITEMS.map((it) => (
        <ORow
          key={it.kind}
          left={<OIcon icon={it.icon} variant="soft" size={44} />}
          title={it.label}
          subtitle={busy === it.kind ? 'Preparando…' : it.description}
          right={<Icon name="download-outline" size={22} color={OC.blue} />}
          chevron={false}
          onPress={() => void download(it.kind, it.label)}
          accessibilityLabel={`Descargar ${it.label}. ${it.description}`}
          testID={`owner-backup-${it.kind}`}
        />
      ))}
      {message ? <ONote tone={message.tone} testID="owner-backup-message">{message.text}</ONote> : null}
      <ONote>
        La copia completa de la base de datos y su restauración se hacen desde el panel de Supabase (Database › Backups). Desde el móvil no se puede restaurar nada, para que nadie borre datos por error.
      </ONote>
    </OwnerScreen>
  );
}
