/**
 * /owner/system — Mantenimiento · Estado del sistema: servidor, errores y coste de IA de las últimas 24 h, funciones
 * del servidor instaladas, avisos al móvil (pendientes, entregados y fallidos), tareas programadas y compras en tiendas.
 */
import { StyleSheet, View } from 'react-native';
import { AppText, ErrorState, SkeletonList } from '../../components';
import { useAsync } from '../../hooks';
import { OwnerAdminService } from '../../services/OwnerAdminService';
import { Grid, OCard, OCheck, OIcon, OKpi, ONote, OPill, ORow, OSection, OT, OwnerScreen, fmtDateTime, useNarrow } from './OwnerKit';

const CRON_LABEL: Record<string, string> = {
  'mediclaro-owner-cleanup': 'Limpieza de accesos del panel',
  'mediclaro-care-chat-cleanup': 'Limpieza del chat (90 días)',
  'mediclaro-expire-bizum-premium': 'Fin de Premium pagado con Bizum',
};

export default function OwnerSystemScreen() {
  const narrow = useNarrow();
  const data = useAsync(() => OwnerAdminService.system(), []);
  const s = data.data;
  const failed = s?.queues.reduce((n, q) => n + q.failed24h, 0) ?? 0;
  const issues = !!s && (failed > 0 || s.errors24h > 0);
  return (
    <OwnerScreen
      title="Estado del sistema"
      subtitle="Comprueba que todo funciona. Desliza hacia abajo para actualizar."
      refreshing={data.refreshing}
      onRefresh={() => void data.refresh()}
      testID="owner-system"
    >
      {data.status === 'loading' ? <SkeletonList rows={4} /> : null}
      {data.error && !s ? <ErrorState kind={data.error.kind} message={data.error.message} onRetry={() => void data.reload()} /> : null}
      {s ? (
        <>
          <OCard tone={issues ? 'white' : 'blue'} style={styles.status} testID="owner-system-status">
            <OIcon icon={issues ? 'warning' : 'checkmark'} size={44} color={issues ? '#D97706' : '#16A34A'} round />
            <View style={[styles.flex, { gap: 2 }]}>
              <AppText style={OT.cardTitle} color="heading">{issues ? 'Funcionando, con incidencias' : 'Todo funcionando'}</AppText>
              <AppText style={OT.cardText} color="textSecondary">{`Servidor: ${s.database === 'ok' ? 'conectado' : s.database} · ${fmtDateTime(s.serverTime)}`}</AppText>
            </View>
          </OCard>

          <Grid>
            <OKpi icon="bug" label={'Errores (24 h)'} value={s.errors24h} wide={narrow} />
            <OKpi
              icon="sparkles"
              label={'Coste de IA (24 h)'}
              value={Number(s.aiCost24h ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })}
              hint="Estimado"
              wide={narrow}
            />
            <OKpi icon="alert-circle" label="Avisos de ayuda activos" value={s.activeIncidents} wide={narrow} />
            <OKpi icon="megaphone" label="Aviso en la app" value={s.notice ? 'Activo' : 'Apagado'} wide={narrow} />
          </Grid>

          <OSection title="Funciones del servidor" />
          <OCard style={{ gap: 2, paddingVertical: 8 }}>
            <OCheck label="Mis pastillas" state={s.features.medication ? 'done' : 'todo'} detail={s.features.medication ? undefined : 'Falta aplicar su migración'} />
            <OCheck label="Chat y llamadas con el cuidador/a" state={s.features.careChat ? 'done' : 'todo'} detail={s.features.careChat ? undefined : 'Falta aplicar su migración'} />
            <OCheck label="Pago con Bizum y por un familiar" state={s.features.familyPay ? 'done' : 'todo'} detail={s.features.familyPay ? undefined : 'Falta aplicar su migración'} />
            <OCheck
              label="Verificación de compras de Apple y Google"
              state={s.storeVerification ? 'done' : 'pending'}
              detail={s.storeVerification ? undefined : 'Pendiente de activar tras probar las compras de prueba'}
            />
          </OCard>

          <OSection title={'Avisos al móvil (24 h)'} />
          {s.queues.map((q) => (
            <ORow
              key={q.key}
              left={<OIcon icon={q.failed24h ? 'alert-circle' : 'notifications'} variant="soft" size={40} />}
              title={q.label}
              subtitle={`Entregados: ${q.delivered24h} · Fallidos: ${q.failed24h}`}
              right={q.pending ? <OPill label={`${q.pending} en cola`} tone="blue" /> : <OPill label="Al día" />}
            />
          ))}
          <AppText style={OT.meta} color="textSecondary">«Entregado» quiere decir que Apple o Google aceptaron el aviso, no que la persona lo haya visto.</AppText>

          <OSection title="Tareas programadas" />
          {s.cron.length ? (
            s.cron.map((j) => (
              <ORow
                key={j.name}
                left={<OIcon icon={j.active ? 'time' : 'pause-circle'} variant="soft" size={40} />}
                title={CRON_LABEL[j.name] ?? j.name}
                subtitle={`${j.schedule}${j.lastRunAt ? ` · última vez: ${fmtDateTime(j.lastRunAt)}` : ''}`}
                right={
                  j.lastStatus === 'failed' ? (
                    <OPill label="Falló" tone="red" />
                  ) : j.lastStatus === 'succeeded' ? (
                    <OPill label="Bien" />
                  ) : (
                    <OPill label={j.active ? 'Activa' : 'Parada'} tone={j.active ? 'blue' : 'gray'} />
                  )
                }
              />
            ))
          ) : (
            <AppText style={OT.cardText} color="textSecondary">Sin datos de tareas programadas.</AppText>
          )}
          {failed ? (
            <ONote tone="amber">{`${failed} ${failed === 1 ? 'aviso no se pudo entregar' : 'avisos no se pudieron entregar'} en 24 h. Suele ser un teléfono que ya no tiene la app o que retiró los permisos.`}</ONote>
          ) : null}
        </>
      ) : null}
    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
