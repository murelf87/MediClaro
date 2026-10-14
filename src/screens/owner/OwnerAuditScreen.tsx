/**
 * /owner/audit — Registro y auditoría (pantalla 10 del diseño): pestañas Actividad / Eventos y una fila por anotación
 * con su icono azul, qué pasó, el detalle, la fecha debajo y la flecha (al tocarla se ven todos los datos guardados).
 *  - Actividad: lo que se hace en el panel (accesos, bonos, Premium concedido o retirado, fichas consultadas, copias,
 *    aviso de la app, cambios de código).
 *  - Eventos: lo que pasa en la plataforma (altas, cuentas eliminadas, descargas de datos…).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, EmptyState, ErrorState, Icon, SkeletonList } from '../../components';
import { OwnerAdminService, type OwnerAuditRow } from '../../services/OwnerAdminService';
import { toAppError, type AppError } from '../../api/errors';
import { OButton, OC, OCard, OIcon, ONote, OSegments, OT, OwnerScreen, auditFacts, describeAudit, fmtDateTime } from './OwnerKit';

function AuditItem({ row }: { row: OwnerAuditRow }) {
  const [open, setOpen] = useState(false);
  const info = describeAudit(row);
  const red = info.color === 'red';
  const when = fmtDateTime(row.createdAt);
  const facts = open ? auditFacts(row) : [];
  return (
    <OCard
      onPress={() => setOpen((v) => !v)}
      style={styles.item}
      accessibilityLabel={`${info.title}. ${info.detail}. ${when}. ${open ? 'Ocultar datos' : 'Ver todos los datos'}`}
      testID={`owner-audit-${row.id}`}
    >
      <View style={styles.row}>
        <OIcon icon={info.icon} variant="soft" size={40} color={red ? OC.red : OC.blue} bg={red ? OC.redSoft : OC.blueSoft} />
        <View style={[styles.flex, { gap: 2 }]}>
          <AppText style={OT.cardTitle} color="heading">{info.title}</AppText>
          {info.detail ? <AppText style={OT.cardText} color="textSecondary">{info.detail}</AppText> : null}
          <AppText style={OT.meta} color="textSecondary">{when}</AppText>
        </View>
        <Icon name={open ? 'chevron-down' : 'chevron-forward'} size={20} color="#94A3B8" />
      </View>
      {open ? (
        <View style={styles.facts}>
          {facts.map((f) => (
            <View key={f.label} style={styles.fact}>
              <AppText style={[OT.meta, styles.factLabel]} color="textSecondary">{f.label}</AppText>
              <AppText style={[OT.cardText, styles.flex]} color="text">{f.value}</AppText>
            </View>
          ))}
        </View>
      ) : null}
    </OCard>
  );
}

export default function OwnerAuditScreen() {
  const [tab, setTab] = useState<'activity' | 'events'>('activity');
  const [rows, setRows] = useState<OwnerAuditRow[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const request = useRef(0);

  const load = useCallback(async (t: 'activity' | 'events', p: number, mode: 'replace' | 'append' | 'refresh') => {
    const id = ++request.current;
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const r = await OwnerAdminService.audit(t, p);
      if (id !== request.current) return;
      setRows((prev) => (mode === 'append' ? [...prev, ...r.rows] : r.rows));
      setPage(p);
      setHasMore(r.rows.length === r.pageSize);
    } catch (e) {
      if (id === request.current) setError(toAppError(e));
    } finally {
      if (id === request.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    setRows([]);
    void load(tab, 0, 'replace');
  }, [tab, load]);

  return (
    <OwnerScreen
      title="Registro y auditoría"
      subtitle="Consulta la actividad y eventos de la plataforma."
      refreshing={refreshing}
      onRefresh={() => void load(tab, 0, 'refresh')}
      testID="owner-audit"
    >
      <OSegments
        options={[
          { value: 'activity', label: 'Actividad' },
          { value: 'events', label: 'Eventos' },
        ]}
        value={tab}
        onChange={setTab}
        accessibilityLabel="Qué registro ver"
      />
      {loading && !rows.length ? <SkeletonList rows={5} /> : null}
      {error && !rows.length ? <ErrorState kind={error.kind} message={error.message} onRetry={() => void load(tab, 0, 'replace')} /> : null}
      {!loading && !error && !rows.length ? <EmptyState icon="document-text-outline" title="Aún no hay nada registrado" /> : null}
      {rows.map((r) => (
        <AuditItem key={r.id} row={r} />
      ))}
      {hasMore ? (
        <OButton label="Ver más antiguos" icon="chevron-down" variant="outline" onPress={() => void load(tab, page + 1, 'append')} loading={loading} disabled={loading} testID="owner-audit-more" />
      ) : null}
      {error && rows.length ? <ONote tone="amber">{error.message}</ONote> : null}
    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  item: { gap: 10, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  facts: { gap: 6, borderTopWidth: 1, borderTopColor: '#EEF2F8', paddingTop: 10, marginLeft: 52 },
  fact: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  factLabel: { minWidth: 92 },
});
