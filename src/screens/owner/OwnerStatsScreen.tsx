/**
 * /owner/stats — Estadísticas (pantalla 9 del diseño): periodo (7 días, 30 días, 3 meses, 1 año), cuatro cifras
 * (usuarios activos, tomas registradas, bonos utilizados y Premium activos) y el gráfico de barras apiladas «Uso de
 * funciones» con la leyenda al lado (Pastillas, Lucía, Emergencias y Otros = identificaciones por foto).
 * Solo totales: ningún dato de una persona concreta.
 */
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { AppText, ErrorState, SkeletonList } from '../../components';
import { useAsync } from '../../hooks';
import { OwnerAdminService, type OwnerStats, type OwnerStatsBucket } from '../../services/OwnerAdminService';
import { Grid, OCard, OChips, OKpi, OT, OwnerScreen, bucketLabel, fmtDateTime, useNarrow } from './OwnerKit';

type Range = '7' | '30' | '90' | '365';
const RANGES: { value: Range; label: string }[] = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '3 meses' },
  { value: '365', label: '1 año' },
];

/** Series del gráfico con los colores del diseño (azules y rosa). «Otros» son las identificaciones por foto. */
const SERIES: { key: keyof Omit<OwnerStatsBucket, 'bucket'>; label: string; color: string }[] = [
  { key: 'doses', label: 'Pastillas', color: '#2563EB' },
  { key: 'chats', label: 'Lucía', color: '#60A5FA' },
  { key: 'emergencies', label: 'Emergencias', color: '#1E3A8A' },
  { key: 'scans', label: 'Otros', color: '#F43F72' },
];

/** Máximo «redondo» del eje (múltiplo de 5, 10, 50…), para que las marcas sean números sencillos. */
function niceMax(v: number): number {
  if (v <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (v <= m * pow) return m * pow;
  return 10 * pow;
}

/** Una barra por día, semana o mes con el uso de cada función apilado (como en el diseño). */
function UsageBars({ stats, width }: { stats: OwnerStats; width: number }) {
  const groups = stats.series;
  const height = 170;
  const top = 8;
  const bottom = 22;
  const left = 30;
  const plotH = height - top - bottom;
  const plotW = Math.max(0, width - left - 2);
  const max = niceMax(Math.max(1, ...groups.map((g) => SERIES.reduce((n, s) => n + g[s.key], 0))));
  const groupW = groups.length ? plotW / groups.length : 0;
  const barW = Math.max(3, Math.min(22, groupW * 0.55));
  const labelEvery = groups.length > 7 ? Math.ceil(groups.length / 6) : 1;
  const y = (v: number) => top + plotH - (v / max) * plotH;
  return (
    <Svg width={width} height={height}>
      {[0, 0.5, 1].map((f) => (
        <G key={f}>
          <Line x1={left} x2={width} y1={y(max * f)} y2={y(max * f)} stroke="#E8EEF7" strokeWidth={1} />
          <SvgText x={left - 6} y={y(max * f) + 3.5} fontSize={10} fill="#64748B" textAnchor="end">
            {String(Math.round(max * f))}
          </SvgText>
        </G>
      ))}
      {groups.map((g, gi) => {
        const cx = left + gi * groupW + groupW / 2;
        let acc = 0;
        return (
          <G key={g.bucket}>
            {SERIES.map((s) => {
              const v = g[s.key];
              if (!v) return null;
              const y0 = y(acc);
              acc += v;
              const y1 = y(acc);
              return <Rect key={s.key} x={cx - barW / 2} y={y1} width={barW} height={Math.max(1, y0 - y1)} fill={s.color} />;
            })}
            {gi % labelEvery === 0 ? (
              <SvgText x={cx} y={height - 6} fontSize={9.5} fill="#64748B" textAnchor="middle">
                {bucketLabel(g.bucket, stats.unit)}
              </SvgText>
            ) : null}
          </G>
        );
      })}
    </Svg>
  );
}

function UsageCard({ stats, narrow }: { stats: OwnerStats; narrow: boolean }) {
  const [chartW, setChartW] = useState(0);
  const totals = SERIES.map((s) => ({ ...s, total: stats.series.reduce((n, g) => n + g[s.key], 0) }));
  const summary = totals.map((t) => `${t.label}: ${t.total.toLocaleString('es-ES')}`).join('. ');
  const empty = totals.every((t) => !t.total);
  return (
    <OCard style={{ gap: 10 }} testID="owner-stats-chart">
      <AppText style={OT.cardTitle} color="heading" accessibilityRole="header">Uso de funciones</AppText>
      <View
        style={[styles.chartRow, narrow ? styles.chartColumn : null]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={empty ? 'Gráfico de uso: sin uso en este periodo' : `Gráfico de uso. ${summary}. Otros son las identificaciones por foto.`}
      >
        <View style={narrow ? styles.chartFull : styles.chartSide} onLayout={(e: LayoutChangeEvent) => setChartW(Math.round(e.nativeEvent.layout.width))}>
          {chartW > 0 ? <UsageBars stats={stats} width={chartW} /> : <View style={{ height: 170 }} />}
        </View>
        <View style={narrow ? styles.legendBelow : styles.legendSide}>
          {SERIES.map((s) => (
            <View key={s.key} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: s.color }]} />
              <AppText style={OT.cardText} color="text" numberOfLines={1}>{s.label}</AppText>
            </View>
          ))}
        </View>
      </View>
      <AppText style={OT.meta} color="textSecondary">
        {empty ? 'Sin uso en este periodo.' : `Otros: ${totals[3].total.toLocaleString('es-ES')} identificaciones por foto.`}
      </AppText>
    </OCard>
  );
}

export default function OwnerStatsScreen() {
  const narrow = useNarrow();
  const [range, setRange] = useState<Range>('30');
  const data = useAsync(() => OwnerAdminService.stats(Number(range) as 7 | 30 | 90 | 365), [range]);
  const s = data.data;
  return (
    <OwnerScreen title="Estadísticas" subtitle="Resumen de uso de la plataforma." refreshing={data.refreshing} onRefresh={() => void data.refresh()} testID="owner-stats">
      <OChips options={RANGES} value={range} onChange={setRange} fill />
      {data.status === 'loading' ? <SkeletonList rows={4} /> : null}
      {data.error && !s ? <ErrorState kind={data.error.kind} message={data.error.message} onRetry={() => void data.reload()} /> : null}
      {s ? (
        <>
          <Grid>
            <OKpi icon="person" label="Usuarios activos" value={s.kpis.activeUsers} wide={narrow} testID="owner-stats-active" />
            <OKpi icon="medkit" label="Tomas registradas" value={s.kpis.doses} wide={narrow} testID="owner-stats-doses" />
            <OKpi icon="gift" label="Bonos utilizados" value={s.kpis.bonosUsed} wide={narrow} testID="owner-stats-bonos" />
            <OKpi icon="diamond" label="Premium activos" value={s.kpis.premiumActive} wide={narrow} testID="owner-stats-premium" />
          </Grid>
          <UsageCard stats={s} narrow={narrow} />
          <AppText style={OT.meta} color="textSecondary">
            {`Actualizado: ${fmtDateTime(s.generatedAt)} · ${s.kpis.users.toLocaleString('es-ES')} cuentas · ${s.kpis.paidActive.toLocaleString('es-ES')} Premium de pago. Solo totales, sin datos de personas.`}
          </AppText>
        </>
      ) : null}
    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chartColumn: { flexDirection: 'column', alignItems: 'stretch' },
  chartSide: { flex: 1 },
  chartFull: { alignSelf: 'stretch' },
  legendSide: { width: 104, gap: 12 },
  legendBelow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 3 },
});
