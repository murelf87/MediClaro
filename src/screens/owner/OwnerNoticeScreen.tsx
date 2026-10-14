/**
 * /owner/notice — Notificaciones: un aviso que ven todas las personas arriba en Inicio (por ejemplo, «Mañana de 2 a 3 h
 * la identificación no estará disponible»). Se puede poner fecha de fin y cada persona puede cerrarlo.
 * No manda avisos al móvil: es un mensaje dentro de la app.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { AppText, ErrorState, InfoBanner, SkeletonList } from '../../components';
import { useAsync } from '../../hooks';
import { OwnerAdminService, type OwnerNotice } from '../../services/OwnerAdminService';
import { toAppError } from '../../api/errors';
import { OButton, OC, OCard, OChips, OField, OIcon, ONote, OT, OwnerScreen, fmtDateTime } from './OwnerKit';

type Until = 'none' | '24' | '72' | '168' | '720';
const UNTIL: { value: Until; label: string }[] = [
  { value: 'none', label: 'Sin fecha de fin' },
  { value: '24', label: '1 día' },
  { value: '72', label: '3 días' },
  { value: '168', label: '1 semana' },
  { value: '720', label: '1 mes' },
];

export default function OwnerNoticeScreen() {
  const data = useAsync(() => OwnerAdminService.notice(), []);
  const [enabled, setEnabled] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<OwnerNotice['tone']>('info');
  const [until, setUntil] = useState<Until>('none');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'green' | 'amber'; text: string } | null>(null);
  const loaded = useRef(false);
  const lock = useRef(false);

  useEffect(() => {
    const n = data.data;
    if (loaded.current || data.status !== 'success') return;
    loaded.current = true;
    if (n) {
      setEnabled(n.enabled && (!n.until || new Date(n.until).getTime() > Date.now()));
      setTitle(n.title ?? '');
      setMessage(n.message ?? '');
      setTone(n.tone ?? 'info');
    }
  }, [data.data, data.status]);

  const save = async () => {
    if (lock.current) return;
    if (enabled && message.trim().length < 3) {
      setResult({ tone: 'amber', text: 'Escribe el mensaje del aviso.' });
      return;
    }
    lock.current = true;
    setBusy(true);
    setResult(null);
    try {
      const hours = until === 'none' ? null : Number(until);
      const untilIso = enabled && hours ? new Date(Date.now() + hours * 3600_000).toISOString() : null;
      const saved = await OwnerAdminService.setNotice({ enabled, title: title.trim(), message: message.trim(), tone, until: untilIso });
      data.setData(saved);
      setResult({
        tone: 'green',
        text: saved.enabled ? `Aviso guardado. Ya lo ven todas las personas en Inicio${saved.until ? ` hasta el ${fmtDateTime(saved.until)}` : ''}.` : 'Aviso apagado. Ya no se muestra.',
      });
    } catch (e) {
      setResult({ tone: 'amber', text: toAppError(e).message });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <OwnerScreen
      title="Notificaciones"
      subtitle="Un aviso para todas las personas que usan MediClaro. Sale arriba en Inicio y cada una puede cerrarlo."
      keyboard
      testID="owner-notice"
      footer={<OButton label="Guardar aviso" icon="megaphone-outline" onPress={() => void save()} loading={busy} disabled={busy || data.status === 'loading'} testID="owner-notice-save" />}
    >
      {data.status === 'loading' ? <SkeletonList rows={3} /> : null}
      {data.error ? <ErrorState kind={data.error.kind} message={data.error.message} onRetry={() => void data.reload()} /> : null}
      {data.status !== 'loading' && !data.error ? (
        <>
          <OCard style={styles.toggle}>
            <OIcon icon="megaphone" size={42} />
            <View style={[styles.flex, { gap: 2 }]}>
              <AppText style={OT.cardTitle} color="heading">Mostrar el aviso en la app</AppText>
              <AppText style={OT.cardText} color="textSecondary">{enabled ? 'Encendido' : 'Apagado: no lo ve nadie'}</AppText>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ true: OC.blue, false: '#CBD5E1' }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Mostrar el aviso en la app"
              testID="owner-notice-enabled"
            />
          </OCard>
          <OCard style={{ gap: 14 }}>
            <OField label="Título" optional value={title} onChangeText={setTitle} maxLength={60} placeholder="Mantenimiento" testID="owner-notice-title" />
            <OField
              label="Mensaje"
              value={message}
              onChangeText={setMessage}
              maxLength={280}
              multiline
              counter
              placeholder="Mañana de 2 a 3 h la identificación de medicamentos no estará disponible."
              testID="owner-notice-message"
            />
            <View style={{ gap: 8 }}>
              <AppText style={OT.label} color="heading">Tipo</AppText>
              <OChips
                options={[
                  { value: 'info', label: 'Información' },
                  { value: 'warning', label: 'Importante' },
                  { value: 'success', label: 'Buena noticia' },
                ]}
                value={tone}
                onChange={setTone}
              />
            </View>
            <View style={{ gap: 8 }}>
              <AppText style={OT.label} color="heading">Hasta</AppText>
              <OChips options={UNTIL} value={until} onChange={setUntil} />
            </View>
          </OCard>
          <AppText style={OT.meta} color="textSecondary">Así lo verán</AppText>
          {message.trim() ? (
            <InfoBanner tone={tone} title={title.trim() || undefined} message={message.trim()} />
          ) : (
            <AppText style={OT.cardText} color="textSecondary">Escribe el mensaje para ver cómo queda.</AppText>
          )}
          {result ? <ONote tone={result.tone} testID="owner-notice-result">{result.text}</ONote> : null}
        </>
      ) : null}
    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
