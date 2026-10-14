/**
 * /owner/report?id=… — Un error notificado: el mensaje completo, quién lo envía (si tiene cuenta), cómo contestarle,
 * los datos técnicos del móvil y una nota interna. «Marcar como resuelto» / «Reabrir» quedan en el registro.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { AppText, Avatar, ErrorState, SkeletonList } from '../../components';
import { useAsync } from '../../hooks';
import { OwnerAdminService, type OwnerReport } from '../../services/OwnerAdminService';
import { toAppError } from '../../api/errors';
import { showAlert } from '../../utils/dialogs';
import { OButton, OCard, OField, ONote, OPill, ORow, OSection, OT, OwnerScreen, PlanBadge, fmtDateTime } from './OwnerKit';
import { contactAction, reportFacts } from './reportFormat';

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export default function OwnerReportScreen() {
  const router = useRouter();
  const id = first(useLocalSearchParams<{ id?: string | string[] }>().id);
  const valid = /^[0-9a-f-]{36}$/i.test(id);
  const data = useAsync(() => OwnerAdminService.report(id), [id], { enabled: valid });
  const [report, setReport] = useState<OwnerReport | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'green' | 'red'; text: string } | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    if (!data.data) return;
    setReport(data.data);
    setNote(data.data.note ?? '');
  }, [data.data]);
  useFocusEffect(
    useCallback(() => {
      if (data.status === 'success') void data.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const r = report;
  const contact = contactAction(r?.contact);
  const facts = reportFacts(r?.context);

  const setStatus = async (status: 'read' | 'resolved') => {
    if (!r || lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const next = await OwnerAdminService.setReportStatus(r.id, status, note.trim());
      setReport(next);
      setMessage({ tone: 'green', text: status === 'resolved' ? 'Marcado como resuelto.' : 'Vuelve a estar sin resolver.' });
    } catch (e) {
      setMessage({ tone: 'red', text: toAppError(e).message });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const openContact = async () => {
    if (!contact) return;
    const ok = await Linking.openURL(contact.url).then(
      () => true,
      () => false,
    );
    if (!ok) await showAlert('No se ha podido abrir', r?.contact ?? '');
  };

  return (
    <OwnerScreen
      title={r ? `Error ${r.ref}` : 'Error notificado'}
      subtitle={r ? `Enviado el ${fmtDateTime(r.createdAt)}` : undefined}
      titleRight={r ? r.status === 'resolved' ? <OPill label="Resuelto" tone="green" /> : <OPill label="Sin resolver" tone="amber" /> : null}
      refreshing={data.refreshing}
      onRefresh={() => void data.refresh()}
      keyboard
      testID="owner-report"
    >
      {!valid ? <ONote tone="red">Este enlace no es válido.</ONote> : null}
      {valid && data.status === 'loading' ? <SkeletonList rows={3} /> : null}
      {data.error && !r ? <ErrorState kind={data.error.kind} message={data.error.message} onRetry={() => void data.reload()} /> : null}
      {r ? (
        <>
          <OCard>
            <AppText style={[OT.label, { lineHeight: 22 }]} color="text" selectable testID="owner-report-message">
              {r.message}
            </AppText>
          </OCard>

          <OSection title="Quién lo envía" />
          {r.user ? (
            <ORow
              left={<Avatar name={r.user.name ?? 'Sin nombre'} size={44} tone={r.user.plan === 'free' ? 'neutral' : 'primary'} />}
              title={r.user.name ?? 'Sin nombre'}
              subtitle={r.user.phone ?? (r.user.anonymous ? 'Sin teléfono' : null)}
              right={<PlanBadge plan={r.user.plan} />}
              onPress={() => router.push({ pathname: '/owner/user', params: { id: r.user?.id ?? '' } } as Href)}
              testID="owner-report-user"
            />
          ) : (
            <ONote>La persona escribió sin tener cuenta.</ONote>
          )}
          {r.contact ? (
            <OCard style={{ gap: 8 }}>
              <AppText style={OT.meta} color="textSecondary">Contacto que dejó para contestarle</AppText>
              <AppText style={OT.cardTitle} color="heading" selectable>{r.contact}</AppText>
              {contact ? <OButton label={contact.label} icon={contact.kind === 'tel' ? 'call' : 'mail'} variant="outline" onPress={() => void openContact()} testID="owner-report-contact" /> : null}
            </OCard>
          ) : (
            <ONote tone="amber">No dejó teléfono ni correo para contestarle.</ONote>
          )}

          <OSection title="Datos técnicos del móvil" />
          <OCard style={{ gap: 8 }}>
            {facts.length ? (
              facts.map((f) => (
                <View key={f.label} style={styles.fact}>
                  <AppText style={[OT.cardText, styles.factLabel]} color="textSecondary">{f.label}</AppText>
                  <AppText style={[OT.cardText, styles.factValue]} color="text" selectable>{f.value}</AppText>
                </View>
              ))
            ) : (
              <AppText style={OT.cardText} color="textSecondary">Sin datos técnicos.</AppText>
            )}
          </OCard>

          <OSection title="Solución" />
          <OField label="Nota interna" optional value={note} onChangeText={setNote} placeholder="Qué era y cómo se ha arreglado" maxLength={1000} multiline counter testID="owner-report-note" />
          {message ? <ONote tone={message.tone}>{message.text}</ONote> : null}
          {r.status === 'resolved' ? (
            <>
              {r.resolvedAt ? <AppText style={OT.cardText} color="textSecondary">{`Resuelto el ${fmtDateTime(r.resolvedAt)}.`}</AppText> : null}
              <OButton label="Guardar la nota" variant="outline" onPress={() => void setStatus('resolved')} loading={busy} testID="owner-report-save-note" />
              <OButton label="Reabrir" icon="refresh" variant="outline" onPress={() => void setStatus('read')} loading={busy} testID="owner-report-reopen" />
            </>
          ) : (
            <OButton label="Marcar como resuelto" icon="checkmark-done" onPress={() => void setStatus('resolved')} loading={busy} testID="owner-report-resolve" />
          )}
        </>
      ) : null}
    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  fact: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  factLabel: { width: 128 },
  factValue: { flex: 1 },
});
